// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { createAccountLinks, createLinkedAccount, createLinkedClient } from "../lib/account-links-fixtures";
import { useAccountLinks } from "./use-account-links";

const links = createAccountLinks({
  accounts: [createLinkedAccount({ id: "eac_1" })],
  clients: [createLinkedClient({ clientId: "points" })],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAccountLinks", () => {
  it("一覧を取得して表を組み立てる", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => dataResponse(links));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAccountLinks());

    expect(result.current.loadState.status).toBe("loading");
    await waitFor(() => expect(result.current.loadState.status).toBe("ready"));
    expect(result.current.table?.rows.map((row) => row.account.id)).toEqual(["eac_1"]);
    expect(fetchMock).toHaveBeenCalledWith("/api/account-links", expect.objectContaining({ method: "GET" }));
  });

  it("取得に失敗した場合は失敗を保持する", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => problemResponse(401, "UNAUTHORIZED")));

    const { result } = renderHook(() => useAccountLinks());

    await waitFor(() => expect(result.current.loadState.status).toBe("error"));
  });

  it("編集すると保存でき、保存後は編集を破棄して再取得する", async () => {
    const saved = createAccountLinks({
      accounts: [createLinkedAccount({ id: "eac_1", visibility: { points: true } })],
      clients: [createLinkedClient({ clientId: "points" })],
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(dataResponse(links))
      .mockResolvedValueOnce(dataResponse({ ok: true }))
      .mockResolvedValueOnce(dataResponse(saved));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAccountLinks());
    await waitFor(() => expect(result.current.loadState.status).toBe("ready"));

    act(() => {
      result.current.select([{ kind: "client", client: createLinkedClient({ clientId: "points" }) }], ["eac_1"], true);
    });
    expect(result.current.table?.changeCount).toBe(1);

    await act(async () => {
      expect(await result.current.save()).toBe(true);
    });

    const [, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/visibility");
    expect(JSON.parse(saveInit.body as string)).toEqual({
      accounts: [{ externalAccountId: "eac_1", isPublic: false }],
      clients: [{ clientId: "points", visibleAccountIds: ["eac_1"] }],
    });
    expect(result.current.saveState.status).toBe("saved");
    expect(result.current.table?.changeCount).toBe(0);
    expect(result.current.table?.rows[0]?.cells.map((cell) => cell.isSelected)).toEqual([false, true]);
  });

  it("保存中は選択の変更を受け付けず、保存の完了後に編集を空にする", async () => {
    let resolveSave: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(dataResponse(links))
      .mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)))
      .mockResolvedValueOnce(dataResponse(links));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useAccountLinks());
    await waitFor(() => expect(result.current.loadState.status).toBe("ready"));
    act(() => result.current.select([{ kind: "profile" }], ["eac_1"], true));

    let saving: Promise<boolean> = Promise.resolve(false);
    act(() => {
      saving = result.current.save();
    });
    act(() => result.current.select([{ kind: "profile" }], ["eac_1"], false));

    expect(result.current.saveState.status).toBe("saving");
    expect(result.current.table?.rows[0]?.cells[0]?.isSelected).toBe(true);

    await act(async () => {
      resolveSave(dataResponse({ ok: true }));
      expect(await saving).toBe(true);
    });
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/visibility")).toHaveLength(1);
    expect(result.current.saveState.status).toBe("saved");
    expect(result.current.table?.changeCount).toBe(0);
  });

  it("保存が拒否された場合は編集を保ったまま失敗を示す", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(dataResponse(links))
        .mockResolvedValueOnce(problemResponse(400, "INVALID_VALUE")),
    );
    const { result } = renderHook(() => useAccountLinks());
    await waitFor(() => expect(result.current.loadState.status).toBe("ready"));

    act(() => result.current.select([{ kind: "profile" }], ["eac_1"], true));
    await act(async () => {
      expect(await result.current.save()).toBe(false);
    });

    expect(result.current.saveState.status).toBe("error");
    expect(result.current.table?.changeCount).toBe(1);
  });

  it("編集を破棄すると、未保存の変更と直前の保存の失敗を消す", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(dataResponse(links))
        .mockResolvedValueOnce(problemResponse(400, "INVALID_VALUE")),
    );
    const { result } = renderHook(() => useAccountLinks());
    await waitFor(() => expect(result.current.loadState.status).toBe("ready"));
    act(() => result.current.select([{ kind: "profile" }], ["eac_1"], true));
    await act(async () => {
      await result.current.save();
    });

    act(() => result.current.discardEdits());

    expect(result.current.saveState.status).toBe("idle");
    expect(result.current.table?.changeCount).toBe(0);
  });
});
