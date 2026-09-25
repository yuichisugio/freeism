// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonFileMaxBytes } from "../../../../shared/constants";
import { BffError } from "../../../lib/api-client";
import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { findRequestBody, stubBff } from "../stub-bff.test-helper";
import { useBackupRestore } from "./use-backup-restore";

const validAccount = {
  metadata: {
    service: null,
    displayName: null,
    identifiers: [{ type: "url", url: "https://example.com/alice" }],
    linkedAt: null,
    verificationStatus: "unverified",
    verifications: [],
  },
  isPublic: false,
  clientVisibility: [{ clientId: "points-client", isPublic: true }],
};

const validBackup = {
  schemaVersion: 1,
  accountsOrigin: "https://accounts.freeism.app",
  accountsUserId: "user-1",
  exportedAt: "2026-09-23T00:00:00Z",
  profile: { displayName: "サンプル" },
  clientConsents: [{ clientId: "points-client", displayName: "Points", consented: true }],
  externalAccounts: [validAccount],
};

const restoreResult = { updatedAccountCount: 0, addedCandidateCount: 1, clientConsentCount: 1 };

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * 内容を持つJSONファイルを作る。
 */
function jsonFile(content: string): File {
  return new File([content], "backup.json", { type: "application/json" });
}

/**
 * ファイルを選択した状態のフックを返す。
 */
function renderWithFile(file: File, onRestored = vi.fn<() => void>()) {
  const hook = renderHook(() => useBackupRestore({ onRestored }));
  act(() => hook.result.current.selectFile(file));
  return hook;
}

/**
 * 復元APIへの送信があったかを返す。
 */
function hasRestoreRequest(fetchMock: ReturnType<typeof stubBff>): boolean {
  return findRequestBody(fetchMock, "POST /api/backup/restore") !== undefined;
}

describe("useBackupRestore", () => {
  it("ファイルを選択するまでは復元できない", () => {
    const { result } = renderHook(() => useBackupRestore({ onRestored: vi.fn<() => void>() }));

    expect(result.current.canRestore).toBe(false);
  });

  it("正しいバックアップを送信し、結果を返して復元後の処理を呼ぶ", async () => {
    const fetchMock = stubBff({ "POST /api/backup/restore": () => dataResponse(restoreResult) });
    const onRestored = vi.fn<() => void>();
    const { result } = renderWithFile(jsonFile(JSON.stringify(validBackup)), onRestored);

    await act(() => result.current.restore());

    expect(findRequestBody(fetchMock, "POST /api/backup/restore")).toEqual(validBackup);
    expect(result.current.result).toEqual(restoreResult);
    expect(result.current.issues).toEqual([]);
    expect(onRestored).toHaveBeenCalledOnce();
  });

  it("5MiBを超えるファイルは送信せずに上限超過の不備を返す", async () => {
    const fetchMock = stubBff({});
    const { result } = renderWithFile(jsonFile("a".repeat(jsonFileMaxBytes + 1)));

    await act(() => result.current.restore());

    expect(hasRestoreRequest(fetchMock)).toBe(false);
    expect(result.current.issues).toEqual([{ code: "REQUEST_TOO_LARGE", message: "", path: null }]);
  });

  it("JSONの構文が正しくないファイルは送信せずに構文の不備を返す", async () => {
    const fetchMock = stubBff({});
    const { result } = renderWithFile(jsonFile("{ not json"));

    await act(() => result.current.restore());

    expect(hasRestoreRequest(fetchMock)).toBe(false);
    expect(result.current.issues).toEqual([{ code: "INVALID_JSON", message: "", path: null }]);
  });

  it("形式の不備は送信せずに、位置と種類をまとめて返す", async () => {
    const fetchMock = stubBff({});
    const { accountsUserId: _omitted, ...withoutUserId } = validBackup;
    const invalid = {
      ...withoutUserId,
      extra: true,
      externalAccounts: [
        {
          ...validAccount,
          isPublic: "yes",
          metadata: { ...validAccount.metadata, identifiers: [{ type: "url", url: "ftp://x" }] },
        },
      ],
    };
    const { result } = renderWithFile(jsonFile(JSON.stringify(invalid)));

    await act(() => result.current.restore());

    expect(hasRestoreRequest(fetchMock)).toBe(false);
    expect(result.current.issues.map(({ code, path }) => ({ code, path }))).toEqual(
      expect.arrayContaining([
        { code: "MISSING_REQUIRED_FIELD", path: ["accountsUserId"] },
        { code: "UNKNOWN_FIELD", path: ["extra"] },
        { code: "INVALID_TYPE", path: ["externalAccounts", 0, "isPublic"] },
        { code: "INVALID_VALUE", path: ["externalAccounts", 0, "metadata", "identifiers", 0, "url"] },
      ]),
    );
    expect(result.current.issues.every((issue) => issue.message !== "")).toBe(true);
  });

  it("サーバーが返した入力不備を同じ一覧で返す", async () => {
    const serverIssue = { code: "INVALID_VALUE", message: "Client ID is not in clientConsents.", path: ["externalAccounts", 0, "clientVisibility", 0, "clientId"] };
    stubBff({
      "POST /api/backup/restore": () => problemResponse(400, "INVALID_VALUE", [serverIssue]),
    });
    const onRestored = vi.fn<() => void>();
    const { result } = renderWithFile(jsonFile(JSON.stringify(validBackup)), onRestored);

    await act(() => result.current.restore());

    expect(result.current.issues).toEqual([serverIssue]);
    expect(result.current.restoreError).toBeNull();
    expect(onRestored).not.toHaveBeenCalled();
  });

  it("URLの上限超過など不備一覧の無い失敗はエラーとして返す", async () => {
    stubBff({ "POST /api/backup/restore": () => problemResponse(409, "URL_LIMIT_REACHED") });
    const { result } = renderWithFile(jsonFile(JSON.stringify(validBackup)));

    await act(() => result.current.restore());

    expect(result.current.issues).toEqual([]);
    expect((result.current.restoreError as BffError).code).toBe("URL_LIMIT_REACHED");
  });

  it("別のファイルを選択すると前回の結果を消す", async () => {
    stubBff({});
    const { result } = renderWithFile(jsonFile("{ not json"));
    await act(() => result.current.restore());

    act(() => result.current.selectFile(jsonFile("{}")));

    expect(result.current.issues).toEqual([]);
    expect(result.current.canRestore).toBe(true);
  });
});
