// @vitest-environment happy-dom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { LicensesView } from "./licenses-page";

const licenses = [
  { name: "react", version: "19.3.0", identifier: "MIT", text: "MIT License text" },
  { name: "no-metadata", version: "1.0.0" },
];

describe("LicensesView", () => {
  it("パッケージ・バージョン・ライセンス・リンクの表で一覧を表示する", async () => {
    renderWithProviders(<LicensesView state={{ status: "loaded", licenses }} />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("OSSライセンス");
    expect(screen.getByText("Freeism Accounts は次のオープンソースソフトウェアを利用しています。")).toBeDefined();
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "パッケージ",
      "バージョン",
      "ライセンス",
      "リンク",
    ]);

    const react = within(screen.getByRole("row", { name: /^react/ }));
    expect(react.getByText("19.3.0")).toBeDefined();
    expect(react.getByText("MIT")).toBeDefined();
    const link = react.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://www.npmjs.com/package/react");
    expect(link.getAttribute("target")).toBe("_blank");

    expect(within(screen.getByRole("row", { name: /^no-metadata/ })).getByText("記載なし")).toBeDefined();
  });

  it("全文のあるパッケージだけ、行ごとに全文を開閉できる", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LicensesView state={{ status: "loaded", licenses }} />);

    const toggle = within(await screen.findByRole("row", { name: /^react/ })).getByRole("button", {
      name: "全文を表示",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("MIT License text")).toBeNull();

    await user.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("MIT License text")).toBeDefined();

    await user.click(toggle);

    expect(screen.queryByText("MIT License text")).toBeNull();
    expect(within(screen.getByRole("row", { name: /^no-metadata/ })).queryByRole("button")).toBeNull();
  });

  it("ビルド前はビルド後に表示される旨をテキストで示す", async () => {
    renderWithProviders(<LicensesView state={{ status: "notBuilt" }} />);

    expect((await screen.findByRole("status")).textContent).toBe("ライセンス一覧はビルド後に表示されます。");
  });

  it("読み込みの失敗はalertで示す", async () => {
    renderWithProviders(<LicensesView state={{ status: "failed" }} />, { language: "en" });

    expect((await screen.findByRole("alert")).textContent).toContain("Could not load the license list");
  });
});
