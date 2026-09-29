import type { JSX } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, PageContent, PageTitle, Stack, Typography } from "@wso2/oxygen-ui";

interface ExportState {
  count: number;
  filename: string;
}

function isExportState(value: unknown): value is ExportState {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as ExportState).count === "number" &&
    typeof (value as ExportState).filename === "string"
  );
}

export function ExportConfirmationPage(): JSX.Element {
  const navigate = useNavigate();
  const { state } = useLocation();

  // Nothing to re-fetch — the export already happened. A direct navigation
  // here with no state (a refresh, a typed URL) has nothing to confirm, so
  // send the visitor back to the screen that can trigger a new export.
  if (!isExportState(state)) {
    return <Navigate to="/approved" replace />;
  }

  return (
    <PageContent>
      <PageTitle>
        <PageTitle.Header>Export Complete</PageTitle.Header>
      </PageTitle>

      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        <Typography variant="body1">
          {state.count} claim{state.count === 1 ? "" : "s"} exported to {state.filename}
        </Typography>

        <Stack direction="row" justifyContent="flex-end">
          <Button variant="contained" onClick={() => navigate("/approved")}>
            Back to Approved Claims
          </Button>
        </Stack>
      </Stack>
    </PageContent>
  );
}
