import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vite-plus/test";

import type { MarketsClient } from "../client/api/markets-client";
import { AppShell } from "./app-shell";

afterEach(() => {
  document.body.innerHTML = "";
});

async function renderForRole(role: string | null) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const client = { session: async () => ({ user: { role } }) } as MarketsClient;
  await act(async () => {
    root.render(<AppShell client={client}>content</AppShell>);
  });
  const html = container.innerHTML;
  await act(async () => root.unmount());
  return html;
}

describe("Markets admin navigation", () => {
  it("shows provider management only to an admin", async () => {
    expect(await renderForRole("admin")).toContain('href="/admin/points-connections"');
    expect(await renderForRole("user")).not.toContain('href="/admin/points-connections"');
    expect(await renderForRole(null)).not.toContain('href="/admin/points-connections"');
  });
});
