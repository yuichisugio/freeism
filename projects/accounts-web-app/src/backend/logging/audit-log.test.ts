import { afterEach, describe, expect, it, vi } from "vitest";

import { auditLog, toErrorCategory, type AuditLogEntry } from "./audit-log";

/**
 * 監査ログの1行をJSONとして読む。
 */
function readLoggedEntry(spy: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  const [line] = spy.mock.calls[0] ?? [];
  return JSON.parse(String(line)) as Record<string, unknown>;
}

describe("auditLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("成功は構造化JSONをconsole.logへ出し、操作種別・成否・日時・方法・処理時間・件数を含む", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    auditLog({
      event: "url_verification",
      outcome: "success",
      method: "bidirectional_link",
      durationMs: 120,
      count: 2,
    });

    expect(readLoggedEntry(log)).toEqual({
      type: "audit",
      event: "url_verification",
      outcome: "success",
      at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      method: "bidirectional_link",
      durationMs: 120,
      count: 2,
    });
  });

  it("失敗はconsole.warnへ出し、エラー分類を含む", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    auditLog({ event: "user_banned", outcome: "failure", errorCategory: "FORBIDDEN" });

    expect(readLoggedEntry(warn)).toMatchObject({
      event: "user_banned",
      outcome: "failure",
      errorCategory: "FORBIDDEN",
    });
  });

  it("許可した項目以外（ユーザーID・URL・メール・IP・token・本文）は渡されても出力しない", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const entryWithPersonalData = {
      event: "display_name_updated",
      outcome: "success",
      userId: "ausr_secret",
      url: "https://example.com/alice",
      email: "alice@example.com",
      ipAddress: "203.0.113.1",
      token: "token-value",
      body: "<html>secret</html>",
    } as AuditLogEntry;

    auditLog(entryWithPersonalData);

    const line = String(log.mock.calls[0]?.[0]);
    expect(Object.keys(JSON.parse(line) as object).sort()).toEqual(
      ["at", "event", "outcome", "type"].sort(),
    );
    for (const value of ["ausr_secret", "example.com", "203.0.113.1", "token-value", "secret"]) {
      expect(line).not.toContain(value);
    }
  });
});

describe("toErrorCategory", () => {
  it.each([
    ["access_denied", "access_denied"],
    ["BANNED_USER", "BANNED_USER"],
    ["alice@example.com", "OTHER"],
    ["User ausr_x not found", "OTHER"],
    ["x".repeat(65), "OTHER"],
    [undefined, "OTHER"],
  ])("%sを%sにする", (value, expected) => {
    expect(toErrorCategory(value)).toBe(expected);
  });
});
