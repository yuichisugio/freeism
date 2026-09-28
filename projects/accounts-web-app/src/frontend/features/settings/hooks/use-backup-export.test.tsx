// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BffError } from "../../../lib/api-client";
import { problemResponse } from "../../../test/bff-responses";
import { stubBff } from "../stub-bff.test-helper";
import { useBackupExport } from "./use-backup-export";

let downloadedFileNames: string[] = [];

beforeEach(() => {
  downloadedFileNames = [];
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:backup");
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloadedFileNames.push(this.download);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useBackupExport", () => {
  it("表示時にはBFFを呼ばない", () => {
    const fetchMock = stubBff({});

    renderHook(() => useBackupExport());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("出力するとJSONファイルを応答のファイル名でダウンロードさせる", async () => {
    stubBff({
      "GET /api/backup": () =>
        new Response("{}", {
          headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="accounts-user-1.json"' },
        }),
    });
    const { result } = renderHook(() => useBackupExport());

    await act(() => result.current.exportBackup());

    expect(downloadedFileNames).toEqual(["accounts-user-1.json"]);
    expect(result.current.isExported).toBe(true);
    expect(result.current.exportError).toBeNull();
  });

  it("応答にファイル名が無ければ既定のファイル名にする", async () => {
    stubBff({
      "GET /api/backup": () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
    });
    const { result } = renderHook(() => useBackupExport());

    await act(() => result.current.exportBackup());

    expect(downloadedFileNames).toEqual(["accounts-backup.json"]);
  });

  it("上限超過で出力できない場合は、ダウンロードせずに失敗を返す", async () => {
    stubBff({ "GET /api/backup": () => problemResponse(413, "EXPORT_TOO_LARGE") });
    const { result } = renderHook(() => useBackupExport());

    await act(() => result.current.exportBackup());

    expect(downloadedFileNames).toEqual([]);
    expect(result.current.isExported).toBe(false);
    expect((result.current.exportError as BffError).code).toBe("EXPORT_TOO_LARGE");
  });
});
