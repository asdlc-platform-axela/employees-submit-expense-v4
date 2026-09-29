import { useEffect, type JSX } from "react";
import { Box, CircularProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { handleCallback } from "../authz/session";

/**
 * The ONE registered redirect URI serves both the redirect leg and the
 * silent-renew leg (a hidden iframe lands here too), so this route calls
 * `handleCallback()` — which dispatches on `request_type` — and nothing else.
 * On success, land at the app root; SignedIn resolves the rest.
 */
export function CallbackPage(): JSX.Element {
  useEffect(() => {
    void handleCallback().then(() => {
      window.location.assign("/");
    });
  }, []);

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
          Signing you in…
        </Typography>
      </Stack>
    </Box>
  );
}
