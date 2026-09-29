import { useEffect, useState, type JSX } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, PageContent, PageTitle, Stack, Typography } from "@wso2/oxygen-ui";
import { ImageOff } from "@wso2/oxygen-ui-icons-react";
import { expenseApi } from "../api";
import { formatAmount, type ExpenseClaim } from "../lib/format";

// The contract has no per-claim GET for a team claim — only the list
// (GET /me/team/claims). This page fetches that list (paginating until every
// page is seen or the claim turns up) and finds the claim by id client-side.

export function ClaimDetailPage(): JSX.Element {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<ExpenseClaim | null | undefined>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const found = await findTeamClaim(claimId);
      if (live) setClaim(found ?? null);
    })();
    return () => {
      live = false;
    };
  }, [claimId]);

  async function decide(action: "approve" | "reject"): Promise<void> {
    if (!claimId) return;
    setBusy(true);
    setActionError(null);
    const { data, error } =
      action === "approve"
        ? await expenseApi.POST("/me/team/claims/{claimId}/approve", {
            params: { path: { claimId } },
          })
        : await expenseApi.POST("/me/team/claims/{claimId}/reject", {
            params: { path: { claimId } },
          });
    setBusy(false);
    if (error || !data) {
      setActionError(error?.message ?? `Could not ${action} this claim.`);
      return;
    }
    navigate("/team/claims");
  }

  if (claim === undefined) {
    return (
      <PageContent>
        <PageTitle>
          <PageTitle.Header>Claim</PageTitle.Header>
        </PageTitle>
        <Typography variant="body1" color="text.secondary">
          Loading…
        </Typography>
      </PageContent>
    );
  }

  if (claim === null) {
    return (
      <PageContent>
        <PageTitle>
          <PageTitle.Header>Claim not found</PageTitle.Header>
        </PageTitle>
        <Typography variant="body1" color="text.secondary">
          This claim is not among your direct reports&apos; claims.
        </Typography>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Claim from {claim.employeeId}</PageTitle.Header>
      </PageTitle>

      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        {actionError ? <Alert severity="error">{actionError}</Alert> : null}

        <Typography variant="h6">
          {claim.category} — {formatAmount(claim.amount)}
        </Typography>
        <Typography variant="body1">{claim.description}</Typography>

        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="overline" color="text.secondary">
            Receipt
          </Typography>
          {claim.receiptUrl ? (
            <img
              src={claim.receiptUrl}
              alt={claim.receiptFileName ?? "Receipt"}
              style={{ maxWidth: "100%", maxHeight: 320 }}
            />
          ) : (
            <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
              <ImageOff size={32} />
              <Typography variant="body2" color="text.secondary">
                {claim.receiptFileName ?? "No receipt attached"}
              </Typography>
            </Stack>
          )}
        </Box>

        {claim.status === "pending" ? (
          <Stack direction="row" justifyContent="flex-end" spacing={2}>
            <Button
              variant="outlined"
              color="error"
              disabled={busy}
              onClick={() => void decide("reject")}
            >
              Reject
            </Button>
            <Button variant="contained" disabled={busy} onClick={() => void decide("approve")}>
              Approve
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </PageContent>
  );
}

async function findTeamClaim(claimId: string | undefined): Promise<ExpenseClaim | undefined> {
  if (!claimId) return undefined;
  const limit = 100;
  let offset = 0;
  for (;;) {
    const { data } = await expenseApi.GET("/me/team/claims", { params: { query: { limit, offset } } });
    const page = data?.data ?? [];
    const found = page.find((c) => c.id === claimId);
    if (found) return found;
    const total = data?.count ?? 0;
    offset += limit;
    if (offset >= total || page.length === 0) return undefined;
  }
}
