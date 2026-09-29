import { useEffect, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Chip, ListingTable, PageContent, PageTitle } from "@wso2/oxygen-ui";
import { Download } from "@wso2/oxygen-ui-icons-react";
import { expenseApi } from "../api";
import { authorizationHeader, classifyResponse, ForbiddenError } from "../authz/client";
import { formatAmount, formatDate, type ExpenseClaim } from "../lib/format";

export function ApprovedClaimsPage(): JSX.Element {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    void loadClaims();
  }, []);

  async function loadClaims(): Promise<void> {
    setLoading(true);
    try {
      const { data, error: apiError } = await expenseApi.GET("/claims", {
        params: { query: { limit: 100 } },
      });
      if (apiError) {
        setLoadError(apiError.message ?? "Could not load approved claims.");
      } else {
        setClaims(data?.data ?? []);
      }
    } catch {
      setLoadError("Could not load approved claims.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(): Promise<void> {
    setExporting(true);
    setExportError(null);

    // /claims/export answers a CSV body on success and a JSON Error on 400
    // ("nothing to export") — two different content types on one operation,
    // so this reads the raw response rather than going through the typed
    // JSON client used elsewhere on this page.
    const header = await authorizationHeader();
    const headers = new Headers();
    if (header) headers.set("Authorization", header);
    const response = await fetch("/api/claims/export", { method: "POST", headers });
    const outcome = await classifyResponse(response.status);
    setExporting(false);

    if (outcome === "forbidden") throw new ForbiddenError(response.status);
    if (outcome === "signin") return; // sign-in redirect already under way

    if (response.status === 400) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setExportError(body?.message ?? "No approved, unexported claims to export.");
      return;
    }
    if (!response.ok) {
      setExportError(`${response.status} ${response.statusText || "Export failed."}`);
      return;
    }

    const csv = await response.text();
    const dataLines = csv
      .split(/\r?\n/)
      .slice(1) // drop the header line
      .filter((line) => line.trim().length > 0);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `payroll_export_${today}.csv`;

    navigate("/approved/export-confirmation", { state: { count: dataLines.length, filename } });
  }

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Approved Claims</PageTitle.Header>
        <PageTitle.Actions>
          <Button
            variant="contained"
            startIcon={<Download size={18} />}
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            Export to Payroll
          </Button>
        </PageTitle.Actions>
      </PageTitle>

      {loadError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      ) : null}

      {exportError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {exportError}
        </Alert>
      ) : null}

      <ListingTable.Container>
        <ListingTable>
          <ListingTable.Head>
            <ListingTable.Row>
              <ListingTable.Cell>Employee</ListingTable.Cell>
              <ListingTable.Cell>Date</ListingTable.Cell>
              <ListingTable.Cell>Category</ListingTable.Cell>
              <ListingTable.Cell>Amount</ListingTable.Cell>
              <ListingTable.Cell>Exported</ListingTable.Cell>
            </ListingTable.Row>
          </ListingTable.Head>
          <ListingTable.Body>
            {claims.map((claim) => (
              <ListingTable.Row key={claim.id}>
                <ListingTable.Cell>{claim.employeeId}</ListingTable.Cell>
                <ListingTable.Cell>{formatDate(claim.submittedAt)}</ListingTable.Cell>
                <ListingTable.Cell>{claim.category}</ListingTable.Cell>
                <ListingTable.Cell>{formatAmount(claim.amount)}</ListingTable.Cell>
                <ListingTable.Cell>
                  <Chip
                    label={claim.exported ? "Yes" : "No"}
                    color={claim.exported ? "success" : "default"}
                    size="small"
                  />
                </ListingTable.Cell>
              </ListingTable.Row>
            ))}
          </ListingTable.Body>
          {!loading && claims.length === 0 ? (
            <ListingTable.EmptyState
              title="No approved claims"
              description="Approved claims will appear here once managers decide them."
            />
          ) : null}
        </ListingTable>
      </ListingTable.Container>
    </PageContent>
  );
}
