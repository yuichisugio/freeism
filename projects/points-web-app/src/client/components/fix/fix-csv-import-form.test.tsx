import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { FixCsvImportForm, FixRecipientResolutionSummary } from "./fix-csv-import-form";

describe("FixCsvImportForm", () => {
  it("ACTIVEな接続先を選択肢に出す", () => {
    const html = renderToStaticMarkup(
      <FixCsvImportForm
        connections={[
          { id: "acon_1", displayName: "Freeism Accounts", accountsOrigin: "https://a.test" },
        ]}
      />,
    );

    expect(html).toContain("<select");
    expect(html).toContain("Freeism Accounts（https://a.test）");
  });

  it("接続先が無い場合は未設定と表示する", () => {
    const html = renderToStaticMarkup(<FixCsvImportForm connections={[]} />);

    expect(html).toContain("接続先Accountsが未設定です");
    expect(html).not.toContain("<select");
  });
});

describe("FixRecipientResolutionSummary", () => {
  it("行ごとに一致・Points連携の有無・該当なしを表示する", () => {
    const html = renderToStaticMarkup(
      <FixRecipientResolutionSummary
        validation={{
          accountsOrigin: "https://a.test",
          accountsResolution: { status: "COMPLETE" },
          rowCount: 3,
          rows: [
            { recipientLinked: true, resolution: "MATCHED", row: 2 },
            { recipientLinked: false, resolution: "MATCHED", row: 3 },
            { recipientLinked: false, resolution: "NO_MATCH", row: 4 },
          ],
          validationHash: "hash",
        }}
      />,
    );

    expect(html).toContain("2行: 一致（Points連携あり）");
    expect(html).toContain("3行: 一致（Points未連携のため未受領として保存）");
    expect(html).toContain("4行: 該当なし（未受領として保存）");
  });

  it("照合できなかった場合は未照合と再試行の目安を表示する", () => {
    const html = renderToStaticMarkup(
      <FixRecipientResolutionSummary
        validation={{
          accountsOrigin: null,
          accountsResolution: {
            status: "UNAVAILABLE",
            code: "ACCOUNTS_RESOLVE_UNAVAILABLE",
            retryAfter: "30",
          },
          rowCount: 1,
          rows: [{ recipientLinked: false, resolution: "UNRESOLVED", row: 2 }],
          validationHash: null,
        }}
      />,
    );

    expect(html).toContain("確定できません（ACCOUNTS_RESOLVE_UNAVAILABLE）");
    expect(html).toContain("30秒後に");
    expect(html).toContain("2行: 未照合（通信失敗）");
  });
});
