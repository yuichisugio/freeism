import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { OAuthClientsPanel } from "./oauth-clients-panel";

const jwks = { keys: [{ kty: "EC", crv: "P-256", x: "x", y: "y" }] };
let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

async function renderWithClients(
  count: number,
  handleRequest?: (path: string, init?: RequestInit) => Promise<Response>,
) {
  const clients = Array.from({ length: count }, (_, index) => ({
    clientId: `client-${index}`,
    name: `App ${index}`,
    uri: null,
    description: null,
    redirectUris: ["https://example.test/callback"],
    jwks,
  }));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn(handleRequest ?? (async () => Response.json({ data: { clients } }))),
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<OAuthClientsPanel />);
  });
  return container;
}

describe("OAuth クライアント管理画面", () => {
  it("未ログインでは登録画面を表示せずログインへ案内する", async () => {
    const screen = await renderWithClients(0, async () =>
      Response.json({ code: "UNAUTHORIZED" }, { status: 401 }),
    );
    expect(screen.textContent).toContain("ログインしてから操作してください。");
    expect(screen.querySelector('a[href="/login"]')).not.toBeNull();
    expect(screen.textContent).not.toContain("新規登録");
  });

  it("本人の登録が 5 件なら新規登録を無効化する", async () => {
    const screen = await renderWithClients(5);
    const createButton = [...screen.querySelectorAll("button")].find(
      (button) => button.textContent === "新規登録",
    );
    expect(createButton?.disabled).toBe(true);
    expect(screen.textContent).toContain("登録できるアプリは 5 件までです。");
  });

  it("本人の登録が 4 件なら新規登録できる", async () => {
    const screen = await renderWithClients(4);
    const createButton = [...screen.querySelectorAll("button")].find(
      (button) => button.textContent === "新規登録",
    );
    expect(createButton?.disabled).toBe(false);
  });

  it("新規登録、編集、削除を本人の API に送る", async () => {
    const registered = {
      clientId: "client-new",
      name: "Markets",
      uri: null,
      description: null,
      redirectUris: ["https://markets.example/callback"],
      jwks,
    };
    const requests: Array<{ path: string; method: string; body?: unknown }> = [];
    const screen = await renderWithClients(0, async (path, init) => {
      const method = init?.method ?? "GET";
      requests.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (method === "GET") return Response.json({ data: { clients: [] } });
      if (method === "POST") return Response.json({ data: registered }, { status: 201 });
      if (method === "PUT") return Response.json({ data: { ...registered, name: "Markets 2" } });
      return Response.json({ data: { ok: true } });
    });
    const button = (label: string) =>
      [...screen.querySelectorAll("button")].find((item) => item.textContent === label)!;
    const change = async (selector: string, value: string) => {
      const input = screen.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      const prototype =
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };

    await act(async () => button("新規登録").click());
    await change('input[name="name"]', "Markets");
    await change('input[aria-label="リダイレクト URL 1"]', "https://markets.example/callback");
    await change('textarea[name="jwks"]', JSON.stringify(jwks));
    expect(button("保存").disabled).toBe(false);
    await act(async () =>
      screen
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(screen.textContent).toContain("client-new");
    expect(requests.at(-1)).toMatchObject({ path: "/api/oauth-clients", method: "POST" });

    await change('input[name="name"]', "Markets 2");
    await act(async () =>
      screen
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(requests.at(-1)).toMatchObject({ path: "/api/oauth-clients/client-new", method: "PUT" });
    expect(screen.textContent).toContain("Markets 2");

    await act(async () => button("アプリを削除").click());
    await act(async () => button("削除する").click());
    expect(requests.at(-1)).toMatchObject({
      path: "/api/oauth-clients/client-new",
      method: "DELETE",
    });
    expect(screen.textContent).toContain("アプリを削除しました。");
  });
});
