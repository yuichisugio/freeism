// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { useHydratedSession } from "./use-hydrated-session";

const authClientMock = vi.hoisted(() => ({
  useSession: vi.fn<() => { data: { user: { name: string } } | null; isPending: boolean }>(),
}));

vi.mock("./auth-client", () => ({ authClient: authClientMock }));

/**
 * セッションの状態を文字列で示す。
 */
function SessionProbe() {
  const session = useHydratedSession();
  return <p>{session.isPending ? "pending" : (session.data?.user.name ?? "signed-out")}</p>;
}

it("事前生成時とhydration中は確認中として描画し、hydrationの後にセッションを反映する", async () => {
  authClientMock.useSession.mockReturnValue({ data: null, isPending: true });
  const container = document.createElement("div");
  container.innerHTML = renderToString(<SessionProbe />);
  expect(container.textContent).toBe("pending");

  // hydrationの時点でセッションの確認が済んでいても、事前生成したHTMLと食い違わない。
  authClientMock.useSession.mockReturnValue({ data: { user: { name: "Alice" } }, isPending: false });
  const onRecoverableError = vi.fn<(error: unknown) => void>();
  await act(async () => {
    hydrateRoot(container, <SessionProbe />, { onRecoverableError });
  });

  expect(onRecoverableError).not.toHaveBeenCalled();
  expect(container.textContent).toBe("Alice");
});

it("確認を終えた後の再取得では、未ログインの表示を確認中へ戻さない", () => {
  authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
  const { result, rerender } = renderHook(() => useHydratedSession());
  expect(result.current.isPending).toBe(false);

  // Better Authは未ログインの間の再取得（フォーカス時など）で`isPending`をtrueにする。
  authClientMock.useSession.mockReturnValue({ data: null, isPending: true });
  rerender();

  expect(result.current.isPending).toBe(false);
  expect(result.current.data).toBeNull();
});
