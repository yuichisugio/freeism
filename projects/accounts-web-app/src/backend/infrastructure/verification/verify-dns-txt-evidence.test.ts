import { describe, expect, it, vi } from "vitest";

import { type ResolveTxt, verifyDnsTxtEvidence } from "./verify-dns-txt-evidence";

const target = { accountsOrigin: "https://accounts.freeism.app", accountsUserId: "ausr_alice" };

/**
 * 指定したTXTレコードを返す`resolveTxt`の代替。
 */
function resolveTxtReturning(records: string[][]) {
  return vi.fn<ResolveTxt>(async () => records);
}

/**
 * `code`付きの例外を投げる`resolveTxt`の代替。
 */
function resolveTxtFailingWith(code: string) {
  return vi.fn<ResolveTxt>(async () => {
    throw Object.assign(new Error(`queryTxt ${code}`), { code });
  });
}

describe("verifyDnsTxtEvidence", () => {
  it("`_accounts.{host}`を照会する", async () => {
    const resolveTxt = resolveTxtReturning([]);

    await verifyDnsTxtEvidence("blog.example.com", target, { resolveTxt });

    expect(resolveTxt).toHaveBeenCalledWith("_accounts.blog.example.com");
  });

  it.each([
    [
      "character-stringを連結した値が一致する",
      [["https://accounts.freeism.app/profiles/", "ausr_alice"]],
    ],
    ["正規化後の値が一致する", [["HTTPS://Accounts.Freeism.APP:443/profiles/ausr_alice"]]],
    [
      "他のTXTレコードとCNAMEの行が並ぶ",
      [
        ["v=spf1 -all"],
        ["alias.example.net."],
        ["https://accounts.freeism.app/profiles/ausr_alice"],
      ],
    ],
    [
      "同じ値が繰り返される",
      [
        ["https://accounts.freeism.app/profiles/ausr_alice"],
        ["https://accounts.freeism.app/profiles/ausr_alice"],
      ],
    ],
  ])("%s場合は成功する", async (_, records) => {
    await expect(
      verifyDnsTxtEvidence("example.com", target, { resolveTxt: resolveTxtReturning(records) }),
    ).resolves.toEqual({
      result: "verified",
      failureCode: null,
    });
  });

  it("一致するTXTが無い場合は不一致にする", async () => {
    const resolveTxt = resolveTxtReturning([
      ["https://accounts.freeism.app/profiles/ausr_bob"],
      ["v=spf1 -all"],
    ]);

    await expect(verifyDnsTxtEvidence("example.com", target, { resolveTxt })).resolves.toEqual({
      result: "not_verified",
      failureCode: "TXT_NOT_FOUND",
    });
  });

  it("異なるユーザーの公開プロフィールURLが併存する場合は判断不能にする", async () => {
    const resolveTxt = resolveTxtReturning([
      ["https://accounts.freeism.app/profiles/ausr_alice"],
      ["https://accounts.freeism.app/profiles/ausr_bob"],
    ]);

    await expect(verifyDnsTxtEvidence("example.com", target, { resolveTxt })).resolves.toEqual({
      result: "indeterminate",
      failureCode: "MULTIPLE_ACCOUNTS_PROFILES",
    });
  });

  it.each([
    ["ENOTFOUND", "not_verified", "TXT_NOT_FOUND"],
    ["ENODATA", "not_verified", "TXT_NOT_FOUND"],
    ["ESERVFAIL", "indeterminate", "DNS_LOOKUP_FAILED"],
    ["EBADRESP", "indeterminate", "DNS_LOOKUP_FAILED"],
  ])("`%s`の失敗を%sにする", async (code, result, failureCode) => {
    await expect(
      verifyDnsTxtEvidence("example.com", target, { resolveTxt: resolveTxtFailingWith(code) }),
    ).resolves.toEqual({
      result,
      failureCode,
    });
  });

  it("期限までに応答が無い場合は判断不能にする", async () => {
    const resolveTxt = vi.fn<ResolveTxt>(() => new Promise(() => {}));

    await expect(
      verifyDnsTxtEvidence("example.com", target, { resolveTxt, timeoutMilliseconds: 10 }),
    ).resolves.toEqual({
      result: "indeterminate",
      failureCode: "DNS_TIMEOUT",
    });
  });
});
