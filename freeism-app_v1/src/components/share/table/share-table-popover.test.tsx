import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./share-table-popover";

// Radix UIのPopoverコンポーネントをモック
vi.mock("@radix-ui/react-popover", () => ({
  Root: vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
    // propsを適切にHTMLの属性として設定
    const htmlProps: Record<string, string> = {};
    Object.entries(props).forEach(([key, value]) => {
      if (typeof value === "boolean") {
        if (value) htmlProps[key] = "";
      } else if (value !== undefined && value !== null && typeof value !== "object" && typeof value !== "function") {
        htmlProps[key] = value as string;
      }
    });
    return (
      <div data-testid="popover-root" {...htmlProps}>
        {children}
      </div>
    );
  }),
  Trigger: vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
    // propsを適切にHTMLの属性として設定
    const htmlProps: Record<string, string> = {};
    Object.entries(props).forEach(([key, value]) => {
      if (typeof value === "boolean") {
        if (value) htmlProps[key] = "";
      } else if (value !== undefined && value !== null && typeof value !== "object" && typeof value !== "function") {
        htmlProps[key] = value as string;
      }
    });
    return (
      <button data-testid="popover-trigger" {...htmlProps}>
        {children}
      </button>
    );
  }),
  Portal: vi.fn(({ children, container }: { children: React.ReactNode; container?: HTMLElement | null }) => (
    <div data-testid="popover-portal" data-container={container ? "custom" : "default"}>
      {children}
    </div>
  )),
  Content: vi.fn(
    ({
      children,
      align,
      sideOffset,
      className,
      ...props
    }: {
      children: React.ReactNode;
      align?: string;
      sideOffset?: number;
      className?: string;
      [key: string]: unknown;
    }) => {
      // propsを適切にHTMLの属性として設定
      const htmlProps: Record<string, string> = {};
      Object.entries(props).forEach(([key, value]) => {
        if (typeof value === "boolean") {
          if (value) htmlProps[key] = "";
        } else if (value !== undefined && value !== null && typeof value !== "object" && typeof value !== "function") {
          htmlProps[key] = value as string;
        }
      });
      return (
        <div
          data-testid="popover-content"
          data-align={align}
          data-side-offset={sideOffset}
          className={className}
          {...htmlProps}
        >
          {children}
        </div>
      );
    },
  ),
  Anchor: vi.fn(({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
    // propsを適切にHTMLの属性として設定
    const htmlProps: Record<string, string> = {};
    Object.entries(props).forEach(([key, value]) => {
      if (typeof value === "boolean") {
        if (value) htmlProps[key] = "";
      } else if (value !== undefined && value !== null && typeof value !== "object" && typeof value !== "function") {
        htmlProps[key] = value as string;
      }
    });
    return (
      <div data-testid="popover-anchor" {...htmlProps}>
        {children}
      </div>
    );
  }),
}));

