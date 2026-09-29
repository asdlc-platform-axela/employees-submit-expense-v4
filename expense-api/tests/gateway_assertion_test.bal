// Tests for gateway_assertion.bal, verified against a throwaway RSA keypair
// — never a real gateway or IdP. `tests/resources/` carries two self-signed
// certificates: `test-*` is the one this suite points
// `GATEWAY_ASSERTION_CERTIFICATE` at (export it, `GATEWAY_ASSERTION_ISSUER`
// and `GATEWAY_ASSERTION_HEADER` before `bal test` — see the ballerina
// skill), and `other-*` is an unrelated keypair used only to sign an
// assertion this service must reject.
//
// A small `/test` service, wired with the SAME `AssertionInterceptor` the
// real service uses, is what these tests call through — never the production
// resources in openapi_service.bal, which reach Postgres/SendGrid and so
// need a live database this sandbox does not have. This service needs none.

import ballerina/http;
import ballerina/jwt;
import ballerina/lang.array;
import ballerina/test;

const string TEST_KEY_PATH = "tests/resources/test-private-key.pem";
const string OTHER_KEY_PATH = "tests/resources/other-private-key.pem";

listener http:Listener assertionTestListener = new (9091);

service http:InterceptableService /test on assertionTestListener {

    public function createInterceptors() returns AssertionInterceptor => new;

    // Mirrors any `security: [{oauth2: [...]}]` operation: needs a caller.
    resource function get whoami(http:RequestContext ctx) returns json|http:Unauthorized {
        GatewayCaller|http:Unauthorized caller = requireGatewayCaller(ctx);
        if caller is http:Unauthorized {
            return caller;
        }
        return {username: caller.username, scopes: caller.scopes};
    }

    // Mirrors a `security: []` operation: reads no identity, needs no assertion.
    resource function get ping() returns json {
        return {pong: true};
    }
}

final http:Client assertionTestClient = check new ("http://localhost:9091/test");

function issueAssertion(string keyFile, string username, string scope) returns string|error {
    jwt:IssuerConfig config = {
        issuer: "aep-gateway-test",
        username: "directory-uuid-1",
        customClaims: {"username": username, "scope": scope, "ouHandle": "acme"},
        expTime: 300,
        signatureConfig: {
            algorithm: jwt:RS256,
            config: {keyFile, keyPassword: ""}
        }
    };
    return jwt:issue(config);
}

function base64UrlToStandard(string segment) returns string {
    string replaced = re `-`.replaceAll(segment, "+");
    replaced = re `_`.replaceAll(replaced, "/");
    int remainder = replaced.length() % 4;
    if remainder == 2 {
        return replaced + "==";
    }
    if remainder == 3 {
        return replaced + "=";
    }
    return replaced;
}

function standardToBase64Url(string standard) returns string {
    string replaced = re `\+`.replaceAll(standard, "-");
    replaced = re `/`.replaceAll(replaced, "_");
    return re `=+$`.replaceAll(replaced, "");
}

// Edits the payload segment of an already-signed JWT and reassembles it with
// the ORIGINAL signature — the shape of an assertion tampered with after
// signing, which must never verify.
function tamperPayload(string validToken) returns string|error {
    string[] parts = re `\.`.split(validToken);
    if parts.length() != 3 {
        return error("expected a three-part JWT");
    }
    byte[] payloadBytes = check array:fromBase64(base64UrlToStandard(parts[1]));
    string payloadJson = check string:fromBytes(payloadBytes);
    string tamperedJson = re `"scope":"[^"]*"`.replaceAll(payloadJson, "\"scope\":\"claims:read-all\"");
    string tamperedSegment = standardToBase64Url(tamperedJson.toBytes().toBase64());
    return parts[0] + "." + tamperedSegment + "." + parts[2];
}

@test:Config {}
function testValidAssertionIsAccepted() returns error? {
    string token = check issueAssertion(TEST_KEY_PATH, "test-employee", "claims:read");
    http:Response response = check assertionTestClient->get("/whoami", headers = {"x-jwt-assertion": token});
    test:assertEquals(response.statusCode, 200);
    json body = check response.getJsonPayload();
    test:assertEquals(check body.username, "test-employee");
}

@test:Config {}
function testAssertionSignedByADifferentKeyIsUnauthorized() returns error? {
    string token = check issueAssertion(OTHER_KEY_PATH, "test-employee", "claims:read");
    http:Response response = check assertionTestClient->get("/whoami", headers = {"x-jwt-assertion": token});
    test:assertEquals(response.statusCode, 401);
}

@test:Config {}
function testTamperedAssertionIsUnauthorized() returns error? {
    string validToken = check issueAssertion(TEST_KEY_PATH, "test-employee", "claims:read");
    string tampered = check tamperPayload(validToken);
    http:Response response = check assertionTestClient->get("/whoami", headers = {"x-jwt-assertion": tampered});
    test:assertEquals(response.statusCode, 401);
}

@test:Config {}
function testNoAssertionServesAPublicResource() returns error? {
    http:Response response = check assertionTestClient->get("/ping");
    test:assertEquals(response.statusCode, 200);
    json body = check response.getJsonPayload();
    test:assertEquals(check body.pong, true);
}
