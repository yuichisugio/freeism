// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "../../../lib/auth-client";
import { useAccountDeletion } from "./use-account-deletion";

vi.mock("../../../lib/auth-client", () => ({ authClient: { deleteUser: vi.fn<typeof authClient.deleteUser>() } }));

const deleteUser = vi.mocked(authClient.deleteUser);

beforeEach(() => {
  deleteUser.mockReset();
});

/**
 * 退会の確認を開いた状態のフックを返す。
 */
function renderOpened(onDeleted = vi.fn<() => void>()) {
  const hook = renderHook(() => useAccountDeletion({ onDeleted }));
  act(() => hook.result.current.openDialog());
  return hook;
}

describe("useAccountDeletion", () => {
  it.each(["", "delete", "DELETE ", "DELET"])("入力が「DELETE」と完全一致しない（%j）間は退会できない", async (text) => {
    const { result } = renderOpened();

    act(() => result.current.changeConfirmationText(text));

    expect(result.current.canDelete).toBe(false);
    await act(() => result.current.deleteAccount());
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("「DELETE」を入力して退会すると、deleteUserを呼び、成功したら退会後の処理を呼ぶ", async () => {
    deleteUser.mockResolvedValue({ data: { success: true }, error: null } as never);
    const onDeleted = vi.fn<() => void>();
    const { result } = renderOpened(onDeleted);

    act(() => result.current.changeConfirmationText("DELETE"));
    expect(result.current.canDelete).toBe(true);
    await act(() => result.current.deleteAccount());

    expect(deleteUser).toHaveBeenCalledOnce();
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("退会に失敗すると、失敗を返して再実行できる", async () => {
    deleteUser.mockResolvedValue({ data: null, error: { status: 500, statusText: "Internal Server Error" } } as never);
    const onDeleted = vi.fn<() => void>();
    const { result } = renderOpened(onDeleted);

    act(() => result.current.changeConfirmationText("DELETE"));
    await act(() => result.current.deleteAccount());

    expect(onDeleted).not.toHaveBeenCalled();
    expect(result.current.deleteError).not.toBeNull();
    expect(result.current.canDelete).toBe(true);
  });

  it("確認を閉じると入力と失敗を空に戻す", async () => {
    deleteUser.mockResolvedValue({ data: null, error: { status: 500, statusText: "Internal Server Error" } } as never);
    const { result } = renderOpened();
    act(() => result.current.changeConfirmationText("DELETE"));
    await act(() => result.current.deleteAccount());

    act(() => result.current.closeDialog());

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.confirmationText).toBe("");
    expect(result.current.deleteError).toBeNull();
  });
});
