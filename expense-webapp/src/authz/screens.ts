// THIS IS THE ONLY FILE THAT KNOWS ABOUT SCREENS, and all it says about each
// one is which API operation it LOADS. The gate follows: a screen is
// reachable when the caller may call that operation, and what the operation
// needs is in the contract, projected into ./operations.gen.ts. Nothing here
// names a scope, a role or a handle, and security.json carries no screen
// table at all.
//
// Order matches wireframes.dsl's rail order across all three role flows:
// MyClaims, SubmitClaim (Employee) -> TeamClaims, ClaimDetail (Manager) ->
// ApprovedClaims, ExportConfirmation (FinanceReviewer).
//
// ClaimDetail has no per-claim GET in the contract — only the team list — so
// it loads the same "GET /me/team/claims" operation TeamClaims does, and the
// page finds the claim by id client-side from that list.
//
// ExportConfirmation renders the result ApprovedClaims's export button already
// fetched via router state; it has no load call of its own worth gating
// separately, but it still names the operation that produced what it shows,
// so a caller who could not have triggered the export cannot land on this
// screen behind a stale/typed URL either.

import { canCall } from "./core";
import { OPERATIONS, isOperationKey, type OperationKey } from "./operations.gen";

export interface ScreenRoute {
  /** A stable id the App maps to a page component. */
  readonly key: string;
  /** The wireframe's screen name, for the rail and the Forbidden copy. */
  readonly label: string;
  readonly path: string;
  /**
   * The operation this screen exists to perform: the call it renders on load
   * for a screen that reads, or the call its submit makes for a form that
   * only writes. `null` is for a screen that needs NO operation at all —
   * rare, and not used here: every screen in this app sits behind a role.
   */
  readonly loads: OperationKey | null;
  /**
   * In a flow with no `role` line: reachable before sign-in. Not used here —
   * every flow in wireframes.dsl carries a `role` line, so there is no
   * public screen in this app.
   */
  readonly public?: boolean;
}

export const SCREEN_ROUTES: readonly ScreenRoute[] = [
  { key: "my-claims", label: "My Claims", path: "/claims", loads: "GET /me/claims" },
  { key: "submit-claim", label: "Submit Claim", path: "/claims/new", loads: "POST /me/claims" },
  { key: "team-claims", label: "Team Claims", path: "/team/claims", loads: "GET /me/team/claims" },
  {
    key: "claim-detail",
    label: "Claim Detail",
    path: "/team/claims/:claimId",
    loads: "GET /me/team/claims",
  },
  { key: "approved-claims", label: "Approved Claims", path: "/approved", loads: "GET /claims" },
  {
    key: "export-confirmation",
    label: "Export Confirmation",
    path: "/approved/export-confirmation",
    loads: "POST /claims/export",
  },
];

// FAIL LOUDLY, at module load — the first render, every time, in dev, in the
// mock walk and in the deployed pod. `loads` is typed as an OperationKey, so a
// name the contract does not declare is already a type error; this catches
// the case tsc cannot, a COMMITTED operations.gen.ts that went stale against
// a contract nobody regenerated from.
for (const screen of SCREEN_ROUTES) {
  if (screen.loads !== null && !isOperationKey(screen.loads)) {
    throw new Error(
      `src/authz/screens.ts: screen "${screen.label}" loads "${screen.loads}", which ` +
        `no contract declares. Re-run \`npm run gen\`, or name the operation the ` +
        `way openapi.yaml spells it.`,
    );
  }
}

/**
 * The screens a caller can actually open, in rail order. The first one is the
 * landing screen; an EMPTY list is the NoAccess case.
 */
export function reachableScreens(
  scopes: ReadonlySet<string>,
  signedIn: boolean,
): readonly ScreenRoute[] {
  return SCREEN_ROUTES.filter((screen) => {
    if (screen.public) return true;
    if (screen.loads === null) return signedIn;
    return canCall(OPERATIONS[screen.loads], scopes, signedIn);
  });
}

/**
 * Does this caller reach anything their scopes actually earned them? Every
 * screen in this app is scope-gated (no `public`, no `loads: null`), so this
 * is equivalent to `reachableScreens(...).length > 0` here — spelled out the
 * same way as the general pattern so it still says the right thing if either
 * ever gets added later.
 */
export function hasScopedReach(scopes: ReadonlySet<string>, signedIn: boolean): boolean {
  return reachableScreens(scopes, signedIn).some(
    (screen) => !screen.public && screen.loads !== null,
  );
}
