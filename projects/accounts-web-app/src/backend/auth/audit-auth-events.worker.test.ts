import { exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { testOrigin, tokenEndpoint } from "../../../test/oauth-client-test-helpers";

/**
 * 監査ログの出力を読む（Better Authの標準のログ出力は除く）。
 */
function readAuditLines(spy: { mock: { calls: unknown[][] } }): Record<string, unknown>[] {
  return spy.mock.calls
    .map(([line]) => String(line))
    .filter((line) => line.startsWith('{"type":"audit"'))
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("Better Authの標準エンドポイントの監査", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("OAuthのcallbackの拒否を、Providerとエラー分類だけで記録する", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await exports.default.fetch(
      `${testOrigin}/api/auth/callback/google?error=access_denied`,
      { redirect: "manual" },
    );

    expect(response.status).toBe(302);
    expect(readAuditLines(warn)).toContainEqual(
      expect.objectContaining({
        event: "oauth_callback",
        outcome: "failure",
        method: "google",
        errorCategory: "state_not_found",
      }),
    );
  });

  it("token endpointでの拒否（refresh tokenの要求を含む）をエラー分類で記録する", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await exports.default.fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: "secret-token" }),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    const auditLines = readAuditLines(warn);
    expect(auditLines).toContainEqual(
      expect.objectContaining({ event: "oauth_token_rejected", outcome: "failure" }),
    );
    expect(JSON.stringify(auditLines)).not.toContain("secret-token");
  });
});
