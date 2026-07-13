import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ProfileSettingsForm } from "./profile-settings-form";

describe("ProfileSettingsForm", () => {
  it("supports ordered packages and all five evaluation visibility fields", () => {
    const html = renderToStaticMarkup(
      <ProfileSettingsForm
        initialProfile={{
          description: "",
          displayName: "Test",
          evaluationVisibilities: [],
          externalUrls: [],
          pointPackages: [
            { displayOrder: 0, pointPackageId: "package-1" },
            { displayOrder: 1, pointPackageId: "package-2" },
          ],
          visibility: "PUBLIC",
        }}
      />,
    );

    expect(html).toContain("上へ");
    expect(html).toContain("下へ");
    expect(html).toContain("残高");
    expect(html).toContain("評価累計");
    expect(html).toContain("FIX履歴");
    expect(html).toContain("譲渡履歴");
    expect(html).toContain("交換履歴");
  });
});
