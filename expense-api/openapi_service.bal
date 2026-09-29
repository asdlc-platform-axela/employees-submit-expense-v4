// Generated from specs/design/components/expense-api/openapi.yaml by
// `bal openapi --mode service`, then filled in by hand: the gateway
// assertion wiring, every resource body, and the handful of helper
// functions the resources share.

import ballerina/http;
import ballerina/time;
import ballerina/uuid;

listener http:Listener ep0 = new (9090);

service http:InterceptableService / on ep0 {

    public function createInterceptors() returns AssertionInterceptor => new;

    # Every approved claim, across the organization
    #
    # + return - returns can be any of following types
    # http:Ok (Approved claims)
    # http:Unauthorized (Not signed in)
    resource function get claims(http:RequestContext ctx, boolean? exported, int 'limit = 20, int offset = 0)
            returns ClaimPage|ErrorUnauthorized|error {
        GatewayCaller|ErrorUnauthorized callerResult = requireCaller(ctx);
        if callerResult is ErrorUnauthorized {
            return callerResult;
        }
        string username = check requireUsername(callerResult);
        check ensureEmployeeRow(username);

        CountedRows counted = check approvedClaimsPage(exported, 'limit, offset);
        map<string> extraParams = {};
        if exported is boolean {
            extraParams["exported"] = exported.toString();
        }
        return buildClaimPage("/claims", extraParams, counted, 'limit, offset);
    }

    # The caller's own claims
    #
    # + return - returns can be any of following types
    # http:Ok (The caller's claims)
    # http:Unauthorized (Not signed in)
    resource function get me/claims(http:RequestContext ctx, "pending"|"approved"|"rejected"? status,
            int 'limit = 20, int offset = 0) returns ClaimPage|ErrorUnauthorized|error {
        GatewayCaller|ErrorUnauthorized callerResult = requireCaller(ctx);
        if callerResult is ErrorUnauthorized {
            return callerResult;
        }
        string username = check requireUsername(callerResult);
        check ensureEmployeeRow(username);

        CountedRows counted = check myClaimsPage(username, status, 'limit, offset);
        map<string> extraParams = {};
        if status is string {
            extraParams["status"] = status;
        }
        return buildClaimPage("/me/claims", extraParams, counted, 'limit, offset);
    }

    # One of the caller's own claims
    #
    # + return - returns can be any of following types
    # http:Ok (The claim)
    # http:NotFound (No such claim of the caller's)
    # http:Unauthorized (Not signed in)
    resource function get me/claims/[string claimId](http:RequestContext ctx)
            returns ExpenseClaim|ErrorNotFound|ErrorUnauthorized|error {
        GatewayCaller|ErrorUnauthorized callerResult = requireCaller(ctx);
        if callerResult is ErrorUnauthorized {
            return callerResult;
        }
        string username = check requireUsername(callerResult);
        check ensureEmployeeRow(username);

        ClaimRow? row = check getClaimByIdForEmployee(claimId, username);
        if row is () {
            return <ErrorNotFound>{body: {code: 404, message: "No such claim of the caller's"}};
        }
        return toExpenseClaim(row);
    }

    # Claims submitted by the caller's direct reports
    #
    # + return - returns can be any of following types
    # http:Ok (Claims of the caller's direct reports)
    # http:Unauthorized (Not signed in)
    resource function get me/team/claims(http:RequestContext ctx, "pending"|"approved"|"rejected"? status,
            int 'limit = 20, int offset = 0) returns ClaimPage|ErrorUnauthorized|error {
        GatewayCaller|ErrorUnauthorized callerResult = requireCaller(ctx);
        if callerResult is ErrorUnauthorized {
            return callerResult;
        }
        string username = check requireUsername(callerResult);
        check ensureEmployeeRow(username);

        string[] reports = check directReportsOf(username);
        CountedRows counted = check teamClaimsPage(reports, status, 'limit, offset);
        map<string> extraParams = {};
        if status is string {
            extraParams["status"] = status;
        }
        return buildClaimPage("/me/team/claims", extraParams, counted, 'limit, offset);
    }

    # Export approved, unexported claims to a payroll file
    #
    # + return - returns can be any of following types
    # http:Ok (Export file of the claims just exported)
    # http:BadRequest (No approved, unexported claims to export)
    # http:Unauthorized (Not signed in)
    resource function post claims/export(http:RequestContext ctx)
            returns StringOk|ErrorBadRequest|ErrorUnauthorized|error {
        GatewayCaller|ErrorUnauthorized callerResult = requireCaller(ctx);
        if callerResult is ErrorUnauthorized {
            return callerResult;
        }
        string username = check requireUsername(callerResult);
        check ensureEmployeeRow(username);

        time:Utc exportedAt = time:utcNow();
        ClaimRow[] rows = check exportApprovedUnexported(exportedAt);
        if rows.length() == 0 {
            return <ErrorBadRequest>{body: {code: 400, message: "No approved, unexported claims to export"}};
        }
        string csv = buildCsv(rows);
        return <StringOk>{body: csv, mediaType: "text/csv"};
    }

    # Submit a new expense claim
    #
    # + return - returns can be any of following types
    # http:Created (Claim created, pending approval)
    # http:BadRequest (Missing or invalid claim fields)
    # http:Unauthorized (Not signed in)
    resource function post me/claims(http:RequestContext ctx, @http:Payload NewExpenseClaim payload)
            returns ExpenseClaim|ErrorBadRequest|ErrorUnauthorized|error {
        GatewayCaller|ErrorUnauthorized callerResult = requireCaller(ctx);
        if callerResult is ErrorUnauthorized {
            return callerResult;
        }
        string username = check requireUsername(callerResult);
        check ensureEmployeeRow(username);

        decimal amount = payload.amount;
        string description = payload.description;
        if amount <= 0d {
            return <ErrorBadRequest>{body: {code: 400, message: "amount must be greater than zero"}};
        }
        if description.trim() == "" {
            return <ErrorBadRequest>{body: {code: 400, message: "description is required"}};
        }

        string claimId = uuid:createRandomUuid();
        time:Utc submittedAt = time:utcNow();
        ClaimRow row = {
            id: claimId,
            employeeId: username,
            amount,
            category: payload.category,
            description,
            receiptFileName: payload?.receiptFileName,
            receiptContentType: payload?.receiptContentType,
            receiptUrl: payload?.receiptUrl,
            status: "pending",
            submittedAt,
            decidedAt: (),
            decidedBy: (),
            exported: false,
            exportedAt: ()
        };
        check insertClaim(row);

        // "on POST /me/claims succeeding, notify the employee's manager (new
        // claim awaiting approval) if they have one" — submit-and-approve-claim.md
        string? manager = check managerOf(username);
        if manager is string {
            notifyByEmail(manager, "New expense claim awaiting approval",
                "An expense claim from " + username + " for " + amount.toString()
                    + " (" + payload.category + ") is awaiting your approval.");
        }

        return toExpenseClaim(row);
    }

    # Approve a pending claim of a direct report
    #
    # + return - returns can be any of following types
    # http:Ok (Claim approved)
    # http:BadRequest (Claim is not pending)
    # http:NotFound (No such pending claim of a direct report)
    # http:Unauthorized (Not signed in)
    resource function post me/team/claims/[string claimId]/approve(http:RequestContext ctx)
            returns ExpenseClaimOk|ErrorBadRequest|ErrorNotFound|ErrorUnauthorized|error {
        GatewayCaller|ErrorUnauthorized callerResult = requireCaller(ctx);
        if callerResult is ErrorUnauthorized {
            return callerResult;
        }
        string username = check requireUsername(callerResult);
        check ensureEmployeeRow(username);

        return decideTeamClaim(claimId, username, "approved", "Your expense claim was approved.");
    }

    # Reject a pending claim of a direct report
    #
    # + return - returns can be any of following types
    # http:Ok (Claim rejected)
    # http:BadRequest (Claim is not pending)
    # http:NotFound (No such pending claim of a direct report)
    # http:Unauthorized (Not signed in)
    resource function post me/team/claims/[string claimId]/reject(http:RequestContext ctx)
            returns ExpenseClaimOk|ErrorBadRequest|ErrorNotFound|ErrorUnauthorized|error {
        GatewayCaller|ErrorUnauthorized callerResult = requireCaller(ctx);
        if callerResult is ErrorUnauthorized {
            return callerResult;
        }
        string username = check requireUsername(callerResult);
        check ensureEmployeeRow(username);

        return decideTeamClaim(claimId, username, "rejected", "Your expense claim was rejected.");
    }
}

// ---- Identity -------------------------------------------------------------

# The verified caller, or the contract's own `ErrorUnauthorized` body — never
# `http:Unauthorized`'s generic one, so every 401 this service returns matches
# the `Error` schema every other response error does.
#
# + ctx - the request context the gateway-assertion interceptor wrote to
# + return - the verified caller, or a 401 to return as-is
function requireCaller(http:RequestContext ctx) returns GatewayCaller|ErrorUnauthorized {
    GatewayCaller|http:Unauthorized result = requireGatewayCaller(ctx);
    if result is http:Unauthorized {
        return <ErrorUnauthorized>{body: {code: 401, message: "not signed in"}};
    }
    return result;
}

# The caller's login name — every Employee and ExpenseClaim row in this
# service is keyed by `username`, never the assertion's opaque `userId`,
# because usernames are what `specs/design/security.json`'s test users (and
# this service's own `employees` table) are keyed by.
#
# + caller - the verified caller
# + return - the caller's username, or an error on the (unexpected) assertion
#            that carries none
function requireUsername(GatewayCaller caller) returns string|error {
    string|http:InternalServerError result = requireCallerUsername(caller);
    if result is http:InternalServerError {
        return error("gateway assertion carries no username; cannot resolve caller identity");
    }
    return result;
}

// ---- Claim <-> wire-type conversion ----------------------------------------

function toExpenseClaim(ClaimRow row) returns ExpenseClaim|error {
    "Travel"|"Meals"|"Lodging"|"Supplies"|"Other" category = check row.category.cloneWithType();
    "pending"|"approved"|"rejected" status = check row.status.cloneWithType();
    time:Utc? decidedAtRaw = row.decidedAt;
    time:Utc? exportedAtRaw = row.exportedAt;

    ExpenseClaim claim = {
        id: row.id,
        employeeId: row.employeeId,
        amount: row.amount,
        category,
        description: row.description,
        status,
        submittedAt: time:utcToString(row.submittedAt),
        decidedAt: decidedAtRaw is time:Utc ? time:utcToString(decidedAtRaw) : (),
        decidedBy: row.decidedBy,
        exported: row.exported,
        exportedAt: exportedAtRaw is time:Utc ? time:utcToString(exportedAtRaw) : ()
    };
    string? receiptFileName = row.receiptFileName;
    if receiptFileName is string {
        claim.receiptFileName = receiptFileName;
    }
    string? receiptContentType = row.receiptContentType;
    if receiptContentType is string {
        claim.receiptContentType = receiptContentType;
    }
    string? receiptUrl = row.receiptUrl;
    if receiptUrl is string {
        claim.receiptUrl = receiptUrl;
    }
    return claim;
}

// ---- Approve / reject, shared -----------------------------------------

# Approves or rejects a claim, checked against the manager relationship this
# service itself maintains — never against anything the client sent. Never
# reveals whether a claim exists that is not one of the caller's direct
# reports: both "no such claim" and "not your report's claim" answer the same
# 404 (`api-management`'s "a row that exists but is not the caller's" rule).
#
# + claimId - the claim to decide
# + managerUsername - the deciding manager's username (the caller's)
# + newStatus - "approved" or "rejected"
# + employeeMessage - the decision email body sent to the claim's employee
# + return - the decided claim, or the 400/404 the contract names
function decideTeamClaim(string claimId, string managerUsername, string newStatus, string employeeMessage)
        returns ExpenseClaimOk|ErrorBadRequest|ErrorNotFound|error {
    ClaimRow? claim = check getClaimById(claimId);
    if claim is () {
        return <ErrorNotFound>{body: {code: 404, message: "No such pending claim of a direct report"}};
    }
    string? manager = check managerOf(claim.employeeId);
    if manager is () || manager != managerUsername {
        return <ErrorNotFound>{body: {code: 404, message: "No such pending claim of a direct report"}};
    }
    if claim.status != "pending" {
        return <ErrorBadRequest>{body: {code: 400, message: "Claim is not pending"}};
    }

    time:Utc decidedAt = time:utcNow();
    check decideClaim(claimId, newStatus, decidedAt, managerUsername);
    ClaimRow? updated = check getClaimById(claimId);
    if updated is () {
        return error("claim vanished immediately after its own decision was recorded");
    }

    // "on approve/reject succeeding, notify the employee (decision)" —
    // submit-and-approve-claim.md
    notifyByEmail(claim.employeeId, "Your expense claim was " + newStatus, employeeMessage);

    ExpenseClaim body = check toExpenseClaim(updated);
    return <ExpenseClaimOk>{body};
}

// ---- Pagination -------------------------------------------------------

function buildClaimPage(string basePath, map<string> extraParams, CountedRows counted, int 'limit, int offset)
        returns ClaimPage|error {
    ExpenseClaim[] data = [];
    foreach ClaimRow row in counted.rows {
        ExpenseClaim claim = check toExpenseClaim(row);
        data.push(claim);
    }
    string? next = offset + 'limit < counted.total ? pageUri(basePath, extraParams, 'limit, offset + 'limit) : ();
    string? previous = offset > 0 ? pageUri(basePath, extraParams, 'limit, offset - 'limit < 0 ? 0 : offset - 'limit)
        : ();
    return {count: counted.total, next, previous, data};
}

function pageUri(string basePath, map<string> extraParams, int 'limit, int offset) returns string {
    string query = "limit=" + 'limit.toString() + "&offset=" + offset.toString();
    foreach string key in extraParams.keys() {
        query = query + "&" + key + "=" + extraParams.get(key);
    }
    return basePath + "?" + query;
}

// ---- CSV export ---------------------------------------------------------

function buildCsv(ClaimRow[] rows) returns string {
    string csv = "id,employeeId,amount,category,description,decidedAt\n";
    foreach ClaimRow row in rows {
        time:Utc? decidedAtRaw = row.decidedAt;
        string decidedAt = decidedAtRaw is time:Utc ? time:utcToString(decidedAtRaw) : "";
        csv = csv + csvField(row.id) + "," + csvField(row.employeeId) + "," + row.amount.toString() + ","
            + csvField(row.category) + "," + csvField(row.description) + "," + csvField(decidedAt) + "\n";
    }
    return csv;
}

function csvField(string value) returns string {
    if value.includes(",") || value.includes("\"") || value.includes("\n") {
        string escaped = re `"`.replaceAll(value, "\"\"");
        return "\"" + escaped + "\"";
    }
    return value;
}

// ---- Generated types (from openapi.yaml) -----------------------------

public type ErrorNotFound record {|
    *http:NotFound;
    Error body;
|};

public type ExpenseClaim record {
    string id;
    string employeeId;
    decimal amount;
    "Travel"|"Meals"|"Lodging"|"Supplies"|"Other" category;
    string description;
    string receiptFileName?;
    string receiptContentType?;
    string receiptUrl?;
    "pending"|"approved"|"rejected" status;
    string submittedAt;
    string? decidedAt?;
    string? decidedBy?;
    boolean exported;
    string? exportedAt?;
};

public type StringOk record {|
    *http:Ok;
    string body;
|};

public type NewExpenseClaim record {
    # claim amount
    decimal amount;
    "Travel"|"Meals"|"Lodging"|"Supplies"|"Other" category;
    string description;
    # file name of the attached receipt
    string receiptFileName?;
    # MIME type of the attached receipt
    string receiptContentType?;
    # location of the uploaded receipt file
    string receiptUrl?;
};

# The paginated envelope every collection GET in the contract returns.
# Generated as `inline_response_200`; renamed here for readability — the
# shape is unchanged.
public type ClaimPage record {
    # total matching items
    int count;
    # relative URI of the next page
    string? next?;
    # relative URI of the previous page
    string? previous?;
    # the page of claims
    ExpenseClaim[] data;
};

public type Error record {
    # HTTP or application error code
    int code;
    # short human-readable label
    string message;
    # detailed explanation
    string description?;
    # URI to documentation
    string moreInfo?;
};

public type ErrorBadRequest record {|
    *http:BadRequest;
    Error body;
|};

public type ExpenseClaimOk record {|
    *http:Ok;
    ExpenseClaim body;
|};

public type ErrorUnauthorized record {|
    *http:Unauthorized;
    Error body;
|};
