import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { TurnstileChallenge } from "./turnstile-challenge";

describe("TurnstileChallenge", () => {
  it("renders an accessible challenge container", () => {
    const html = renderToStaticMarkup(
      <TurnstileChallenge
        action="ownership_verify"
        onError={() => {}}
        onToken={() => {}}
        siteKey="test"
      />,
    );

    expect(html).toContain('aria-label="Bot確認"');
    expect(html).toContain("Bot確認を完了してください");
  });
});
