import { describe, expect, it } from "vite-plus/test";

import { hasProfileLinkEvidence } from "./profile-link-evidence";

const profileUrl = "https://points.freeism.app/profiles/pusr_alice";

describe("profile link evidence", () => {
  it.each([
    [`<a href="${profileUrl}">profile</a>`, null],
    [`<link href="${profileUrl}">`, null],
    ["<main>editable profile</main>", `<${profileUrl}>; rel="me"`],
  ])("accepts an allowed link source", async (html, linkHeader) => {
    await expect(
      hasProfileLinkEvidence({
        documentUrl: "https://profile.example.net/alice",
        html,
        linkHeader,
        profileUrl,
      }),
    ).resolves.toBe(true);
  });

  it("uses only rel=me candidates when any rel=me link exists", async () => {
    await expect(
      hasProfileLinkEvidence({
        documentUrl: "https://profile.example.net/alice",
        html: `<a href="${profileUrl}">plain match</a><a href="https://elsewhere.example.net" rel="me">other</a>`,
        linkHeader: null,
        profileUrl,
      }),
    ).resolves.toBe(false);
  });

  it.each([
    [`Profile: ${profileUrl}`],
    [`<!-- <a href="${profileUrl}">comment</a> -->`],
    [`<code><a href="${profileUrl}">code</a></code>`],
    [`<script>document.body.innerHTML='<a href="${profileUrl}">js</a>'</script>`],
    [`<iframe srcdoc='<a href="${profileUrl}">frame</a>'></iframe>`],
    [`<script type="application/json">{"url":"${profileUrl}"}</script>`],
  ])("rejects a non-link proof location", async (html) => {
    await expect(
      hasProfileLinkEvidence({
        documentUrl: "https://profile.example.net/alice",
        html,
        linkHeader: null,
        profileUrl,
      }),
    ).resolves.toBe(false);
  });
});
