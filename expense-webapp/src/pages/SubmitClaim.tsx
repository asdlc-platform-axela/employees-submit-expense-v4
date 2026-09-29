import { useRef, useState, type JSX, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Form,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { Paperclip } from "@wso2/oxygen-ui-icons-react";
import { expenseApi } from "../api";
import type { components } from "../generated/expense-api";

type Category = components["schemas"]["NewExpenseClaim"]["category"];

const CATEGORIES: Category[] = ["Travel", "Meals", "Lodging", "Supplies", "Other"];

export function SubmitClaimPage(): JSX.Element {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Travel");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount)) {
      setError("Enter a valid amount.");
      return;
    }
    if (!description.trim()) {
      setError("Enter a description.");
      return;
    }

    setSubmitting(true);
    // Known contract gap: NewExpenseClaim carries receiptFileName /
    // receiptContentType / receiptUrl, but expense-api has no upload endpoint
    // anywhere in its openapi.yaml. We send the selected file's name and MIME
    // type and leave receiptUrl unset — there is nowhere to upload the bytes
    // to, and inventing an upload call is exactly what this app must not do.
    const { data, error: apiError } = await expenseApi.POST("/me/claims", {
      body: {
        amount: parsedAmount,
        category,
        description: description.trim(),
        ...(receipt
          ? { receiptFileName: receipt.name, receiptContentType: receipt.type || undefined }
          : {}),
      },
    });
    setSubmitting(false);

    if (apiError || !data) {
      setError(apiError?.message ?? "Could not submit the claim. Check the fields and try again.");
      return;
    }
    navigate("/claims");
  }

  return (
    <Box sx={{ p: 3, maxWidth: 640 }}>
      <Typography variant="h5" component="h1" sx={{ mb: 3 }}>
        Submit Claim
      </Typography>

      <Form.Section>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <Stack spacing={3}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            <TextField
              label="Amount"
              type="number"
              inputProps={{ step: "0.01", min: "0" }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              fullWidth
            />

            <TextField
              select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              fullWidth
            >
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Description"
              multiline
              minRows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              fullWidth
            />

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Receipt file
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
              />
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="outlined"
                  startIcon={<Paperclip size={18} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {receipt ? receipt.name : "No file selected"}
                </Typography>
              </Stack>
            </Stack>

            <Stack direction="row" justifyContent="flex-end" spacing={2}>
              <Button variant="outlined" onClick={() => navigate("/claims")} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={submitting}>
                Submit
              </Button>
            </Stack>
          </Stack>
        </form>
      </Form.Section>
    </Box>
  );
}
