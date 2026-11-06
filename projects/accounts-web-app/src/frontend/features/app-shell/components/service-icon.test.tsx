// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ServiceIcon } from "./service-icon";

afterEach(() => {
  cleanup();
});

describe("ServiceIcon", () => {
  it("OAuth Providerはファビコンを読み込まず、ログインボタンと同じブランドのアイコンを表示する", () => {
    const { container } = render(<ServiceIcon icon={{ type: "provider", provider: "orcid" }} />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("ホストのファビコンをGoogleのファビコン配信から64pxで読み込む", () => {
    const { container } = render(<ServiceIcon icon={{ type: "favicon", host: "hanako.dev" }} />);

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://www.google.com/s2/favicons?domain=hanako.dev&sz=64");
    expect(image?.getAttribute("alt")).toBe("");
  });

  it("配信の既定画像（16px）が返ったら、地球儀のアイコンに差し替える", () => {
    const { container } = render(<ServiceIcon icon={{ type: "favicon", host: "hanako.dev" }} />);
    const image = container.querySelector("img") as HTMLImageElement;

    Object.defineProperty(image, "naturalWidth", { value: 16 });
    fireEvent.load(image);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("64pxで取得できたファビコンはそのまま表示する", () => {
    const { container } = render(<ServiceIcon icon={{ type: "favicon", host: "gitlab.com" }} />);
    const image = container.querySelector("img") as HTMLImageElement;

    Object.defineProperty(image, "naturalWidth", { value: 64 });
    fireEvent.load(image);

    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("読み込みに失敗したら、地球儀のアイコンに差し替える", () => {
    const { container } = render(<ServiceIcon icon={{ type: "favicon", host: "hanako.dev" }} />);

    fireEvent.error(container.querySelector("img") as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
