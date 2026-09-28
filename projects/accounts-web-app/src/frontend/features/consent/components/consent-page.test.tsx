// @vitest-environment happy-dom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dataResponse } from "../../../test/bff-responses";
import { renderWithProviders } from "../../../test/render-with-providers";
import {
  createAccountLinks,
  createLinkedAccount,
  createLinkedClient,
} from "../../account-links/lib/account-links-fixtures";
import { ConsentPage } from "./consent-page";

const authClientMock = vi.hoisted(() => ({
  useSession: vi.fn<() => { data: unknown; isPending: boolean }>(),
  getLastUsedLoginMethod: vi.fn<() => string | null>(),
  oauth2: { consent: vi.fn<(input: { accept: boolean }) => Promise<unknown>>() },
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

const alice = {
  session: { id: "session-a", token: "token-a", userId: "ausr_alice" },
  user: { id: "ausr_alice", name: "山田 花子" },
};

const signedSearch = {
  client_id: "points",
  redirect_uri: "https://points.example/callback",
  exp: String(Math.floor(Date.now() / 1000) + 600),
  sig: "signature",
};

const links = createAccountLinks({
  accounts: [
    createLinkedAccount({
      id: "eac_github",
      service: "github",
      identifiers: [
        { id: "eid_1", type: "provider_username", provider: "github", value: "yamada-hanako", isActive: true },
      ],
      verifications: [
        { id: "ver_1", method: "oauth", verifiedAt: "2026-09-12T14:03:00Z", evidence: null, identifiers: [] },
        {
          id: "ver_2",
          method: "bidirectional_link",
          verifiedAt: "2026-09-12T14:05:00Z",
          evidence: "https://github.com/yamada-hanako",
          identifiers: [],
        },
      ],
    }),
    createLinkedAccount({
      id: "eac_qiita",
      service: "qiita",
      displayName: null,
      verificationStatus: "unverified",
      identifiers: [{ id: "eid_2", type: "url", provider: null, value: "https://qiita.com/hanako_y", isActive: false }],
      primaryUrl: "https://qiita.com/hanako_y",
    }),
  ],
  clients: [createLinkedClient({ clientId: "points", name: "Points", uri: "https://points.example/about", isConsentRequest: true })],
});

/**
 * 一覧を返すBFFを用意して同意画面を描画し、選択リストの表示を待つ。
 */
async function renderConsentPage({
  search = signedSearch,
  accountLinks = links,
  fetchMock = vi.fn<typeof fetch>(async () => dataResponse(accountLinks)),
}: { search?: Record<string, string>; accountLinks?: typeof links; fetchMock?: ReturnType<typeof vi.fn<typeof fetch>> } = {}) {
  vi.stubGlobal("fetch", fetchMock);
  renderWithProviders(<ConsentPage search={search} />);
  await screen.findByRole("heading", { level: 1 });
  return { fetchMock };
}

beforeEach(() => {
  vi.resetAllMocks();
  authClientMock.useSession.mockReturnValue({ data: alice, isPending: false });
  authClientMock.getLastUsedLoginMethod.mockReturnValue(null);
  authClientMock.oauth2.consent.mockResolvedValue({ data: { redirect: true, url: "https://points.example/callback" }, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConsentPage", () => {
  it("連携先・連携するアカウント・紹介ページ・戻り先・利用目的を上から順に示す", async () => {
    await renderConsentPage();

    expect(screen.getByRole("heading", { level: 1, name: "Points が情報の提供を求めています" })).toBeTruthy();
    expect(screen.getByText("連携するアカウント")).toBeTruthy();
    expect(screen.getByText("山田 花子 (ausr_alice)")).toBeTruthy();
    expect(screen.getByRole("link", { name: /https:\/\/points\.example\/about/ }).getAttribute("href")).toBe(
      "https://points.example/about",
    );
    expect(screen.getByText("points.example")).toBeTruthy();
    expect(screen.getByText("同意すると、選択した外部アカウントの情報を、連携先へ提供します。")).toBeTruthy();
    expect(screen.getByText("同意と選択は後から変更できます。")).toBeTruthy();
    expect(screen.queryByText(/10分/)).toBeNull();
    expect(screen.queryByRole("button", { name: "公開設定を保存" })).toBeNull();
  });

  it("選択リストは今回の連携先の列だけを、行ごとのアイコン・「サービス名：識別子」・成功した方法または「未検証」で示す", async () => {
    await renderConsentPage();

    const list = screen.getByRole("list");
    const [bulk, github, qiita] = within(list).getAllByRole("listitem");
    expect(within(bulk!).getByText("アカウント")).toBeTruthy();
    expect(within(bulk!).getByRole("checkbox", { name: "すべての外部アカウントをPointsに公開" })).toBeTruthy();
    expect(within(github!).getByText("GitHub：yamada-hanako")).toBeTruthy();
    expect(within(github!).getByText("OAuth")).toBeTruthy();
    expect(within(github!).getByText("双方向リンク")).toBeTruthy();
    expect(within(qiita!).getByText("Qiita：qiita.com/hanako_y")).toBeTruthy();
    expect(within(qiita!).getByText("未検証")).toBeTruthy();
    expect(within(qiita!).getByRole("checkbox", { name: "Qiita：qiita.com/hanako_yをPointsに公開" })).toBeTruthy();
  });

  it("証明済みの行を選ぶまでは「同意して戻る」を無効にして理由を示し、未検証の行だけでは同意できない", async () => {
    await renderConsentPage();
    const reason =
      "Points：公開する外部アカウントが選択されていないため、同意できません。証明済みのアカウントを1件以上選択してください。";

    expect(screen.getByText(reason)).toBeTruthy();
    expect(isDisabled(screen.getByRole("button", { name: "同意して戻る" }))).toBe(true);

    await userEvent.click(screen.getByRole("checkbox", { name: "Qiita：qiita.com/hanako_yをPointsに公開" }));

    expect(screen.getByText(reason)).toBeTruthy();
    expect(isDisabled(screen.getByRole("button", { name: "同意して戻る" }))).toBe(true);

    await userEvent.click(screen.getByRole("checkbox", { name: "GitHub：yamada-hanakoをPointsに公開" }));

    expect(screen.queryByText(reason)).toBeNull();
    expect(isDisabled(screen.getByRole("button", { name: "同意して戻る" }))).toBe(false);
  });

  it("「同意して戻る」は今回の連携先の選択だけを保存してから同意を送る", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(dataResponse(links))
      .mockResolvedValueOnce(dataResponse({ ok: true }));
    await renderConsentPage({ fetchMock });

    await userEvent.click(screen.getByRole("checkbox", { name: "すべての外部アカウントをPointsに公開" }));
    await userEvent.click(screen.getByRole("button", { name: "同意して戻る" }));

    await waitFor(() => expect(authClientMock.oauth2.consent).toHaveBeenCalledWith({ accept: true }));
    const [path, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("/api/visibility");
    expect(JSON.parse(init.body as string)).toEqual({
      accounts: [],
      clients: [{ clientId: "points", visibleAccountIds: ["eac_github", "eac_qiita"] }],
    });
  });

  it("「同意しない」は選択を保存せずに拒否を送る", async () => {
    const { fetchMock } = await renderConsentPage();

    await userEvent.click(screen.getByRole("button", { name: "同意しない" }));

    await waitFor(() => expect(authClientMock.oauth2.consent).toHaveBeenCalledWith({ accept: false }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("証明済みの選択が無いとして同意を拒否された場合は、選択の確認を求める", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(dataResponse(links))
      .mockResolvedValueOnce(dataResponse({ ok: true }));
    authClientMock.oauth2.consent.mockResolvedValue({
      data: null,
      error: { status: 400, statusText: "Bad Request", code: "CONSENT_REQUIRES_VERIFIED_ACCOUNT" },
    });
    await renderConsentPage({ fetchMock });

    await userEvent.click(screen.getByRole("checkbox", { name: "GitHub：yamada-hanakoをPointsに公開" }));
    await userEvent.click(screen.getByRole("button", { name: "同意して戻る" }));

    expect(
      await screen.findByText(
        "証明済みのアカウントが選択されていないため、同意できませんでした。画面を再読み込みして、選択を確認してください。",
      ),
    ).toBeTruthy();
  });

  it("期限切れの要求は選択リストの上に案内し、どちらのボタンも押せない", async () => {
    await renderConsentPage({ search: { ...signedSearch, exp: String(Math.floor(Date.now() / 1000) - 1) } });

    const notice = screen.getByRole("alert");
    expect(notice.textContent).toContain("連携の要求の有効期限が切れました。");
    expect(notice.compareDocumentPosition(screen.getByRole("list")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(isDisabled(screen.getByRole("button", { name: "同意して戻る" }))).toBe(true);
    expect(isDisabled(screen.getByRole("button", { name: "同意しない" }))).toBe(true);
  });

  it("連携先が見つからない場合は案内し、同意できない", async () => {
    await renderConsentPage({ accountLinks: createAccountLinks({ accounts: links.accounts, clients: [] }) });

    expect(screen.getByRole("alert").textContent).toContain("連携先のサービスが見つかりません。");
    expect(isDisabled(screen.getByRole("button", { name: "同意して戻る" }))).toBe(true);
  });

  it("署名付きクエリが無い場合は、元のサービスから連携を開始するよう案内する", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>());
    renderWithProviders(<ConsentPage search={{}} />);

    expect(await screen.findByText("連携の要求がありません。元のサービスから連携を開始してください。")).toBeTruthy();
  });
});

/**
 * HeroUIのボタンは、無効のときに`disabled`属性を付ける。
 */
function isDisabled(element: HTMLElement): boolean {
  return element.hasAttribute("disabled");
}
