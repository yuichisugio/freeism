import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import type { MarketsClient } from "../client/api/markets-client";
import { PointsConnectionPanel } from "./points-connection-panel";

const client = {} as MarketsClient;

describe("Points connection panel", () => {
  it("lets a stopped provider's existing connection reauthorize before unlink", () => {
    const html = renderToStaticMarkup(
      <PointsConnectionPanel
        client={client}
        onChanged={() => undefined}
        state={{
          providerId: "provider-a",
          displayName: "Example Points",
          status: "STOPPED",
          connection: { id: "connection-a", status: "REAUTH_REQUIRED" },
        }}
      />,
    );

    expect(html).toContain("Example Points");
    expect(html).toContain("新規利用停止中");
    expect(html).toContain("再連携する");
    expect(html).toContain("連携を解除するには、先に再連携してください。");
    expect(html).not.toContain("連携を解除する</button>");
  });

  it("lets an active connection at a stopped provider unlink", () => {
    const html = renderToStaticMarkup(
      <PointsConnectionPanel
        client={client}
        onChanged={() => undefined}
        state={{
          providerId: "provider-a",
          displayName: "Example Points",
          status: "STOPPED",
          connection: { id: "connection-a", status: "ACTIVE" },
        }}
      />,
    );

    expect(html).toContain("連携を解除する</button>");
  });

  it("does not offer a new link for a stopped provider", () => {
    const html = renderToStaticMarkup(
      <PointsConnectionPanel
        client={client}
        onChanged={() => undefined}
        state={{
          providerId: "provider-a",
          displayName: "Example Points",
          status: "STOPPED",
          connection: null,
        }}
      />,
    );

    expect(html).not.toContain("連携する</button>");
  });
});
