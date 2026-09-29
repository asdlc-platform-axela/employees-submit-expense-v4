import { http, HttpResponse } from "msw";
import type { components } from "../src/generated/expense-api";

type ExpenseClaim = components["schemas"]["ExpenseClaim"];
type NewExpenseClaim = components["schemas"]["NewExpenseClaim"];

// The caller this mock speaks for. State lives in module scope (page-context,
// reset on every full page load — see react-webapp's mock-mode reference) so
// a create/approve/export in this run shows up in the next list read, and
// reverts on reload.
//
// No scope check anywhere below: whether an operation may be called at all is
// mock/authz/gateway.ts's answer, read from the contract, exactly as it is
// the API gateway's answer in a cell. What each handler owes is its path's
// reach — /me/claims answers the Employee persona's own rows, /me/team/claims
// the Manager persona's reports, /claims every row.

const EMPLOYEE_ID = "mock-employee"; // the signed-in Employee persona
const MANAGER_REPORTS = ["priya", "sam"]; // the signed-in Manager's direct reports

let nextId = 100;

let claims: ExpenseClaim[] = [
  // The Employee persona's own claims — mirrors wireframes.dsl's MyClaims rows.
  {
    id: "c1",
    employeeId: EMPLOYEE_ID,
    amount: 240.0,
    category: "Travel",
    description: "Round-trip flight and taxi to the client site.",
    status: "pending",
    submittedAt: "2026-09-12T09:00:00.000Z",
    decidedAt: null,
    decidedBy: null,
    exported: false,
    exportedAt: null,
  },
  {
    id: "c2",
    employeeId: EMPLOYEE_ID,
    amount: 38.5,
    category: "Meals",
    description: "Team lunch with the Chicago client.",
    status: "approved",
    submittedAt: "2026-09-03T12:00:00.000Z",
    decidedAt: "2026-09-04T10:00:00.000Z",
    decidedBy: "mock-manager",
    exported: false,
    exportedAt: null,
  },
  {
    id: "c3",
    employeeId: EMPLOYEE_ID,
    amount: 19.99,
    category: "Supplies",
    description: "Notebook and pens for the site visit.",
    status: "rejected",
    submittedAt: "2026-08-28T08:00:00.000Z",
    decidedAt: "2026-08-29T09:00:00.000Z",
    decidedBy: "mock-manager",
    exported: false,
    exportedAt: null,
  },

  // The Manager persona's direct reports — mirrors wireframes.dsl's
  // TeamClaims rows (and ClaimDetail's "Claim from Priya" / Travel / $240).
  {
    id: "t1",
    employeeId: "priya",
    amount: 240.0,
    category: "Travel",
    description: "Client site visit, round-trip mileage and parking.",
    status: "pending",
    submittedAt: "2026-09-12T09:00:00.000Z",
    decidedAt: null,
    decidedBy: null,
    exported: false,
    exportedAt: null,
  },
  {
    id: "t2",
    employeeId: "sam",
    amount: 52.0,
    category: "Meals",
    description: "Dinner with a prospective vendor.",
    status: "pending",
    submittedAt: "2026-09-10T18:00:00.000Z",
    decidedAt: null,
    decidedBy: null,
    exported: false,
    exportedAt: null,
  },
  {
    id: "t3",
    employeeId: "priya",
    amount: 38.5,
    category: "Meals",
    description: "Lunch during the quarterly review.",
    status: "approved",
    submittedAt: "2026-09-03T12:00:00.000Z",
    decidedAt: "2026-09-04T10:00:00.000Z",
    decidedBy: "mock-manager",
    exported: false,
    exportedAt: null,
  },
  {
    id: "t4",
    employeeId: "priya",
    amount: 19.99,
    category: "Supplies",
    description: "Personal notebook — not reimbursable.",
    status: "rejected",
    submittedAt: "2026-08-28T08:00:00.000Z",
    decidedAt: "2026-08-29T09:00:00.000Z",
    decidedBy: "mock-manager",
    exported: false,
    exportedAt: null,
  },
  {
    id: "t5",
    employeeId: "sam",
    amount: 180.0,
    category: "Travel",
    description: "Mileage to the regional office.",
    status: "approved",
    submittedAt: "2026-08-20T09:00:00.000Z",
    decidedAt: "2026-08-21T09:00:00.000Z",
    decidedBy: "mock-manager",
    exported: false,
    exportedAt: null,
  },
  {
    id: "t6",
    employeeId: "priya",
    amount: 25.0,
    category: "Supplies",
    description: "Printer paper and toner.",
    status: "approved",
    submittedAt: "2026-08-01T09:00:00.000Z",
    decidedAt: "2026-08-02T09:00:00.000Z",
    decidedBy: "mock-manager",
    exported: true,
    exportedAt: "2026-08-05T09:00:00.000Z",
  },
];

