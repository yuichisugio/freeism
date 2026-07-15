import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ProviderButtons } from "./provider-buttons";

describe("ProviderButtons", () => {
  it("uses the same Google and GitHub set for login and linking", () => {
    const login = renderToStaticMarkup(<ProviderButtons mode="login" />);
    const link = renderToStaticMarkup(<ProviderButtons mode="link" />);

    for (const provider of ["Google", "GitHub"]) {
      expect(login).toContain(provider);
      expect(link).toContain(provider);
    }
  });
});
