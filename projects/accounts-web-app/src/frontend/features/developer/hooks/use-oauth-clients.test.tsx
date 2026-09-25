// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BffError } from "../../../lib/api-client";
import { dataResponse, problemResponse } from "../../../test/bff-responses";
import { buildClient, stubBff, validJwksText } from "../test/oauth-client-fixtures";
import { useOAuthClients } from "./use-oauth-clients";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * 登録済みクライアントの一覧を返すBFFを用意し、読込み完了までフックを描画する。
 */
async function renderLoaded(clientCount: number, route: Parameters<typeof stubBff>[0] = () => undefined) {
  const clients = Array.from({ length: clientCount }, (_, index) => buildClient(index + 1));
  const fetchMock = stubBff((request) => {
    if (request.method === "GET" && request.url === "/api/oauth-clients") return dataResponse({ clients });
    return route(request);
  });
  const view = renderHook(() => useOAuthClients());
  await waitFor(() => expect(view.result.current.status).toBe("ready"));
  return { ...view, fetchMock };
}

/**
 * 新規登録の入力欄をすべて有効な値にする。
 */
function fillNewClient(result: { current: ReturnType<typeof useOAuthClients> }) {
  act(() => result.current.startCreating());
  act(() => {
    result.current.changeField("name", "New App");
    result.current.changeRedirectUri(0, "https://new.example/callback");
    result.current.changeField("jwksText", validJwksText);
  });
}

describe("useOAuthClients: 読込みと選択", () => {
  it("読込み後に最初のクライアントを編集対象にし、未変更では保存できない", async () => {
    const { result } = await renderLoaded(2);

    expect(result.current.clients).toHaveLength(2);
    expect(result.current.editTarget).toEqual({ kind: "existing", client: buildClient(1) });
    expect(result.current.form.name).toBe("App 1");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.canSave).toBe(false);
  });

  it("0件なら編集対象を持たない", async () => {
    const { result } = await renderLoaded(0);

    expect(result.current.clients).toEqual([]);
    expect(result.current.editTarget).toBeNull();
    expect(result.current.canCreate).toBe(true);
  });

  it("5件に達したら新規登録できない", async () => {
    const { result } = await renderLoaded(5);

    expect(result.current.canCreate).toBe(false);
    act(() => result.current.startCreating());
    expect(result.current.editTarget?.kind).toBe("existing");
  });

  it("一覧の読込みに失敗したらエラーを保持する", async () => {
    stubBff(() => problemResponse(500, "INTERNAL_ERROR"));
    const { result } = renderHook(() => useOAuthClients());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.loadError).toBeInstanceOf(BffError);
  });
});

describe("useOAuthClients: 入力検証", () => {
  it("必須項目・リダイレクトURL規則・公開鍵のJSON構文を満たさなければ保存できない", async () => {
    const { result } = await renderLoaded(1);

    act(() => result.current.changeField("name", ""));
    expect(result.current.fieldErrors.name).toBe("required");
    expect(result.current.canSave).toBe(false);

    act(() => {
      result.current.changeField("name", "App 1 改");
      result.current.changeRedirectUri(0, "http://app.example/callback");
    });
    expect(result.current.fieldErrors.redirectUris).toEqual(["invalidRedirectUri"]);
    expect(result.current.canSave).toBe(false);

    act(() => {
      result.current.changeRedirectUri(0, "https://app.example/callback");
      result.current.changeField("jwksText", "{");
    });
    expect(result.current.fieldErrors.jwks).toBe("invalidJson");
    expect(result.current.canSave).toBe(false);

    act(() => result.current.changeField("jwksText", validJwksText));
    expect(result.current.canSave).toBe(true);
  });

  it("未入力の新規登録では入力エラーを表示せず、保存もできない", async () => {
    const { result } = await renderLoaded(0);

    act(() => result.current.startCreating());

    expect(result.current.isDirty).toBe(false);
    expect(result.current.fieldErrors).toEqual({ redirectUris: [undefined] });
    expect(result.current.canSave).toBe(false);
  });

  it("リダイレクトURLの行を追加・削除できる", async () => {
    const { result } = await renderLoaded(1);

    act(() => result.current.addRedirectUri());
    act(() => result.current.changeRedirectUri(1, "http://localhost:3000/callback"));
    expect(result.current.form.redirectUris).toEqual([
      "https://app1.example/callback",
      "http://localhost:3000/callback",
    ]);

    act(() => result.current.removeRedirectUri(0));
    expect(result.current.form.redirectUris).toEqual(["http://localhost:3000/callback"]);
  });
});

