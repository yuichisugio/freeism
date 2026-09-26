import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import {
  AccountsConnectionList,
  type AccountsConnectionView,
} from "./accounts-connection-admin-panel";

const pendingConnection: AccountsConnectionView = {
  id: "acon_1",
  displayName: "Freeism Accounts",
  accountsOrigin: "https://accounts.example.test",
  status: "PENDING_CLIENT_REGISTRATION",
  clientId: null,
  registration: {
    applicationName: "Freeism Points",
    applicationUrl: "https://points.example.test",
    redirectUri: "https://points.example.test/api/accounts-links/callback",
    jwks: {
      keys: [{ kty: "OKP", crv: "Ed25519", x: "public-x", kid: "kid-1", alg: "EdDSA", use: "sig" }],
    },
  },
};

function render(connections: AccountsConnectionView[]) {
  return renderToStaticMarkup(
    <AccountsConnectionList
      canSubmit
      connections={connections}
      onActivate={() => {}}
      onWithdraw={() => {}}
    />,
  );
}

describe("AccountsConnectionList", () => {
  it("登録待ちの接続先に、Accountsへ登録する情報とClient IDの入力を示す", () => {
    const html = render([pendingConnection]);

    expect(html).toContain("Client ID登録待ち");
    expect(html).toContain("Freeism Points");
    expect(html).toContain("https://points.example.test/api/accounts-links/callback");
    expect(html).toContain("public-x");
    expect(html).toContain("Client IDを登録して有効化");
    expect(html).toContain("取り下げ");
  });

  it("有効な接続先はClient IDを示し、取り下げ済みは操作を出さない", () => {
    const html = render([
      { ...pendingConnection, status: "ACTIVE", clientId: "client-1" },
      {
        ...pendingConnection,
        id: "acon_2",
        status: "WITHDRAWN",
        clientId: "client-2",
        registration: null,
      },
    ]);

    expect(html).toContain("有効");
    expect(html).toContain("client-1");
    expect(html).toContain("取り下げ済み");
    expect(html).not.toContain("Client IDを登録して有効化");
    expect(html.match(/>取り下げ</g)).toHaveLength(1);
  });

  it("接続先が無い場合はその旨を示す", () => {
    expect(render([])).toContain("接続先はまだありません。");
  });
});