function paginate(rows: ExpenseClaim[], url: URL) {
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const status = url.searchParams.get("status");
  const filtered = status ? rows.filter((c) => c.status === status) : rows;
  const page = filtered.slice(offset, offset + limit);
  const next = offset + limit < filtered.length ? `?limit=${limit}&offset=${offset + limit}` : null;
  const previous = offset > 0 ? `?limit=${limit}&offset=${Math.max(0, offset - limit)}` : null;
  return { count: filtered.length, next, previous, data: page };
}

export const handlers = [
  // The caller's own claims — no `claims:read` check: a caller who does not
  // hold it was refused by mock/authz/gateway.ts and never reached here.
  http.get("/api/me/claims", ({ request }) => {
    const url = new URL(request.url);
    const mine = claims.filter((c) => c.employeeId === EMPLOYEE_ID);
    return HttpResponse.json(paginate(mine, url));
  }),

  http.post("/api/me/claims", async ({ request }) => {
    const body = (await request.json()) as NewExpenseClaim;
    if (!body?.amount || !body?.category || !body?.description) {
      return HttpResponse.json(
        { code: 400, message: "Missing or invalid claim fields" },
        { status: 400 },
      );
    }
    const created: ExpenseClaim = {
      id: `c${nextId++}`,
      employeeId: EMPLOYEE_ID,
      amount: body.amount,
      category: body.category,
      description: body.description,
      receiptFileName: body.receiptFileName,
      receiptContentType: body.receiptContentType,
      receiptUrl: body.receiptUrl,
      status: "pending",
      submittedAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
      exported: false,
      exportedAt: null,
    };
    claims = [created, ...claims];
    return HttpResponse.json(created, { status: 201 });
  }),

  // Claims of the caller's direct reports — a different reach than /me/claims,
  // guarded by claims:read-team. The manager persona's reports are fixed
  // (priya, sam); nothing here re-checks the scope.
  http.get("/api/me/team/claims", ({ request }) => {
    const url = new URL(request.url);
    const team = claims.filter((c) => MANAGER_REPORTS.includes(c.employeeId));
    return HttpResponse.json(paginate(team, url));
  }),

  http.post("/api/me/team/claims/:claimId/approve", ({ params }) => decide(params.claimId, "approved")),
  http.post("/api/me/team/claims/:claimId/reject", ({ params }) => decide(params.claimId, "rejected")),

  // Every approved claim, across the organization — claims:read-all. Nothing
  // to decide here either: whoever reached it may see it all.
  http.get("/api/claims", ({ request }) => {
    const url = new URL(request.url);
    const exportedParam = url.searchParams.get("exported");
    let approved = claims.filter((c) => c.status === "approved");
    if (exportedParam !== null) {
      const wantExported = exportedParam === "true";
      approved = approved.filter((c) => c.exported === wantExported);
    }
    return HttpResponse.json(paginate(approved, url));
  }),

  http.post("/api/claims/export", () => {
    const toExport = claims.filter((c) => c.status === "approved" && !c.exported);
    if (toExport.length === 0) {
      return HttpResponse.json(
        { code: 400, message: "No approved, unexported claims to export" },
        { status: 400 },
      );
    }
    const exportedAt = new Date().toISOString();
    const ids = new Set(toExport.map((c) => c.id));
    claims = claims.map((c) => (ids.has(c.id) ? { ...c, exported: true, exportedAt } : c));

    const header = "id,employeeId,category,amount,description,submittedAt,decidedAt,decidedBy";
    const rows = toExport.map((c) =>
      [c.id, c.employeeId, c.category, c.amount, JSON.stringify(c.description), c.submittedAt, c.decidedAt ?? "", c.decidedBy ?? ""].join(
        ",",
      ),
    );
    const csv = [header, ...rows].join("\n") + "\n";
    return new HttpResponse(csv, { status: 200, headers: { "Content-Type": "text/csv" } });
  }),
];

function decide(claimId: string | readonly string[] | undefined, status: "approved" | "rejected") {
  const id = Array.isArray(claimId) ? claimId[0] : (claimId as string | undefined);
  if (!id) {
    return HttpResponse.json(
      { code: 404, message: "No such pending claim of a direct report" },
      { status: 404 },
    );
  }
  const claim = claims.find((c) => c.id === id && MANAGER_REPORTS.includes(c.employeeId));
  if (!claim) {
    return HttpResponse.json(
      { code: 404, message: "No such pending claim of a direct report" },
      { status: 404 },
    );
  }
  if (claim.status !== "pending") {
    return HttpResponse.json({ code: 400, message: "Claim is not pending" }, { status: 400 });
  }
  const decided: ExpenseClaim = {
    ...claim,
    status,
    decidedAt: new Date().toISOString(),
    decidedBy: "mock-manager",
  };
  claims = claims.map((c) => (c.id === id ? decided : c));
  return HttpResponse.json(decided);
}