describe("share-table-popover", () => {
  describe("Popover", () => {
    test("should render Popover component correctly", () => {
      render(
        <Popover>
          <div>Test content</div>
        </Popover>,
      );

      const popover = screen.getByTestId("popover-root");
      expect(popover).toBeInTheDocument();
      expect(popover).toHaveAttribute("data-slot", "popover");
      expect(popover).toHaveTextContent("Test content");
    });

    test("should pass through all props to Radix Popover Root", () => {
      const onOpenChange = vi.fn();

      render(
        <Popover open={true} onOpenChange={onOpenChange} modal={false}>
          <div>Test content</div>
        </Popover>,
      );

      const popover = screen.getByTestId("popover-root");
      // data-slot属性が正しく設定されることを確認
      expect(popover).toHaveAttribute("data-slot", "popover");
      // propsが渡されることを確認（モックの実装に依存）
      expect(popover).toBeInTheDocument();
    });
  });

  describe("PopoverTrigger", () => {
    test("should render PopoverTrigger component correctly", () => {
      render(
        <PopoverTrigger>
          <span>Trigger content</span>
        </PopoverTrigger>,
      );

      const trigger = screen.getByTestId("popover-trigger");
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute("data-slot", "popover-trigger");
      expect(trigger).toHaveTextContent("Trigger content");
    });

    test("should pass through all props to Radix Popover Trigger", () => {
      const testProps = {
        asChild: true,
        disabled: false,
      };

      render(
        <PopoverTrigger {...testProps}>
          <span>Trigger content</span>
        </PopoverTrigger>,
      );

      const trigger = screen.getByTestId("popover-trigger");
      // boolean値はHTMLでは空文字列として設定される
      expect(trigger).toHaveAttribute("asChild");
      // false値のboolean属性は設定されない
      expect(trigger).not.toHaveAttribute("disabled");
    });
  });

  describe("PopoverContent", () => {
    test("should render PopoverContent component correctly", () => {
      render(
        <PopoverContent>
          <div>Content text</div>
        </PopoverContent>,
      );

      const portal = screen.getByTestId("popover-portal");
      const content = screen.getByTestId("popover-content");

      expect(portal).toBeInTheDocument();
      expect(content).toBeInTheDocument();
      expect(content).toHaveAttribute("data-slot", "popover-content");
      expect(content).toHaveTextContent("Content text");
    });

    test("should apply default props correctly", () => {
      render(
        <PopoverContent>
          <div>Content text</div>
        </PopoverContent>,
      );

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("data-align", "center");
      expect(content).toHaveAttribute("data-side-offset", "4");
    });

    test("should override default props when provided", () => {
      render(
        <PopoverContent align="start" sideOffset={8}>
          <div>Content text</div>
        </PopoverContent>,
      );

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("data-align", "start");
      expect(content).toHaveAttribute("data-side-offset", "8");
    });

    test("should apply custom className using cn function", () => {
      render(
        <PopoverContent className="custom-class">
          <div>Content text</div>
        </PopoverContent>,
      );

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveClass("custom-class");
      // デフォルトクラスも含まれることを確認
      expect(content).toHaveClass("z-50", "w-72", "rounded-md", "border");
    });

    test("should handle container prop for Portal", () => {
      const customContainer = document.createElement("div");
      document.body.appendChild(customContainer);

      render(
        <PopoverContent container={customContainer}>
          <div>Content text</div>
        </PopoverContent>,
      );

      const portal = screen.getByTestId("popover-portal");
      expect(portal).toHaveAttribute("data-container", "custom");

      document.body.removeChild(customContainer);
    });

    test("should use default container when container prop is not provided", () => {
      render(
        <PopoverContent>
          <div>Content text</div>
        </PopoverContent>,
      );

      const portal = screen.getByTestId("popover-portal");
      expect(portal).toHaveAttribute("data-container", "default");
    });

    test("should handle null container prop", () => {
      render(
        <PopoverContent container={null}>
          <div>Content text</div>
        </PopoverContent>,
      );

      const portal = screen.getByTestId("popover-portal");
      expect(portal).toHaveAttribute("data-container", "default");
    });

    test("should pass through all other props to Radix Popover Content", () => {
      const testProps = {
        side: "bottom" as const,
        alignOffset: 10,
        avoidCollisions: true,
        collisionBoundary: [],
        collisionPadding: 5,
        arrowPadding: 8,
        sticky: "partial" as const,
        hideWhenDetached: false,
      };

      render(
        <PopoverContent {...testProps}>
          <div>Content text</div>
        </PopoverContent>,
      );

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("side", "bottom");
      expect(content).toHaveAttribute("alignOffset", "10");
      // boolean値はHTMLでは空文字列として設定される
      expect(content).toHaveAttribute("avoidCollisions");
      expect(content).toHaveAttribute("collisionPadding", "5");
      expect(content).toHaveAttribute("arrowPadding", "8");
      expect(content).toHaveAttribute("sticky", "partial");
      // false値のboolean属性は設定されない
      expect(content).not.toHaveAttribute("hideWhenDetached");
    });
  });

  describe("PopoverAnchor", () => {
    test("should render PopoverAnchor component correctly", () => {
      render(
        <PopoverAnchor>
          <div>Anchor content</div>
        </PopoverAnchor>,
      );

      const anchor = screen.getByTestId("popover-anchor");
      expect(anchor).toBeInTheDocument();
      expect(anchor).toHaveAttribute("data-slot", "popover-anchor");
      expect(anchor).toHaveTextContent("Anchor content");
    });

    test("should pass through all props to Radix Popover Anchor", () => {
      const testProps = {
        asChild: true,
        virtualRef: { current: null },
      };

      render(
        <PopoverAnchor {...testProps}>
          <div>Anchor content</div>
        </PopoverAnchor>,
      );

      const anchor = screen.getByTestId("popover-anchor");
      // boolean値はHTMLでは空文字列として設定される
      expect(anchor).toHaveAttribute("asChild");
    });
  });

  describe("Integration tests", () => {
    test("should work together as a complete popover", () => {
      render(
        <Popover>
          <PopoverTrigger>
            <button>Open Popover</button>
          </PopoverTrigger>
          <PopoverContent>
            <div>Popover content</div>
          </PopoverContent>
        </Popover>,
      );

      const popover = screen.getByTestId("popover-root");
      const trigger = screen.getByTestId("popover-trigger");
      const portal = screen.getByTestId("popover-portal");
      const content = screen.getByTestId("popover-content");

      expect(popover).toBeInTheDocument();
      expect(trigger).toBeInTheDocument();
      expect(portal).toBeInTheDocument();
      expect(content).toBeInTheDocument();

      expect(trigger).toHaveTextContent("Open Popover");
      expect(content).toHaveTextContent("Popover content");
    });

    test("should handle empty children gracefully", () => {
      render(
        <Popover>
          <PopoverTrigger />
          <PopoverContent />
        </Popover>,
      );

      const popover = screen.getByTestId("popover-root");
      const trigger = screen.getByTestId("popover-trigger");
      const content = screen.getByTestId("popover-content");

      expect(popover).toBeInTheDocument();
      expect(trigger).toBeInTheDocument();
      expect(content).toBeInTheDocument();
    });

    test("should handle multiple PopoverContent instances", () => {
      render(
        <div>
          <PopoverContent align="start">
            <div>First content</div>
          </PopoverContent>
          <PopoverContent align="end">
            <div>Second content</div>
          </PopoverContent>
        </div>,
      );

      const contents = screen.getAllByTestId("popover-content");
      expect(contents).toHaveLength(2);

      expect(contents[0]).toHaveAttribute("data-align", "start");
      expect(contents[1]).toHaveAttribute("data-align", "end");

      expect(contents[0]).toHaveTextContent("First content");
      expect(contents[1]).toHaveTextContent("Second content");
    });
  });

  describe("Edge cases", () => {
    test("should handle undefined className in PopoverContent", () => {
      render(
        <PopoverContent className={undefined}>
          <div>Content</div>
        </PopoverContent>,
      );

      const content = screen.getByTestId("popover-content");
      expect(content).toBeInTheDocument();
      expect(content).toHaveClass("z-50", "w-72", "rounded-md", "border");
    });

    test("should handle zero sideOffset in PopoverContent", () => {
      render(
        <PopoverContent sideOffset={0}>
          <div>Content</div>
        </PopoverContent>,
      );

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("data-side-offset", "0");
    });

    test("should handle negative sideOffset in PopoverContent", () => {
      render(
        <PopoverContent sideOffset={-5}>
          <div>Content</div>
        </PopoverContent>,
      );

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("data-side-offset", "-5");
    });

    test("should handle all align options in PopoverContent", () => {
      const alignOptions = ["start", "center", "end"] as const;

      alignOptions.forEach((align) => {
        const { unmount } = render(
          <PopoverContent align={align}>
            <div>Content</div>
          </PopoverContent>,
        );

        const content = screen.getByTestId("popover-content");
        expect(content).toHaveAttribute("data-align", align);

        unmount();
      });
    });
  });
});
