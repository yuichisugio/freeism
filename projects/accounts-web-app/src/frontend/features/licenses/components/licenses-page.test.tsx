// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "../../../test/render-with-providers";
import { LicensesView } from "./licenses-page";

describe("LicensesView", () => {
  it("名前・版・識別子と、折りたたんだ全文を表示する", async () => {
    renderWithProviders(
      <LicensesView
        state={{
          status: "loaded",
          licenses: [
            { name: "react", version: "19.3.0", identifier: "MIT", text: "MIT License text" },
            { name: "no-metadata", version: "1.0.0" },
          ],
        }}
      />,
    );

    const react = (await screen.findByRole("heading", { name: "react 19.3.0" })).closest("li");
    expect(react?.textContent).toContain("ライセンス: MIT");
    expect(react?.querySelector("details")?.textContent).toContain("MIT License text");
    const noMetadata = screen.getByRole("heading", { name: "no-metadata 1.0.0" }).closest("li");
    expect(noMetadata?.textContent).toContain("記載なし");
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
