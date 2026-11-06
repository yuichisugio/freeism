import { describe, expect, it } from "vitest";
import * as v from "valibot";

import {
  createLinkAttemptRequestSchema,
  finalizeLinkAttemptRequestSchema,
  reservationStatusRequestSchema,
} from "./points-api-schemas";

const hash = `sha256:${"a".repeat(64)}`;
const linkAttemptBody = {
  marketsUserId: "user-1",
  stateHash: hash,
  pkceChallenge: "a".repeat(43),
  redirectUri: "https://markets.example/callback",
  requestedScopes: ["openid", "profile"],
  expiresAt: "2026-09-28T00:00:00Z",
  returnUrlHash: hash,
};

describe("Points API request schemas", () => {
  it("accepts a valid link attempt and rejects unknown fields or duplicate scopes", () => {
    expect(v.safeParse(createLinkAttemptRequestSchema, linkAttemptBody).success).toBe(true);
    expect(
      v.safeParse(createLinkAttemptRequestSchema, { ...linkAttemptBody, extra: true }).success,
    ).toBe(false);
    expect(
      v.safeParse(createLinkAttemptRequestSchema, {
        ...linkAttemptBody,
        requestedScopes: ["openid", "openid"],
      }).success,
    ).toBe(false);
  });

  it("keeps finalization variants strict", () => {
    const cancel = {
      outcome: "CANCEL",
      marketsPointsConnectionId: "connection-1",
      attemptPayloadHash: hash,
    };
    expect(v.safeParse(finalizeLinkAttemptRequestSchema, cancel).success).toBe(true);
    expect(
      v.safeParse(finalizeLinkAttemptRequestSchema, { ...cancel, pointsSubject: "user-1" }).success,
    ).toBe(false);
  });

  it("rejects duplicate reservation IDs and fields from the other lookup variant", () => {
    const byId = { lookupBy: "POINT_RESERVATION_ID", pointReservationIds: ["reservation-1"] };
    expect(v.safeParse(reservationStatusRequestSchema, byId).success).toBe(true);
    expect(
      v.safeParse(reservationStatusRequestSchema, {
        ...byId,
        pointReservationIds: ["reservation-1", "reservation-1"],
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(reservationStatusRequestSchema, { ...byId, reservationKeys: ["key-1"] }).success,
    ).toBe(false);
  });
});
