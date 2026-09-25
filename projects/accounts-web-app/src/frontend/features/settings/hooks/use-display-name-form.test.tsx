// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BffError } from "../../../lib/api-client";
import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { findRequestBody, stubBff } from "../stub-bff.test-helper";
import { useDisplayNameForm } from "./use-display-name-form";

const me = { accountsUserId: "user-1", displayName: "仮ユーザー", profileUrl: "https://accounts.example/profiles/user-1" };

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * 保存済みの表示名を読み込んだ状態のフックを返す。
 */
async function renderLoadedForm() {
  const hook = renderHook(() => useDisplayNameForm());
  await waitFor(() => expect(hook.result.current.me).not.toBeNull());
  return hook;
}

describe("useDisplayNameForm", () => {
  it("読み込んだ表示名を表示し、未変更の間は保存できない", async () => {
    stubBff({ "GET /api/me": () => dataResponse(me) });

    const { result } = await renderLoadedForm();

    expect(result.current.displayName).toBe("仮ユーザー");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.canSave).toBe(false);
  });

  it("空白だけの表示名は入力不備として保存できない", async () => {
    stubBff({ "GET /api/me": () => dataResponse(me) });
    const { result } = await renderLoadedForm();

    act(() => result.current.changeDisplayName("   "));

    expect(result.current.isDirty).toBe(true);
    expect(result.current.issue).toBe("required");
    expect(result.current.canSave).toBe(false);
  });

  it("51文字の表示名は入力不備として保存できず、絵文字は見た目の文字数で数える", async () => {
    stubBff({ "GET /api/me": () => dataResponse(me) });
    const { result } = await renderLoadedForm();

    act(() => result.current.changeDisplayName("あ".repeat(51)));
    expect(result.current.issue).toBe("tooLong");
    expect(result.current.canSave).toBe(false);

    act(() => result.current.changeDisplayName("👨‍👩‍👧".repeat(50)));
    expect(result.current.issue).toBeNull();
    expect(result.current.canSave).toBe(true);
  });

  it("保存に成功すると、前後の空白を除いた表示名を送り、未保存の変更が無くなる", async () => {
    const fetchMock = stubBff({
      "GET /api/me": () => dataResponse(me),
      "PATCH /api/profile": () => dataResponse({ ...me, displayName: "Alice" }),
    });
    const { result } = await renderLoadedForm();

    act(() => result.current.changeDisplayName("  Alice  "));
    await act(() => result.current.save());

    expect(findRequestBody(fetchMock, "PATCH /api/profile")).toEqual({ displayName: "Alice" });
    expect(result.current.displayName).toBe("Alice");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSaved).toBe(true);
  });

  it("保存に失敗すると、入力中の表示名と失敗を保持する", async () => {
    stubBff({
      "GET /api/me": () => dataResponse(me),
      "PATCH /api/profile": () => problemResponse(500, "INTERNAL_ERROR"),
    });
    const { result } = await renderLoadedForm();

    act(() => result.current.changeDisplayName("Alice"));
    await act(() => result.current.save());

    expect(result.current.displayName).toBe("Alice");
    expect(result.current.isDirty).toBe(true);
    expect(result.current.isSaved).toBe(false);
    expect(result.current.saveError).toBeInstanceOf(BffError);
  });

  it("読み込みに失敗すると、失敗を返し保存できない", async () => {
    stubBff({ "GET /api/me": () => problemResponse(401, "UNAUTHORIZED") });

    const { result } = renderHook(() => useDisplayNameForm());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBeInstanceOf(BffError);
    expect(result.current.canSave).toBe(false);
  });
});
