// `mockEnv` carries the keys the platform actually emits for this component,
// and only those: this app's user-auth OIDC keys. There is no sibling API URL
// key — the sibling lives at same-origin /api (react-webapp Constraints), and
// no <NAME>_URL for an external-kind dependency because this app has none.
export const mockEnv = {
  USER_AUTH_CLIENT_ID: "mock-client",
  USER_AUTH_ISSUER: "https://mock-idp.test",
  // No USER_AUTH_JWKS_URL: the platform emits it, src/env.ts does not declare
  // it (the browser never validates a token), so mock mode does not carry it.
  // OIDC scopes are `group`/`ou`, singular, then the project's catalog
  // handles from specs/design/security.json, exactly as the platform would
  // request them.
  USER_AUTH_SCOPES:
    "openid profile email group ou claims:read claims:submit claims:read-team claims:approve claims:reject claims:read-all claims:export",
  USER_AUTH_RESOURCE: "https://mock-idp.test/resources/mock-project",
};
