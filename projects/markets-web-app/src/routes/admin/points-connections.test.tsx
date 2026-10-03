import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import type { AdminPointsProvider, MarketsClient } from "../../client/api/markets-client";
import { PointsConnectionsAdminPage } from "./points-connections";

const provider: AdminPointsProvider = {
  providerId: "provider-a",
  displayName: "Example Points",
  origin: "https://points.example",
  issuer: "https://points.example",
  resource: "https://points.example/api",
  clientId: null,
  status: "PENDING_CLIENT_REGISTRATION",
  publicJwks: { keys: [{ kty: "OKP", kid: "key-a" }] },
  callbackUrls: {
    link: "https://markets.example/api/points-connection/callback",
    unlink: "https://markets.example/api/points-connection/unlink/callback",
  },
  createdAt: "2026-09-29T00:00:00.000Z",
  activatedAt: null,
  stoppedAt: null,
};

describe("Points provider registration", () => {
  it("shows both callback URLs and the public key for developer registration", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const client = { adminPointsProviders: async () => [provider] } as unknown as MarketsClient;
    await act(async () => {
      root.render(<PointsConnectionsAdminPage client={client} />);
    });

    expect(container.textContent).toContain(provider.callbackUrls.link);
    expect(container.textContent).toContain(provider.callbackUrls.unlink);
    expect(container.textContent).toContain("key-a");
    expect(container.textContent).toContain("2つのコールバックURL");
    await act(async () => root.unmount());
  });
});
