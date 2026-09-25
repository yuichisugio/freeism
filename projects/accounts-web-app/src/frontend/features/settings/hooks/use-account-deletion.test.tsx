// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "../../../lib/auth-client";
import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { stubBff } from "../stub-bff.test-helper";
import { useAccountDeletion } from "./use-account-deletion";

vi.mock("../../../lib/auth-client", () => ({ authClient: { deleteUser: vi.fn<typeof authClient.deleteUser>() } }));

const deleteUser = vi.mocked(authClient.deleteUser);

beforeEach(() => {
  deleteUser.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * 登録OAuthクライアントの一覧を読み込んだ状態のフックを返す。
 */
async function renderLoaded(onDeleted = vi.fn<() => void>()) {
  stubBff({ "GET /api/oauth-clients": () => dataResponse({ clients: [] }) });
  const hook = renderHook(() => useAccountDeletion({ onDeleted }));
  await waitFor(() => expect(hook.result.current.clients).toEqual([]));
  return hook;
}

describe("useAccountDeletion", () => {
  it("内容を確認するまでは退会できない", async () => {
    const { result } = await renderLoaded();

    expect(result.current.canDelete).toBe(false);
    await act(() => result.current.deleteAccount());
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("登録OAuthクライアントを読み込めない間は、確認しても退会できない", async () => {
    stubBff({ "GET /api/oauth-clients": () => problemResponse(500, "INTERNAL_ERROR") });
    const { result } = renderHook(() => useAccountDeletion({ onDeleted: vi.fn<() => void>() }));
    await waitFor(() => expect(result.current.isClientsLoading).toBe(false));

    act(() => result.current.changeConfirmed(true));

    expect(result.current.clientsError).not.toBeNull();
    expect(result.current.canDelete).toBe(false);
  });

  it("確認後に退会すると、deleteUserを呼び、成功したら退会後の処理を呼ぶ", async () => {
    deleteUser.mockResolvedValue({ data: { success: true }, error: null } as never);
    const onDeleted = vi.fn<() => void>();
    const { result } = await renderLoaded(onDeleted);

    act(() => result.current.changeConfirmed(true));
    expect(result.current.canDelete).toBe(true);
    await act(() => result.current.deleteAccount());

    expect(deleteUser).toHaveBeenCalledOnce();
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("退会に失敗すると、失敗を返して再実行できる", async () => {
    deleteUser.mockResolvedValue({ data: null, error: { status: 500, statusText: "Internal Server Error" } } as never);
    const onDeleted = vi.fn<() => void>();
    const { result } = await renderLoaded(onDeleted);

    act(() => result.current.changeConfirmed(true));
    await act(() => result.current.deleteAccount());

    expect(onDeleted).not.toHaveBeenCalled();
    expect(result.current.deleteError).not.toBeNull();
    expect(result.current.canDelete).toBe(true);
  });
});
