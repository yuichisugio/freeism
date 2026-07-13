import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { GoogleReauthButton } from "./google-reauth-button";

describe("GoogleReauthButton", () => {
  it("renders an explicit reauthentication action", () => {
    expect(renderToStaticMarkup(<GoogleReauthButton />)).toContain("Googleで再認証");
  });
});
