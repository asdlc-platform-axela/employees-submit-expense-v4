import type { components } from "../generated/expense-api";

export type ExpenseClaim = components["schemas"]["ExpenseClaim"];
export type ClaimStatus = ExpenseClaim["status"];

export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const STATUS_COLOR: Record<ClaimStatus, "warning" | "success" | "error"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

export function statusLabel(status: ClaimStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
