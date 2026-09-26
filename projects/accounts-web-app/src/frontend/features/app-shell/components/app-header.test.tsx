// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { AppFooter, AppHeader } from "./app-header";

const authClientMock = vi.hoisted(() => ({
  useSession: vi.fn<() => { data: unknown; isPending: boolean }>(),
  signOut: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("../../../lib/auth-client", () => ({ authClient: authClientMock }));

beforeEach(() => {
  vi.resetAllMocks();
  authClientMock.useSession.mockReturnValue({ data: null, isPending: false });
});

describe("AppHeader", () => {
  it("左上のサービス名の左にロゴを置き、トップページへのリンクにする", async () => {
    renderWithProviders(<AppHeader />);

    const homeLink = await screen.findByRole("link", { name: "Accounts" });
    expect(homeLink.getAttribute("href")).toBe("/");
    expect(homeLink.querySelector("img")?.getAttribute("src")).toBe("/favicon.svg");
  });

  it("プライバシーポリシーと利用規約はヘッダーに置かない", async () => {
    renderWithProviders(<AppHeader />);

    await screen.findByRole("link", { name: "Accounts" });
    expect(screen.queryByRole("link", { name: "プライバシーポリシー" })).toBeNull();
    expect(screen.queryByRole("link", { name: "利用規約" })).toBeNull();
  });
});

describe("AppFooter", () => {
  it("OSSライセンスの右に、プライバシーポリシーと利用規約へのリンクを置く", async () => {
    renderWithProviders(<AppFooter />, { language: "en" });

    const footer = await screen.findByRole("contentinfo");
    const links = within(footer).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Help",
      "Open source licenses",
      "Privacy policy",
      "Terms of use",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/help", "/licenses", "/privacy", "/terms"]);
  });
});
