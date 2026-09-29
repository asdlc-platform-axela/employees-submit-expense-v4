import { useEffect, useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Chip,
  ListingTable,
  PageContent,
  PageTitle,
  Button,
} from "@wso2/oxygen-ui";
import { Plus } from "@wso2/oxygen-ui-icons-react";
import { expenseApi } from "../api";
import { formatAmount, formatDate, statusLabel, STATUS_COLOR, type ExpenseClaim } from "../lib/format";

export function MyClaimsPage(): JSX.Element {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { data, error: apiError } = await expenseApi.GET("/me/claims", {
          params: { query: { limit: 100 } },
        });
        if (!live) return;
        if (apiError) {
          setError(apiError.message ?? "Could not load your claims.");
        } else {
          setClaims(data?.data ?? []);
        }
      } catch {
        if (live) setError("Could not load your claims.");
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
        <PageTitle.Header>My Claims</PageTitle.Header>
        <PageTitle.Actions>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => navigate("/claims/new")}>
            Submit Claim
          </Button>
        </PageTitle.Actions>
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
              <ListingTable.Cell>Date</ListingTable.Cell>
              <ListingTable.Cell>Category</ListingTable.Cell>
              <ListingTable.Cell>Amount</ListingTable.Cell>
              <ListingTable.Cell>Status</ListingTable.Cell>
            </ListingTable.Row>
          </ListingTable.Head>
          <ListingTable.Body>
            {claims.map((claim) => (
              <ListingTable.Row key={claim.id}>
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
              title="No claims yet"
              description="Submit an expense claim to see it here."
            />
          ) : null}
        </ListingTable>
      </ListingTable.Container>
    </PageContent>
  );
}
