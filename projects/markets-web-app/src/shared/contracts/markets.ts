export type AuctionStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "OPEN"
  | "CLOSING"
  | "SETTLING"
  | "SETTLED"
  | "CANCELLED"
  | "SETTLEMENT_RETRYABLE"
  | "SETTLEMENT_MANUAL_ACTION_REQUIRED";

export interface ProblemDetailsContract {
  code: string;
  requestId: string;
  status: number;
  title: string;
  type: string;
}
