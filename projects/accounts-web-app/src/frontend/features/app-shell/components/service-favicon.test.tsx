// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ServiceFavicon } from "./service-favicon";

afterEach(() => {
  cleanup();
});

describe("ServiceFavicon", () => {
  it("ホストのファビコンをGoogleのファビコン配信から64pxで読み込む", () => {
    const { container } = render(<ServiceFavicon host="github.com" />);

    const image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://www.google.com/s2/favicons?domain=github.com&sz=64");
    expect(image?.getAttribute("alt")).toBe("");
  });

  it("読み込みに失敗したら、地球儀のアイコンに差し替える", () => {
    const { container } = render(<ServiceFavicon host="hanako.dev" />);

    fireEvent.error(container.querySelector("img") as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
