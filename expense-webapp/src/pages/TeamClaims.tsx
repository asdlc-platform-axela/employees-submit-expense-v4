import { useEffect, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Chip, ListingTable, PageContent, PageTitle } from "@wso2/oxygen-ui";
import { expenseApi } from "../api";
import { formatAmount, formatDate, statusLabel, STATUS_COLOR, type ExpenseClaim } from "../lib/format";

// Contract gap: ExpenseClaim carries only `employeeId`, an opaque id — there
// is no employee directory operation anywhere in expense-api's openapi.yaml
// to resolve it to a display name. The Employee column below renders the id
// verbatim rather than inventing a lookup the contract does not offer.

export function TeamClaimsPage(): JSX.Element {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { data, error: apiError } = await expenseApi.GET("/me/team/claims", {
          params: { query: { limit: 100 } },
        });
        if (!live) return;
        if (apiError) {
          setError(apiError.message ?? "Could not load team claims.");
        } else {
          setClaims(data?.data ?? []);
        }
      } catch {
        if (live) setError("Could not load team claims.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Team Claims</PageTitle.Header>
      </PageTitle>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
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
              <ListingTable.Cell>Status</ListingTable.Cell>
            </ListingTable.Row>
          </ListingTable.Head>
          <ListingTable.Body>
            {claims.map((claim) => (
              <ListingTable.Row
                key={claim.id}
                clickable
                onClick={() => navigate(`/team/claims/${claim.id}`)}
              >
                <ListingTable.Cell>{claim.employeeId}</ListingTable.Cell>
                <ListingTable.Cell>{formatDate(claim.submittedAt)}</ListingTable.Cell>
                <ListingTable.Cell>{claim.category}</ListingTable.Cell>
                <ListingTable.Cell>{formatAmount(claim.amount)}</ListingTable.Cell>
                <ListingTable.Cell>
                  <Chip
                    label={statusLabel(claim.status)}
                    color={STATUS_COLOR[claim.status]}
                    size="small"
                  />
                </ListingTable.Cell>
              </ListingTable.Row>
            ))}
          </ListingTable.Body>
          {!loading && claims.length === 0 ? (
            <ListingTable.EmptyState
              title="No team claims"
              description="Nothing from your direct reports yet."
            />
          ) : null}
        </ListingTable>
      </ListingTable.Container>
    </PageContent>
  );
}
