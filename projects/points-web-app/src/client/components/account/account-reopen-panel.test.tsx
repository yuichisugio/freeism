import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { AccountReopenPanel } from "./account-reopen-panel";

describe("AccountReopenPanel", () => {
  it("shows signed unclaimed totals without a selection control", () => {
    const html = renderToStaticMarkup(
      <AccountReopenPanel
        preview={{
          axes: [
            {
              evaluationCriterionId: "criterion-1",
              negativeCount: 1,
              netAmount: "-1.5",
              positiveCount: 0,
              totalCount: 1,
            },
          ],
          reopenSetHash: "hash",
        }}
      />,
    );

    expect(html).toContain("-1.5");
    expect(html).toContain("負 1件");
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("Googleで再認証");
    expect(html).toContain("正負すべてを一括受領して再開");
  });
});
