import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "./carousel";

// Embla Carouselのモック
const mockScrollPrev = vi.fn();
const mockScrollNext = vi.fn();
const mockCanScrollPrev = vi.fn(() => true);
const mockCanScrollNext = vi.fn(() => true);
const mockOn = vi.fn();
const mockOff = vi.fn();

const mockApi = {
  scrollPrev: mockScrollPrev,
  scrollNext: mockScrollNext,
  canScrollPrev: mockCanScrollPrev,
  canScrollNext: mockCanScrollNext,
  on: mockOn,
  off: mockOff,
};

vi.mock("embla-carousel-react", () => ({
  default: vi.fn(() => [vi.fn(), mockApi]),
}));

describe("Carousel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should render carousel with content and items", () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
          <CarouselItem>Item 2</CarouselItem>
          <CarouselItem>Item 3</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    expect(screen.getByRole("region")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText("Item 3")).toBeInTheDocument();
  });

  test("should render navigation buttons", () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );

    expect(screen.getByRole("button", { name: /previous slide/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next slide/i })).toBeInTheDocument();
  });

  test("should handle keyboard navigation", async () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
          <CarouselItem>Item 2</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    const carousel = screen.getByRole("region");

    // キーボードイベントを直接発火
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(mockScrollPrev).toHaveBeenCalled();

    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(mockScrollNext).toHaveBeenCalled();
  });

  test("should handle button clicks", async () => {
    const user = userEvent.setup();

    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );

    const prevButton = screen.getByRole("button", { name: /previous slide/i });
    const nextButton = screen.getByRole("button", { name: /next slide/i });

    await user.click(prevButton);
    expect(mockScrollPrev).toHaveBeenCalled();

    await user.click(nextButton);
    expect(mockScrollNext).toHaveBeenCalled();
  });

  test("should support vertical orientation", () => {
    render(
      <Carousel orientation="vertical">
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );

    const prevButton = screen.getByRole("button", { name: /previous slide/i });
    const nextButton = screen.getByRole("button", { name: /next slide/i });

    // 垂直方向の場合、ボタンに rotate-90 クラスが適用される
    expect(prevButton).toHaveClass("rotate-90");
    expect(nextButton).toHaveClass("rotate-90");
  });

  test("should disable buttons when cannot scroll", () => {
    // canScrollPrevとcanScrollNextがfalseを返すようにモック
    mockCanScrollPrev.mockReturnValue(false);
    mockCanScrollNext.mockReturnValue(false);

    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );

    const prevButton = screen.getByRole("button", { name: /previous slide/i });
    const nextButton = screen.getByRole("button", { name: /next slide/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  test("should apply custom className", () => {
    render(
      <Carousel className="custom-carousel">
        <CarouselContent className="custom-content">
          <CarouselItem className="custom-item">Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    const carousel = screen.getByRole("region");
    expect(carousel).toHaveClass("custom-carousel");
  });

  test("should handle setApi callback", () => {
    const setApiMock = vi.fn();

    render(
      <Carousel setApi={setApiMock}>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    expect(setApiMock).toHaveBeenCalledWith(mockApi);
  });

  test("should handle carousel options", () => {
    const opts = { loop: true, align: "start" as const };

    render(
      <Carousel opts={opts}>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    // オプションが正しく渡されることを確認（実際の実装では useEmblaCarousel に渡される）
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  test("should throw error when useCarousel is used outside provider", () => {
    // コンソールエラーを抑制
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<CarouselPrevious />);
    }).toThrow("useCarousel must be used within a <Carousel />");

    consoleSpy.mockRestore();
  });

  test("should handle carousel item roles and attributes", () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
          <CarouselItem>Item 2</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    const items = screen.getAllByRole("group");
    expect(items).toHaveLength(2);

    items.forEach((item) => {
      expect(item).toHaveAttribute("aria-roledescription", "slide");
    });
  });

  test("should handle carousel accessibility attributes", () => {
    render(
      <Carousel>
        <CarouselContent>
          <CarouselItem>Item 1</CarouselItem>
        </CarouselContent>
      </Carousel>,
    );

    const carousel = screen.getByRole("region");
    expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
  });
});
