// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dataResponse, problemResponse } from "../../../test/bff-responses";
import {
  createAccountLinks,
  createLinkedAccount,
  createLinkedClient,
} from "../../account-links/lib/account-links-fixtures";
import { useConsentSelection } from "./use-consent-selection";

const links = createAccountLinks({
  accounts: [
    createLinkedAccount({ id: "eac_verified", visibility: { markets: true } }),
    createLinkedAccount({ id: "eac_unverified", verificationStatus: "unverified" }),
  ],
  clients: [
    createLinkedClient({ clientId: "markets", name: "Markets" }),
    createLinkedClient({ clientId: "points", name: "Points", isConsentRequest: true }),
  ],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * 一覧を返すBFFを用意して、今回の連携先を`points`として描画する。
 */
async function renderSelection(fetchMock = vi.fn<typeof fetch>(async () => dataResponse(links))) {
  vi.stubGlobal("fetch", fetchMock);
  const hook = renderHook(() => useConsentSelection("points"));
  await waitFor(() => expect(hook.result.current.loadState.status).toBe("ready"));
  return { ...hook, fetchMock };
}

describe("useConsentSelection", () => {
  it("今回の連携先を指定して一覧を取得し、その連携先への保存済みの選択だけを示す", async () => {
    const { result, fetchMock } = await renderSelection();

    expect(fetchMock).toHaveBeenCalledWith("/api/account-links?consentClientId=points", expect.anything());
    expect(result.current.client?.name).toBe("Points");
    expect(result.current.rows.map((row) => [row.account.id, row.isSelected])).toEqual([
      ["eac_verified", false],
      ["eac_unverified", false],
    ]);
    expect(result.current.hasVerifiedSelection).toBe(false);
    expect(result.current.bulkState).toBe("none");
  });

  it("一覧に今回の連携先が無い場合は連携先を示さない", async () => {
    const { result } = await renderSelection(
      vi.fn<typeof fetch>(async () => dataResponse(createAccountLinks({ clients: [] }))),
    );

    expect(result.current.client).toBeNull();
  });

  it("未検証の行だけを選んでも、証明済みの選択とは数えない", async () => {
    const { result } = await renderSelection();

    act(() => result.current.setSelected("eac_unverified", true));

    expect(result.current.bulkState).toBe("some");
    expect(result.current.hasVerifiedSelection).toBe(false);

    act(() => result.current.setSelected("eac_verified", true));

    expect(result.current.bulkState).toBe("all");
    expect(result.current.hasVerifiedSelection).toBe(true);
  });

  it("一括の選択は未検証の行を含む全行を切り替える", async () => {
    const { result } = await renderSelection();

    act(() => result.current.setAllSelected(true));

    expect(result.current.rows.every((row) => row.isSelected)).toBe(true);

    act(() => result.current.setAllSelected(false));

    expect(result.current.rows.some((row) => row.isSelected)).toBe(false);
  });

  it("保存は今回の連携先の選択だけを送り、ほかの連携先と一般公開は送らない", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(dataResponse(links))
      .mockResolvedValueOnce(dataResponse({ ok: true }));
    const { result } = await renderSelection(fetchMock);
    act(() => result.current.setSelected("eac_verified", true));

    let isSaved = false;
    await act(async () => {
      isSaved = await result.current.save();
    });

    expect(isSaved).toBe(true);
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("/api/visibility");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({
      accounts: [],
      clients: [{ clientId: "points", visibleAccountIds: ["eac_verified"] }],
    });
  });

  it("保存に失敗した場合は失敗を返し、その内容を保持する", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(dataResponse(links))
      .mockResolvedValueOnce(problemResponse(401, "UNAUTHORIZED"));
    const { result } = await renderSelection(fetchMock);

    let isSaved = true;
    await act(async () => {
      isSaved = await result.current.save();
    });

    expect(isSaved).toBe(false);
    expect(result.current.saveError).not.toBeNull();
  });

  it("一覧の取得に失敗した場合は失敗を保持する", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => problemResponse(401, "UNAUTHORIZED")));

    const { result } = renderHook(() => useConsentSelection("points"));

    await waitFor(() => expect(result.current.loadState.status).toBe("error"));
  });
});
