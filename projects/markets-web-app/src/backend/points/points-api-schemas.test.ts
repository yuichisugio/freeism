import { describe, expect, it } from "vite-plus/test";
import * as v from "valibot";

import {
  captureSettlementResponseSchema,
  createReservationResponseSchema,
} from "./points-api-schemas";

const hash = `sha256:${"a".repeat(64)}`;
const instant = "2026-07-13T00:00:00.000Z";

describe("Points API response schemas", () => {
  it("fills missing reservation components and preserves extra receipt fields", () => {
    const response = {
      data: {
        pointReservationId: "pr_1",
        reservationKey: "reservation-1",
        status: "ACTIVE",
        planHash: hash,
        vectorHash: hash,
        expiresAt: instant,
        futureReceiptField: "retained",
      },
      meta: { requestId: "req_1" },
    };

    expect(v.parse(createReservationResponseSchema, response).data).toEqual({
      ...response.data,
      components: [],
    });

    expect(
      v.parse(createReservationResponseSchema, {
        ...response,
        data: {
          ...response.data,
          components: [
            {
              evaluationCriterionId: "criterion_1",
              evaluationCriterionRevisionId: "revision_1",
              amountScaled: "1",
              futureComponentField: "retained",
            },
          ],
        },
      }).data.components,
    ).toEqual([
      {
        evaluationCriterionId: "criterion_1",
        evaluationCriterionRevisionId: "revision_1",
        amountScaled: "1",
        futureComponentField: "retained",
      },
    ]);
  });

  it("preserves extra captured reservation fields while rejecting unknown envelope fields", () => {
    const response = {
      data: {
        captureReceiptId: "cr_1",
        settlementId: "settlement_1",
        auctionId: "auction_1",
        planHash: hash,
        status: "CAPTURED",
        reservations: [
          {
            pointReservationId: "pr_1",
            vectorHash: hash,
            status: "CAPTURED",
            futureReservationField: "retained",
          },
        ],
        capturedAt: instant,
        contentHash: hash,
      },
      meta: { requestId: "req_1" },
    };

    expect(v.parse(captureSettlementResponseSchema, response).data.reservations[0]).toEqual(
      response.data.reservations[0],
    );
    expect(v.safeParse(captureSettlementResponseSchema, { ...response, extra: true }).success).toBe(
      false,
    );
  });
});
