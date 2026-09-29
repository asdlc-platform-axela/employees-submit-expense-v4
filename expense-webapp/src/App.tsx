// ROUTING STRUCTURE (thunder-authentication):
//
//   NoAccess sits ABOVE the shell route and REPLACES it — a caller who
//   unlocks nothing gets no navbar, no empty sidebar.
//
//   Forbidden sits INSIDE the shell — the caller holds other scopes and has
//   somewhere to go, so the rail stays. Routed at /forbidden.
//
//   /forbidden is wired into authz/client once, from the router root
//   (ForbiddenWiring below).
//
//   Every gated route is wrapped in <RequireOperation>, with the operation
//   taken from SCREEN_ROUTES — never a handle or an operation typed here.
//
//   /callback is routed OUTSIDE the provider: there is no session to read
//   until the redirect has been processed.
//
// Every flow in wireframes.dsl carries a `role` line, so this app has no
// public screen: SCREEN_ROUTES has no `public: true` row and the `*` route
// below always resolves through SignedIn.

import { useEffect, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  AuthzProvider,
  Forbidden,
  NoAccess,
  RequireOperation,
  useAuthz,
  useScopes,
} from "./authz/gates";
import { SCREEN_ROUTES, reachableScreens, hasScopedReach } from "./authz/screens";
import { setForbiddenNavigator } from "./authz/client";
import { signIn } from "./authz/session";
import { AppShell } from "./shell/AppShell";
import { APP_NAME } from "./appName";
import { CallbackPage } from "./pages/Callback";
import { MyClaimsPage } from "./pages/MyClaims";
import { SubmitClaimPage } from "./pages/SubmitClaim";
import { TeamClaimsPage } from "./pages/TeamClaims";
import { ClaimDetailPage } from "./pages/ClaimDetail";
import { ApprovedClaimsPage } from "./pages/ApprovedClaims";
import { ExportConfirmationPage } from "./pages/ExportConfirmation";
import { Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";

/** YOUR pages, keyed by the screen keys src/authz/screens.ts declares. */
const PAGE_BY_KEY: Record<string, ReactElement> = {
  "my-claims": <MyClaimsPage />,
  "submit-claim": <SubmitClaimPage />,
  "team-claims": <TeamClaimsPage />,
  "claim-detail": <ClaimDetailPage />,
  "approved-claims": <ApprovedClaimsPage />,
  "export-confirmation": <ExportConfirmationPage />,
};

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <ForbiddenWiring />
      <Routes>
        <Route path="/callback" element={<CallbackPage />} />
        <Route
          path="*"
          element={
            <AuthzProvider fallback={<Splash />}>
              <SignedIn />
            </AuthzProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

/**
 * Hands src/authz/client.ts the route a refusal goes to. ONCE, from inside
 * the router and above every route, so it is wired before the first request
 * can be answered. `replace` keeps the refused URL out of the history, so
 * Back does not walk the user straight into the same refusal.
 */
function ForbiddenWiring(): null {
  const navigate = useNavigate();
  useEffect(() => {
    setForbiddenNavigator(() => navigate("/forbidden", { replace: true }));
  }, [navigate]);
  return null;
}

function Splash(): ReactElement {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <Stack spacing={2} alignItems="center">
        <CircularProgress />
        <Typography variant="body1" color="text.secondary">
          Checking your session…
        </Typography>
      </Stack>
    </Box>
  );
}

function SignedIn(): ReactElement {
  const { signedIn } = useAuthz();
  const scopes = useScopes();

  // The load-time guard. Only a MISSING session starts a sign-in:
  // currentUser() has already tried a silent renew, and signing in on a
  // merely expired token re-logs the user in on every visit.
  useEffect(() => {
    if (!signedIn) void signIn();
  }, [signedIn]);

  if (!signedIn) return <Splash />;

  const reachable = reachableScreens(scopes, signedIn);

  // NoAccess REPLACES the shell — returned here, above the <Routes> that
  // carry AppShell, so there is no rail to wrap it.
  if (!hasScopedReach(scopes, signedIn)) return <NoAccess appName={APP_NAME} />;

  // Safe: hasScopedReach just proved at least one scope-gated screen is here.
  const landing = (reachable.find((s) => !s.public && s.loads !== null) ?? reachable[0]).path;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to={landing} replace />} />
        {SCREEN_ROUTES.map((screen) => {
          const page = PAGE_BY_KEY[screen.key];
          // No load call: anyone with a session is in. Not used in this app —
          // every screen here loads or submits a scoped operation — but kept
          // for parity with the pattern.
          if (screen.loads === null) {
            return <Route key={screen.key} path={screen.path} element={page} />;
          }
          return (
            <Route
              key={screen.key}
              element={<RequireOperation op={screen.loads} screen={screen.label} />}
            >
              <Route path={screen.path} element={page} />
            </Route>
          );
        })}
        {/* Forbidden is INSIDE the shell: the rail the caller can use stays. */}
        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<Navigate to={landing} replace />} />
      </Route>
    </Routes>
  );
}
