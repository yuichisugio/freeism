import { describe, expect, it } from "vite-plus/test";

import { commitAuctionImport } from "./commit-auction-import";

describe("Auction import provider binding", () => {
  it("rejects committing a preview under another provider before any repository call", async () => {
    await expect(
      commitAuctionImport(
        {
          providerId: "provider-b",
          preview: {
            providerId: "provider-a",
            auctionCommandId: "acmd_test",
            auctionCommandHash: `sha256:${"a".repeat(64)}`,
            fileHash: `sha256:${"b".repeat(64)}`,
            rows: [],
          },
          actor: { accountId: "account", marketsUserId: "user", providerId: "google" },
          idempotencyKey: "key",
          sellerIdentitySnapshot: {},
        },
        {} as never,
      ),
    ).rejects.toMatchObject({ code: "POINTS_PROVIDER_MISMATCH" });
  });
});
