export interface AccountReconciliationMismatch {
  actualBalance: number | null;
  actualEvaluationTotal: number | null;
  evaluationCriterionId: string;
  expectedBalance: number;
  expectedEvaluationTotal: number;
  pointsUserId: string;
}

export interface ActiveReservationTotal {
  amountScaled: number;
  evaluationCriterionId: string;
  pointsUserId: string;
  reservationCount: number;
}

export interface ClaimReconciliationMismatch {
  claimed: boolean;
  ledgered: boolean;
  unclaimedFixEntryId: string;
}

export interface PointsReconciliationReport {
  accountMismatches: AccountReconciliationMismatch[];
  activeReservationTotals: ActiveReservationTotal[];
  checkedAt: string;
  claimMismatches: ClaimReconciliationMismatch[];
  claimSummary: {
    claimedCount: number;
    unclaimedCount: number;
  };
  consistent: boolean;
}

export function createPointsReconciliationReport(
  input: Omit<PointsReconciliationReport, "consistent">,
): PointsReconciliationReport {
  return {
    ...input,
    consistent: input.accountMismatches.length === 0 && input.claimMismatches.length === 0,
  };
}
