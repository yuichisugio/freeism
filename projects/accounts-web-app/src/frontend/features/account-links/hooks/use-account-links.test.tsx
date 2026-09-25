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

  it("同意画面では今回の連携先を指定して取得する", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => dataResponse(links));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useAccountLinks("points client"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/account-links?consentClientId=points+client", expect.anything()),
    );
  });

  it("取得に失敗した場合は失敗を保持する", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => problemResponse(401, "UNAUTHORIZED")));

    const { result } = renderHook(() => useAccountLinks());

    await waitFor(() => expect(result.current.loadState.status).toBe("error"));
  });

  it("編集すると保存でき、保存後は編集を破棄して再取得する", async () => {
    const saved = createAccountLinks({
      accounts: [createLinkedAccount({ id: "eac_1", visibility: { points: true } })],
      clients: [createLinkedClient({ clientId: "points", consented: true })],
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
      result.current.setClientConsent("points", true);
      result.current.setClientVisibility("points", ["eac_1"], true);
    });
    expect(result.current.table?.canSave).toBe(true);

    await act(async () => {
      expect(await result.current.save()).toBe(true);
    });

    const [, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/visibility");
    expect(JSON.parse(saveInit.body as string)).toEqual({
      accounts: [{ externalAccountId: "eac_1", isPublic: false }],
      clients: [{ clientId: "points", consented: true, visibleAccountIds: ["eac_1"] }],
    });
    expect(result.current.saveState.status).toBe("saved");
    expect(result.current.table?.isDirty).toBe(false);
    expect(result.current.table?.columns[0]?.consented).toBe(true);
  });

  it("保存が拒否された場合は編集を保ったまま失敗を示す", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(dataResponse(links))
        .mockResolvedValueOnce(problemResponse(400, "CONSENT_REQUIRES_VERIFIED_ACCOUNT")),
    );
    const { result } = renderHook(() => useAccountLinks());
    await waitFor(() => expect(result.current.loadState.status).toBe("ready"));

    act(() => result.current.setAccountPublic("eac_1", true));
    await act(async () => {
      expect(await result.current.save()).toBe(false);
    });

    expect(result.current.saveState.status).toBe("error");
    expect(result.current.table?.isDirty).toBe(true);
  });

  it("行単位の一括選択で、すべての連携先への公開を切り替える", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        dataResponse(
          createAccountLinks({
            clients: [createLinkedClient({ clientId: "a" }), createLinkedClient({ clientId: "b" })],
          }),
        ),
      ),
    );
    const { result } = renderHook(() => useAccountLinks());
    await waitFor(() => expect(result.current.loadState.status).toBe("ready"));

    act(() => result.current.setAccountVisibilityForAllClients("eac_1", true));

    expect(result.current.table?.rows[0]?.visibleClientIds).toEqual(["a", "b"]);
  });
});
