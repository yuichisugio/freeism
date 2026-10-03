import { describe, expect, it } from "vitest";

import { judgeProfileUrlEvidence } from "./judge-profile-url-evidence";

const expectation = {
  accountsOrigin: "https://accounts.freeism.app",
  accountsUserId: "ausr_alice",
};
const expectedUrl = "https://accounts.freeism.app/profiles/ausr_alice";
const otherUserUrl = "https://accounts.freeism.app/profiles/ausr_bob";

describe("judgeProfileUrlEvidence", () => {
  it.each([
    ["期待URLだけがある", [expectedUrl]],
    ["同じ期待URLが繰り返される", [expectedUrl, expectedUrl, expectedUrl]],
    ["プロフィール以外のURLと並ぶ", ["https://example.com/", expectedUrl]],
    ["末尾slash付きの別URLと並ぶ", [expectedUrl, `${expectedUrl}/`]],
    [
      "ユーザーIDに使わない文字が続く別URLと並ぶ",
      [expectedUrl, `${expectedUrl}%E3%81%A7%E3%81%99`],
    ],
    [
      "別のAccountsサービスのプロフィールURLと並ぶ",
      [expectedUrl, "https://staging.accounts.freeism.app/profiles/ausr_bob"],
    ],
  ])("%s場合は成功する", (_, candidates) => {
    expect(judgeProfileUrlEvidence(candidates, expectation, "LINK_NOT_FOUND")).toEqual({
      result: "verified",
      failureCode: null,
    });
  });

  it("同じAccountsサービスの異なるユーザーのプロフィールURLが並ぶ場合は判断不能にする", () => {
    expect(
      judgeProfileUrlEvidence(
        [expectedUrl, otherUserUrl, otherUserUrl],
        expectation,
        "LINK_NOT_FOUND",
      ),
    ).toEqual({
      result: "indeterminate",
      failureCode: "MULTIPLE_ACCOUNTS_PROFILES",
    });
  });

  it.each([
    ["候補が無い", []],
    [
      "期待URLを含まず、他のユーザーのプロフィールURLだけがある",
      [otherUserUrl, "https://accounts.freeism.app/profiles/ausr_carol"],
    ],
    ["期待URLの後にpathが続く", [`${expectedUrl}/extra`]],
    ["期待URLにqueryが付く", [`${expectedUrl}?ref=github`]],
    ["期待URLが別URLのqueryに含まれる", [`https://example.com/?next=${expectedUrl}`]],
    ["期待URLを前方に含む別のユーザーID", [`${expectedUrl}2`]],
  ])("%s場合は指定した`failure_code`で不一致にする", (_, candidates) => {
    expect(judgeProfileUrlEvidence(candidates, expectation, "TXT_NOT_FOUND")).toEqual({
      result: "not_verified",
      failureCode: "TXT_NOT_FOUND",
    });
  });
});
