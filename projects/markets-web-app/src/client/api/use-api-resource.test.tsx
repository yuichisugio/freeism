import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import { type ApiResource, useApiResource } from "./use-api-resource";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("useApiResource", () => {
  it("clears stale private data when a reload fails", async () => {
    let fail = false;
    const load = vi.fn(async () => {
      if (fail) throw new Error("SESSION_EXPIRED");
      return "private-data";
    });
    let resource: ApiResource<string> | null = null;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness() {
      resource = useApiResource(load, { clearOnError: true });
      return <output>{`${resource.data ?? "none"}:${resource.error?.message ?? "ok"}`}</output>;
    }

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });
    expect(container.textContent).toBe("private-data:ok");

    fail = true;
    await act(async () => {
      resource!.reload();
      await Promise.resolve();
    });
    expect(container.textContent).toBe("none:SESSION_EXPIRED");
    await act(async () => root.unmount());
  });

  it("retains data by default so transient polling errors can recover", async () => {
    let fail = false;
    const load = vi.fn(async () => {
      if (fail) throw new Error("TEMPORARY_FAILURE");
      return "settlement-data";
    });
    let resource: ApiResource<string> | null = null;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness() {
      resource = useApiResource(load);
      return <output>{`${resource.data ?? "none"}:${resource.error?.message ?? "ok"}`}</output>;
    }

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });
    fail = true;
    await act(async () => {
      resource!.reload();
      await Promise.resolve();
    });

    expect(container.textContent).toBe("settlement-data:TEMPORARY_FAILURE");
    await act(async () => root.unmount());
  });

  it("clears private data on an unauthorized response by default", async () => {
    let unauthorized = false;
    const load = vi.fn(async () => {
      if (unauthorized) throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });
      return "points-connection-active";
    });
    let resource: ApiResource<string> | null = null;
    const container = document.createElement("div");
    const root = createRoot(container);

    function Harness() {
      resource = useApiResource(load);
      return <output>{`${resource.data ?? "none"}:${resource.error?.message ?? "ok"}`}</output>;
    }

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });
    unauthorized = true;
    await act(async () => {
      resource!.reload();
      await Promise.resolve();
    });

    expect(container.textContent).toBe("none:UNAUTHORIZED");
    await act(async () => root.unmount());
  });
});
