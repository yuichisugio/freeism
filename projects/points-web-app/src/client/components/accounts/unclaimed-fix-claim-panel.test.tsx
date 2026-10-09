import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import {
  claimProblemMessage,
  UnclaimedFixClaimPreviewView,
  type UnclaimedFixClaimPreview,
} from "./unclaimed-fix-claim-panel";

const preview: UnclaimedFixClaimPreview = {
  accountsLinkId: "alnk_1",
  aggregates: [
    {
      evaluationCriterionId: "criterion_1",
      negativeCount: 1,
      netAmountScaled: 12_500,
      positiveCount: 2,
      totalCount: 3,
    },
    {
      evaluationCriterionId: "criterion_2",
      negativeCount: 1,
      netAmountScaled: -30_000,
      positiveCount: 0,
      totalCount: 1,
    },
  ],
  claimSetHash: "a".repeat(64),
  totalCount: 4,
};

function renderPreview(value: UnclaimedFixClaimPreview) {
  return renderToStaticMarkup(
    <UnclaimedFixClaimPreviewView onClaim={() => {}} pending={false} preview={value} />,
  );
}

describe("UnclaimedFixClaimPreviewView", () => {
  it("評価軸ごとの正味合計と正負の件数を示し、一括受領だけを求める", () => {
    const html = renderPreview(preview);

    expect(html).toContain("criterion_1");
    expect(html).toContain("1.25");
    expect(html).toContain("-3");
    expect(html).toContain("正 2件 / 負 1件 / 全 3件");
    expect(html).toContain("正負すべてを一括で受領する");
    expect(html).not.toContain("checkbox");
  });

  it("受領できる未受領FIXが無ければ受領ボタンを出さない", () => {
    const html = renderPreview({ ...preview, aggregates: [], totalCount: 0 });

    expect(html).toContain("受領できる未受領FIXはありません。");
    expect(html).not.toContain("一括で受領する");
  });
});

describe("claimProblemMessage", () => {
  it.each([
    ["FRESH_GOOGLE_AUTH_REQUIRED", "Googleで再認証"],
    ["CLAIM_SET_CHANGED", "最新の内容"],
    ["ACCOUNTS_UNAVAILABLE", "Accountsに接続できませんでした"],
    ["ACCOUNTS_CLIENT_UNAUTHORIZED", "Accountsに接続できませんでした"],
    ["UNKNOWN", "受領できませんでした"],
  ])("%sを利用者向けの案内にする", (code, expected) => {
    expect(claimProblemMessage(code)).toContain(expected);
  });
});
