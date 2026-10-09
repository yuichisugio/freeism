import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAuthMock = vi.hoisted(() => vi.fn<() => { $context: Promise<unknown> }>());
vi.mock("./create-auth", () => ({ createAuth: createAuthMock }));

/**
 * 初期化の結果だけを持つ、Better Authの代わりのインスタンスを作る。
 */
function createFakeAuth(providerIds: string[] | Error) {
  const context =
    providerIds instanceof Error
      ? Promise.reject(providerIds)
      : Promise.resolve({ socialProviders: providerIds.map((id) => ({ id })) });
  return { $context: context };
}

/**
 * isolate内の共有状態を持たない`getAuth`を読み込む。
 */
async function importGetAuth() {
  vi.resetModules();
  const { getAuth } = await import("./auth");
  return getAuth;
}

beforeEach(() => {
  createAuthMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getAuth", () => {
  it("初期化に成功したインスタンスを共有する", async () => {
    createAuthMock.mockImplementation(() => createFakeAuth(["orcid", "google", "github"]));
    const getAuth = await importGetAuth();

    const first = getAuth();
    await first.$context;

    expect(getAuth()).toBe(first);
    expect(createAuthMock).toHaveBeenCalledTimes(1);
  });

  it("初期化に失敗したインスタンスは捨て、次の要求で作り直す", async () => {
    createAuthMock
      .mockImplementationOnce(() => createFakeAuth(new Error("D1_ERROR")))
      .mockImplementationOnce(() => createFakeAuth(["orcid", "google", "github"]));
    const getAuth = await importGetAuth();

    const first = getAuth();
    await expect(first.$context).rejects.toThrow("D1_ERROR");
    const second = getAuth();
    await second.$context;

    expect(second).not.toBe(first);
    expect(getAuth()).toBe(second);
  });

  it("ORCIDを登録できなかったインスタンスは、作成から60秒間は共有し、その後の要求で作り直す", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const createdAt = Date.now();
    createAuthMock
      .mockImplementationOnce(() => createFakeAuth(["google", "github"]))
      .mockImplementationOnce(() => createFakeAuth(["orcid", "google", "github"]));
    const getAuth = await importGetAuth();

    const first = getAuth();
    await first.$context;
    vi.setSystemTime(createdAt + 59_999);
    expect(getAuth()).toBe(first);

    vi.setSystemTime(createdAt + 60_000);
    const second = getAuth();
    await second.$context;
    vi.setSystemTime(createdAt + 120_000);

    expect(second).not.toBe(first);
    expect(getAuth()).toBe(second);
  });
});
