import { describe, expect, it } from "vitest";

import { normalizeUrl } from "./normalize-url";

describe("normalizeUrl", () => {
  // --------------------------------------------------
  // 同値に揃える表記
  // --------------------------------------------------

  it.each([
    [
      "schemeとhostを小文字化し、pathの大文字小文字は保持する",
      "HTTPS://GitHub.COM/Alice",
      "https://github.com/Alice",
    ],
    [
      "国際化ドメインをPunycodeにする",
      "https://例え.jp/ユーザー",
      "https://xn--r8jz45g.jp/%E3%83%A6%E3%83%BC%E3%82%B6%E3%83%BC",
    ],
    ["既定のportを除去する", "https://example.com:443/about", "https://example.com/about"],
    ["fragmentを除去する", "https://example.com/about#section", "https://example.com/about"],
    ["空のfragmentを除去する", "https://example.com/about#", "https://example.com/about"],
    ["空のpathを`/`にする", "https://example.com", "https://example.com/"],
    [
      "非予約文字を表す`%XX`を復号する",
      "https://example.com/%7Ealice/%41%2d%5F",
      "https://example.com/~alice/A-_",
    ],
    [
      "残る`%xx`の16進を大文字にする",
      "https://example.com/a%2fb?q=a%3db",
      "https://example.com/a%2Fb?q=a%3Db",
    ],
    [
      "queryの順序と予約文字の符号化を保持する",
      "https://example.com/?b=2&a=1&c=%26",
      "https://example.com/?b=2&a=1&c=%26",
    ],
    ["dot segmentを解決する", "https://example.com/a/../b", "https://example.com/b"],
  ])("%s", (_, input, expected) => {
    expect(normalizeUrl(input)).toEqual({
      ok: true,
      url: expected,
      host: new URL(expected).hostname,
    });
  });

  it("正規化した結果を再度正規化しても変わらない", () => {
    const first = normalizeUrl("HTTPS://Example.COM:443/%7euser/%2f?q=%3d#top");

    expect(first.ok && normalizeUrl(first.url)).toEqual(first);
  });

  // --------------------------------------------------
  // 別のURLとして区別する表記
  // --------------------------------------------------

  it.each([
    ["末尾slash", "https://example.com/about", "https://example.com/about/"],
    ["path", "https://example.com/", "https://example.com/about"],
    ["query", "https://example.com/", "https://example.com/?a=1"],
    ["subdomain", "https://example.com/", "https://www.example.com/"],
    ["予約文字の符号化", "https://example.com/a/b", "https://example.com/a%2Fb"],
  ])("%sが異なるURLを区別する", (_, left, right) => {
    const normalizedLeft = normalizeUrl(left);
    const normalizedRight = normalizeUrl(right);

    expect(
      normalizedLeft.ok && normalizedRight.ok && normalizedLeft.url !== normalizedRight.url,
    ).toBe(true);
  });

  // --------------------------------------------------
  // 入力エラー
  // --------------------------------------------------

  it.each([
    ["URLとして解析できない", "github.com/alice", "INVALID_URL"],
    ["HTTP", "http://example.com/", "UNSUPPORTED_SCHEME"],
    ["HTTPS以外のscheme", "ftp://example.com/", "UNSUPPORTED_SCHEME"],
    ["末尾ドットを含むhost", "https://github.com./alice", "TRAILING_DOT_HOST"],
    ["443以外のport", "https://example.com:8443/", "PORT_NOT_ALLOWED"],
    ["userinfo", "https://user:secret@example.com/", "USERINFO_NOT_ALLOWED"],
    ["passwordの無いuserinfo", "https://user@example.com/", "USERINFO_NOT_ALLOWED"],
    ["IPv4 literal", "https://127.0.0.1/", "HOST_NOT_ALLOWED"],
    ["省略表記のIPv4 literal", "https://127.1/", "HOST_NOT_ALLOWED"],
    ["16進表記のIPv4 literal", "https://0xa9fea9fe/", "HOST_NOT_ALLOWED"],
    ["IPv6 literal", "https://[::1]/", "HOST_NOT_ALLOWED"],
    ["localhost", "https://localhost/", "HOST_NOT_ALLOWED"],
    ["localhostのsubdomain", "https://app.localhost/", "HOST_NOT_ALLOWED"],
    ["単一ラベルのhost", "https://intranet/", "HOST_NOT_ALLOWED"],
    ["Cloud metadataのhost", "https://metadata.google.internal/", "HOST_NOT_ALLOWED"],
    [".local", "https://printer.local/", "HOST_NOT_ALLOWED"],
    [".localdomain", "https://host.localdomain/", "HOST_NOT_ALLOWED"],
    [".home.arpa", "https://router.home.arpa/", "HOST_NOT_ALLOWED"],
    [".arpa", "https://1.0.0.127.in-addr.arpa/", "HOST_NOT_ALLOWED"],
    [".test", "https://accounts.test/", "HOST_NOT_ALLOWED"],
    [".example", "https://site.example/", "HOST_NOT_ALLOWED"],
    [".invalid", "https://site.invalid/", "HOST_NOT_ALLOWED"],
    [".onion", "https://hidden.onion/", "HOST_NOT_ALLOWED"],
  ])("%sを拒否する", (_, input, code) => {
    expect(normalizeUrl(input)).toEqual({ ok: false, code });
  });

  it("2,048 bytesまで受け付け、超えると拒否する", () => {
    const origin = "https://example.com/";
    const longest = origin + "a".repeat(2048 - origin.length);

    expect(normalizeUrl(longest)).toEqual({ ok: true, url: longest, host: "example.com" });
    expect(normalizeUrl(`${longest}a`)).toEqual({ ok: false, code: "VALUE_TOO_LONG" });
  });
});
