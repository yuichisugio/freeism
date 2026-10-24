import { describe, expect, it, vi } from "vite-plus/test";

import { writeAuditLog } from "./audit-logger";

describe("writeAuditLog", () => {
  it("writes safe structured metadata for a completed operation", () => {
    const sink = vi.fn();
    writeAuditLog(
      {
        action: "ACCOUNTS_LINKS_RELEASED",
        environment: "test",
        requestId: "request-1",
        releasedLinkCount: 2,
        actorPointsUserId: "private-user",
        reason: "private reason",
        token: "secret",
      },
      sink,
    );
    expect(sink).toHaveBeenCalledOnce();
    expect(sink).toHaveBeenCalledWith({
      app: "points",
      code: "OK",
      environment: "test",
      event: "ACCOUNTS_LINKS_RELEASED",
      level: "info",
      operation: "ACCOUNTS_LINKS_RELEASED",
      outcome: "SUCCESS",
      requestId: "request-1",
      releasedLinkCount: 2,
      timestamp: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(sink.mock.calls[0]?.[0].timestamp))).toBe(false);
  });

  it("records a rejection using only the supplied stable code", () => {
    const sink = vi.fn();
    writeAuditLog(
      {
        action: "POINT_TRANSFER",
        environment: "test",
        requestId: "request-2",
        outcome: "REJECTED",
        code: "INSUFFICIENT_BALANCE",
      },
      sink,
    );
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "REJECTED",
        code: "INSUFFICIENT_BALANCE",
        level: "warn",
      }),
    );
  });

  it("does not throw or retry when the log sink fails", () => {
    const sink = vi.fn(() => {
      throw new Error("log unavailable");
    });
    expect(() =>
      writeAuditLog({ action: "FIX_COMMITTED", requestId: "request-3" }, sink),
    ).not.toThrow();
    expect(sink).toHaveBeenCalledOnce();
  });
});
