import { describe, expect, it } from "vitest";

import { jsonFileMaxBytes } from "../../../shared/constants";
import type { Backup } from "../../../shared/schemas/backup-schema";
import { ProblemError } from "../../problem-details";
import { serializeBackup } from "./export-backup";

/**
 * 直列化した内容の容量が指定したbyte数になるバックアップを作る。
 * 表示名は日本語（1文字3 bytes）を含め、文字数ではなくUTF-8のbyte数で数えることを確かめる。
 */
function createBackupOfBytes(bytes: number): Backup {
  const backup: Backup = {
    schemaVersion: 1,
    accountsOrigin: "https://accounts.freeism.app",
    accountsUserId: "",
    exportedAt: "2026-09-26T00:00:00.000Z",
    profile: { displayName: "表示名" },
    clientConsents: [],
    externalAccounts: [],
  };
  const baseBytes = new TextEncoder().encode(JSON.stringify(backup, null, 2)).length;
  return { ...backup, accountsUserId: "a".repeat(bytes - baseBytes) };
}

describe("serializeBackup", () => {
  it("5MiBちょうどの内容を出力する", () => {
    const json = serializeBackup(createBackupOfBytes(jsonFileMaxBytes));
    expect(new TextEncoder().encode(json).length).toBe(jsonFileMaxBytes);
  });

  it("5MiBを1 byte超える内容は413 `EXPORT_TOO_LARGE`にする", () => {
    expect(() => serializeBackup(createBackupOfBytes(jsonFileMaxBytes + 1))).toThrow(
      expect.objectContaining({ status: 413, code: "EXPORT_TOO_LARGE" }) as ProblemError,
    );
  });
});
