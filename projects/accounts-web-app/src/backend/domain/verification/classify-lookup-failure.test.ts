import { describe, expect, it } from "vitest";

import { classifyDnsError, classifyHttpStatus } from "./classify-lookup-failure";

describe("classifyHttpStatus", () => {
  it.each([
    [404, "not_verified", "PAGE_NOT_FOUND"],
    [410, "not_verified", "PAGE_NOT_FOUND"],
    [401, "indeterminate", "ACCESS_RESTRICTED"],
    [403, "indeterminate", "ACCESS_RESTRICTED"],
    [429, "indeterminate", "ACCESS_RESTRICTED"],
    [400, "indeterminate", "HTTP_ERROR"],
    [500, "indeterminate", "HTTP_ERROR"],
    [503, "indeterminate", "HTTP_ERROR"],
  ])("HTTP %iを%sと`%s`に分類する", (status, result, failureCode) => {
    expect(classifyHttpStatus(status)).toEqual({ result, failureCode });
  });
});

describe("classifyDnsError", () => {
  it.each([
    ["ENOTFOUND", "not_verified", "TXT_NOT_FOUND"],
    ["ENODATA", "not_verified", "TXT_NOT_FOUND"],
    ["ESERVFAIL", "indeterminate", "DNS_LOOKUP_FAILED"],
    ["ETIMEOUT", "indeterminate", "DNS_LOOKUP_FAILED"],
    ["EBADRESP", "indeterminate", "DNS_LOOKUP_FAILED"],
    ["EBADQUERY", "indeterminate", "DNS_LOOKUP_FAILED"],
  ])("`%s`を%sと`%s`に分類する", (code, result, failureCode) => {
    expect(classifyDnsError(Object.assign(new Error(code), { code }))).toEqual({
      result,
      failureCode,
    });
  });

  it("codeを持たない例外を照会の失敗に分類する", () => {
    expect(classifyDnsError(new TypeError("failed"))).toEqual({
      result: "indeterminate",
      failureCode: "DNS_LOOKUP_FAILED",
    });
  });
});