describe("useOAuthClients: 保存", () => {
  it("新規登録に成功すると一覧へ加えて編集対象にし、未保存の変更を解消する", async () => {
    const created = { ...buildClient(9), name: "New App", redirectUris: ["https://new.example/callback"] };
    const { result, fetchMock } = await renderLoaded(1, (request) =>
      request.method === "POST" && request.url === "/api/oauth-clients" ? dataResponse(created) : undefined,
    );
    fillNewClient(result);
    expect(result.current.canSave).toBe(true);

    await act(() => result.current.save());

    expect(fetchMock).toHaveBeenCalledWith("/api/oauth-clients", expect.objectContaining({ method: "POST" }));
    expect(result.current.clients.map((client) => client.clientId)).toEqual(["client-1", "client-9"]);
    expect(result.current.editTarget).toEqual({ kind: "existing", client: created });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.feedback).toEqual({ kind: "created" });
  });

  it("既存クライアントの保存では入力内容をPUTで送り、一覧の内容を更新する", async () => {
    const updated = { ...buildClient(1), name: "Renamed" };
    let sentBody: unknown;
    const { result } = await renderLoaded(1, (request) => {
      if (request.method !== "PUT" || request.url !== "/api/oauth-clients/client-1") return undefined;
      sentBody = request.body;
      return dataResponse(updated);
    });

    act(() => result.current.changeField("name", " Renamed "));
    await act(() => result.current.save());

    expect(sentBody).toEqual({
      name: "Renamed",
      uri: null,
      description: null,
      redirectUris: ["https://app1.example/callback"],
      jwks: buildClient(1).jwks,
    });
    expect(result.current.clients[0]?.name).toBe("Renamed");
    expect(result.current.isDirty).toBe(false);
    expect(result.current.feedback).toEqual({ kind: "saved" });
  });

  it("上限到達で登録できなかった場合は、エラーと入力内容を保持する", async () => {
    const { result } = await renderLoaded(1, (request) =>
      request.method === "POST" ? problemResponse(409, "CLIENT_LIMIT_REACHED") : undefined,
    );
    fillNewClient(result);

    await act(() => result.current.save());

    expect(result.current.feedback?.kind).toBe("saveFailed");
    expect(result.current.feedback?.kind === "saveFailed" && result.current.feedback.error).toMatchObject({
      code: "CLIENT_LIMIT_REACHED",
    });
    expect(result.current.form.name).toBe("New App");
    expect(result.current.editTarget).toEqual({ kind: "new" });
  });

  it("公開鍵の保存だけ失敗した場合は、エラーを保持し同じ内容で再保存できる", async () => {
    const { result } = await renderLoaded(1, (request) =>
      request.method === "PUT" ? problemResponse(500, "CLIENT_KEY_SAVE_FAILED") : undefined,
    );

    act(() => result.current.changeField("name", "Renamed"));
    await act(() => result.current.save());

    expect(result.current.feedback?.kind === "saveFailed" && result.current.feedback.error).toMatchObject({
      code: "CLIENT_KEY_SAVE_FAILED",
    });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.canSave).toBe(true);
  });
});

describe("useOAuthClients: 編集対象の切替", () => {
  it("未保存の変更がある状態の切替は保留し、破棄を選ぶと切り替える", async () => {
    const { result } = await renderLoaded(2);
    act(() => result.current.changeField("name", "Edited"));

    act(() => result.current.selectClient(buildClient(2)));
    expect(result.current.isSwitchConfirming).toBe(true);
    expect(result.current.editTarget).toEqual({ kind: "existing", client: buildClient(1) });

    act(() => result.current.discardAndSwitch());
    expect(result.current.isSwitchConfirming).toBe(false);
    expect(result.current.editTarget).toEqual({ kind: "existing", client: buildClient(2) });
    expect(result.current.form.name).toBe("App 2");
    expect(result.current.isDirty).toBe(false);
  });

  it("未保存の変更がある状態で新規登録へ切り替え、編集に戻ると入力内容を維持する", async () => {
    const { result } = await renderLoaded(2);
    act(() => result.current.changeField("name", "Edited"));

    act(() => result.current.startCreating());
    expect(result.current.isSwitchConfirming).toBe(true);

    act(() => result.current.keepEditing());
    expect(result.current.isSwitchConfirming).toBe(false);
    expect(result.current.editTarget).toEqual({ kind: "existing", client: buildClient(1) });
    expect(result.current.form.name).toBe("Edited");
  });

  it("未変更なら確認せずに切り替える", async () => {
    const { result } = await renderLoaded(2);

    act(() => result.current.selectClient(buildClient(2)));

    expect(result.current.isSwitchConfirming).toBe(false);
    expect(result.current.editTarget).toEqual({ kind: "existing", client: buildClient(2) });
  });
});

describe("useOAuthClients: 削除", () => {
  it("確認後に削除すると一覧から外し、編集対象を解除する", async () => {
    const { result, fetchMock } = await renderLoaded(2, (request) =>
      request.method === "DELETE" && request.url === "/api/oauth-clients/client-1" ? dataResponse({ ok: true }) : undefined,
    );

    act(() => result.current.requestDelete());
    expect(result.current.isDeleteConfirming).toBe(true);
    await act(() => result.current.confirmDelete());

    expect(fetchMock).toHaveBeenCalledWith("/api/oauth-clients/client-1", expect.objectContaining({ method: "DELETE" }));
    expect(result.current.isDeleteConfirming).toBe(false);
    expect(result.current.clients.map((client) => client.clientId)).toEqual(["client-2"]);
    expect(result.current.editTarget).toBeNull();
    expect(result.current.feedback).toEqual({ kind: "deleted" });
  });

  it("削除に失敗した場合はクライアントを残し、エラーを保持する", async () => {
    const { result } = await renderLoaded(1, (request) =>
      request.method === "DELETE" ? problemResponse(404, "NOT_FOUND") : undefined,
    );

    act(() => result.current.requestDelete());
    await act(() => result.current.confirmDelete());

    expect(result.current.clients).toHaveLength(1);
    expect(result.current.feedback?.kind).toBe("deleteFailed");
  });
});
