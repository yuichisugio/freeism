import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./share-table-dialog";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// Radix UIのモック
vi.mock("@radix-ui/react-dialog", () => ({
  Root: vi.fn(({ children, ...props }) => (
    <div data-testid="dialog-root" {...props}>
      {children}
    </div>
  )),
  Trigger: vi.fn(({ children, ...props }) => (
    <button data-testid="dialog-trigger" {...props}>
      {children}
    </button>
  )),
  Portal: vi.fn(({ children, ...props }) => (
    <div data-testid="dialog-portal" {...props}>
      {children}
    </div>
  )),
  Close: vi.fn(({ children, ...props }) => (
    <button data-testid="dialog-close" {...props}>
      {children}
    </button>
  )),
  Overlay: vi.fn(({ children, ...props }) => (
    <div data-testid="dialog-overlay" {...props}>
      {children}
    </div>
  )),
  Content: vi.fn(({ children, ...props }) => (
    <div data-testid="dialog-content" {...props}>
      {children}
    </div>
  )),
  Title: vi.fn(({ children, ...props }) => (
    <h2 data-testid="dialog-title" {...props}>
      {children}
    </h2>
  )),
  Description: vi.fn(({ children, ...props }) => (
    <p data-testid="dialog-description" {...props}>
      {children}
    </p>
  )),
}));

// lucide-reactのモック
vi.mock("lucide-react", () => ({
  XIcon: vi.fn(() => <svg data-testid="x-icon">X</svg>),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("Dialog Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("Dialog", () => {
    test("should render Dialog component correctly", () => {
      render(
        <Dialog>
          <div>Dialog content</div>
        </Dialog>,
      );

      const dialogRoot = screen.getByTestId("dialog-root");
      expect(dialogRoot).toBeInTheDocument();
      expect(dialogRoot).toHaveAttribute("data-slot", "dialog");
      expect(screen.getByText("Dialog content")).toBeInTheDocument();
    });

    test("should pass props to Dialog component", () => {
      render(
        <Dialog open={true} onOpenChange={vi.fn()}>
          <div>Dialog content</div>
        </Dialog>,
      );

      const dialogRoot = screen.getByTestId("dialog-root");
      expect(dialogRoot).toHaveAttribute("open");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogTrigger", () => {
    test("should render DialogTrigger component correctly", () => {
      render(
        <DialogTrigger>
          <span>Open Dialog</span>
        </DialogTrigger>,
      );

      const trigger = screen.getByTestId("dialog-trigger");
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute("data-slot", "dialog-trigger");
      expect(screen.getByText("Open Dialog")).toBeInTheDocument();
    });

    test("should pass props to DialogTrigger component", () => {
      render(
        <DialogTrigger className="custom-trigger" disabled>
          <span>Open Dialog</span>
        </DialogTrigger>,
      );

      const trigger = screen.getByTestId("dialog-trigger");
      expect(trigger).toHaveAttribute("class", "custom-trigger");
      expect(trigger).toHaveAttribute("disabled");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogPortal", () => {
    test("should render DialogPortal component correctly", () => {
      render(
        <DialogPortal>
          <div>Portal content</div>
        </DialogPortal>,
      );

      const portal = screen.getByTestId("dialog-portal");
      expect(portal).toBeInTheDocument();
      expect(portal).toHaveAttribute("data-slot", "dialog-portal");
      expect(screen.getByText("Portal content")).toBeInTheDocument();
    });

    test("should pass container prop to DialogPortal component", () => {
      const container = document.createElement("div");
      render(
        <DialogPortal container={container}>
          <div>Portal content</div>
        </DialogPortal>,
      );

      const portal = screen.getByTestId("dialog-portal");
      expect(portal).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogClose", () => {
    test("should render DialogClose component correctly", () => {
      render(
        <DialogClose>
          <span>Close</span>
        </DialogClose>,
      );

      const closeButton = screen.getByTestId("dialog-close");
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute("data-slot", "dialog-close");
      expect(screen.getByText("Close")).toBeInTheDocument();
    });

    test("should pass props to DialogClose component", () => {
      render(
        <DialogClose className="custom-close" type="button">
          <span>Close</span>
        </DialogClose>,
      );

      const closeButton = screen.getByTestId("dialog-close");
      expect(closeButton).toHaveAttribute("class", "custom-close");
      expect(closeButton).toHaveAttribute("type", "button");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogOverlay", () => {
    test("should render DialogOverlay component correctly", () => {
      render(
        <DialogOverlay>
          <div>Overlay content</div>
        </DialogOverlay>,
      );

      const overlay = screen.getByTestId("dialog-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("data-slot", "dialog-overlay");
      expect(screen.getByText("Overlay content")).toBeInTheDocument();
    });

    test("should apply custom className to DialogOverlay", () => {
      render(
        <DialogOverlay className="custom-overlay">
          <div>Overlay content</div>
        </DialogOverlay>,
      );

      const overlay = screen.getByTestId("dialog-overlay");
      expect(overlay).toHaveAttribute("class", expect.stringContaining("custom-overlay"));
    });

    test("should pass other props to DialogOverlay", () => {
      render(
        <DialogOverlay data-state="open">
          <div>Overlay content</div>
        </DialogOverlay>,
      );

      const overlay = screen.getByTestId("dialog-overlay");
      expect(overlay).toHaveAttribute("data-state", "open");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogContent", () => {
    test("should render DialogContent component correctly with default closeButton", () => {
      render(
        <DialogContent>
          <div>Content</div>
        </DialogContent>,
      );

      const content = screen.getByTestId("dialog-content");
      expect(content).toBeInTheDocument();
      expect(content).toHaveAttribute("data-slot", "dialog-content");
      expect(screen.getByText("Content")).toBeInTheDocument();

      // デフォルトでcloseButtonが表示される
      const closeButton = screen.getByTestId("dialog-close");
      expect(closeButton).toBeInTheDocument();
      expect(screen.getByTestId("x-icon")).toBeInTheDocument();
      expect(screen.getByText("Close")).toBeInTheDocument();
    });

    test("should not render close button when closeButton is false", () => {
      render(
        <DialogContent closeButton={false}>
          <div>Content</div>
        </DialogContent>,
      );

      const content = screen.getByTestId("dialog-content");
      expect(content).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();

      // closeButtonがfalseの場合、閉じるボタンが表示されない
      expect(screen.queryByTestId("dialog-close")).not.toBeInTheDocument();
      expect(screen.queryByTestId("x-icon")).not.toBeInTheDocument();
    });

    test("should apply custom className to DialogContent", () => {
      render(
        <DialogContent className="custom-content">
          <div>Content</div>
        </DialogContent>,
      );

      const content = screen.getByTestId("dialog-content");
      expect(content).toHaveAttribute("class", expect.stringContaining("custom-content"));
    });

    test("should pass container prop to DialogPortal", () => {
      const container = document.createElement("div");
      render(
        <DialogContent container={container}>
          <div>Content</div>
        </DialogContent>,
      );

      const portal = screen.getByTestId("dialog-portal");
      expect(portal).toBeInTheDocument();
    });

    test("should pass other props to DialogContent", () => {
      render(
        <DialogContent data-state="open" role="dialog">
          <div>Content</div>
        </DialogContent>,
      );

      const content = screen.getByTestId("dialog-content");
      expect(content).toHaveAttribute("data-state", "open");
      expect(content).toHaveAttribute("role", "dialog");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogHeader", () => {
    test("should render DialogHeader component correctly", () => {
      render(
        <DialogHeader>
          <h2>Header Title</h2>
          <p>Header description</p>
        </DialogHeader>,
      );

      const header = screen.getByText("Header Title").parentElement;
      expect(header).toBeInTheDocument();
      expect(header).toHaveAttribute("data-slot", "dialog-header");
      expect(screen.getByText("Header Title")).toBeInTheDocument();
      expect(screen.getByText("Header description")).toBeInTheDocument();
    });

    test("should apply custom className to DialogHeader", () => {
      render(
        <DialogHeader className="custom-header">
          <h2>Header Title</h2>
        </DialogHeader>,
      );

      const header = screen.getByText("Header Title").parentElement;
      expect(header).toHaveAttribute("class", expect.stringContaining("custom-header"));
    });

    test("should pass other props to DialogHeader", () => {
      render(
        <DialogHeader data-testid="custom-header" role="banner">
          <h2>Header Title</h2>
        </DialogHeader>,
      );

      const header = screen.getByTestId("custom-header");
      expect(header).toHaveAttribute("role", "banner");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogFooter", () => {
    test("should render DialogFooter component correctly", () => {
      render(
        <DialogFooter>
          <button>Cancel</button>
          <button>OK</button>
        </DialogFooter>,
      );

      const footer = screen.getByText("Cancel").parentElement;
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveAttribute("data-slot", "dialog-footer");
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("OK")).toBeInTheDocument();
    });

    test("should apply custom className to DialogFooter", () => {
      render(
        <DialogFooter className="custom-footer">
          <button>OK</button>
        </DialogFooter>,
      );

      const footer = screen.getByText("OK").parentElement;
      expect(footer).toHaveAttribute("class", expect.stringContaining("custom-footer"));
    });

    test("should pass other props to DialogFooter", () => {
      render(
        <DialogFooter data-testid="custom-footer" role="contentinfo">
          <button>OK</button>
        </DialogFooter>,
      );

      const footer = screen.getByTestId("custom-footer");
      expect(footer).toHaveAttribute("role", "contentinfo");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogTitle", () => {
    test("should render DialogTitle component correctly", () => {
      render(<DialogTitle>Dialog Title</DialogTitle>);

      const title = screen.getByTestId("dialog-title");
      expect(title).toBeInTheDocument();
      expect(title).toHaveAttribute("data-slot", "dialog-title");
      expect(screen.getByText("Dialog Title")).toBeInTheDocument();
    });

    test("should apply custom className to DialogTitle", () => {
      render(<DialogTitle className="custom-title">Dialog Title</DialogTitle>);

      const title = screen.getByTestId("dialog-title");
      expect(title).toHaveAttribute("class", expect.stringContaining("custom-title"));
    });

    test("should pass other props to DialogTitle", () => {
      render(
        <DialogTitle id="dialog-title" role="heading">
          Dialog Title
        </DialogTitle>,
      );

      const title = screen.getByTestId("dialog-title");
      expect(title).toHaveAttribute("id", "dialog-title");
      expect(title).toHaveAttribute("role", "heading");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogDescription", () => {
    test("should render DialogDescription component correctly", () => {
      render(<DialogDescription>Dialog description text</DialogDescription>);

      const description = screen.getByTestId("dialog-description");
      expect(description).toBeInTheDocument();
      expect(description).toHaveAttribute("data-slot", "dialog-description");
      expect(screen.getByText("Dialog description text")).toBeInTheDocument();
    });

    test("should apply custom className to DialogDescription", () => {
      render(<DialogDescription className="custom-description">Dialog description text</DialogDescription>);

      const description = screen.getByTestId("dialog-description");
      expect(description).toHaveAttribute("class", expect.stringContaining("custom-description"));
    });

    test("should pass other props to DialogDescription", () => {
      render(
        <DialogDescription id="dialog-desc" role="note">
          Dialog description text
        </DialogDescription>,
      );

      const description = screen.getByTestId("dialog-description");
      expect(description).toHaveAttribute("id", "dialog-desc");
      expect(description).toHaveAttribute("role", "note");
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("Integration Tests", () => {
    test("should render complete dialog structure", () => {
      render(
        <Dialog open={true}>
          <DialogTrigger>
            <button>Open Dialog</button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Dialog</DialogTitle>
              <DialogDescription>This is a test dialog</DialogDescription>
            </DialogHeader>
            <div>Dialog body content</div>
            <DialogFooter>
              <DialogClose>
                <button>Cancel</button>
              </DialogClose>
              <button>OK</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );

      // 全てのコンポーネントが正しくレンダリングされることを確認
      expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
      expect(screen.getByText("Test Dialog")).toBeInTheDocument();
      expect(screen.getByText("This is a test dialog")).toBeInTheDocument();
      expect(screen.getByText("Dialog body content")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("OK")).toBeInTheDocument();
    });

    test("should render dialog with minimal structure", () => {
      render(
        <Dialog>
          <DialogContent closeButton={false}>
            <div>Minimal content</div>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
      expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
      expect(screen.getByText("Minimal content")).toBeInTheDocument();
      expect(screen.queryByTestId("dialog-close")).not.toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("Edge Cases and Boundary Tests", () => {
    test("should handle empty children", () => {
      render(<Dialog />);
      expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
    });

    test("should handle null children", () => {
      render(<Dialog>{null}</Dialog>);
      expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
    });

    test("should handle undefined className", () => {
      render(
        <DialogOverlay className={undefined}>
          <div>Content</div>
        </DialogOverlay>,
      );
      expect(screen.getByTestId("dialog-overlay")).toBeInTheDocument();
    });

    test("should handle empty className", () => {
      render(
        <DialogContent className="">
          <div>Content</div>
        </DialogContent>,
      );
      expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    });

    test("should handle multiple className values", () => {
      render(
        <DialogHeader className="class1 class2 class3">
          <div>Content</div>
        </DialogHeader>,
      );
      const header = screen.getByText("Content").parentElement;
      expect(header).toHaveAttribute("class", expect.stringContaining("class1"));
      expect(header).toHaveAttribute("class", expect.stringContaining("class2"));
      expect(header).toHaveAttribute("class", expect.stringContaining("class3"));
    });

    test("should handle closeButton prop with truthy values", () => {
      render(
        <DialogContent closeButton={1 as unknown as boolean}>
          <div>Content</div>
        </DialogContent>,
      );
      expect(screen.getByTestId("dialog-close")).toBeInTheDocument();
    });

    test("should handle closeButton prop with falsy values", () => {
      render(
        <DialogContent closeButton={0 as unknown as boolean}>
          <div>Content</div>
        </DialogContent>,
      );
      expect(screen.queryByTestId("dialog-close")).not.toBeInTheDocument();
    });

    test("should handle container prop as null", () => {
      render(
        <DialogContent container={null}>
          <div>Content</div>
        </DialogContent>,
      );
      expect(screen.getByTestId("dialog-portal")).toBeInTheDocument();
    });

    test("should handle very long text content", () => {
      const longText = "A".repeat(1000);
      render(<DialogDescription>{longText}</DialogDescription>);
      expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    test("should handle special characters in content", () => {
      const specialText = "Special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?";
      render(<DialogTitle>{specialText}</DialogTitle>);
      expect(screen.getByText(specialText)).toBeInTheDocument();
    });

    test("should handle nested components", () => {
      render(
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span>
                Nested <strong>Title</strong>
              </span>
            </DialogTitle>
          </DialogHeader>
        </DialogContent>,
      );
      expect(screen.getByText("Nested")).toBeInTheDocument();
      expect(screen.getByText("Title")).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("Accessibility Tests", () => {
    test("should have proper ARIA attributes", () => {
      render(
        <DialogContent role="dialog" aria-labelledby="title" aria-describedby="desc">
          <DialogTitle id="title">Accessible Title</DialogTitle>
          <DialogDescription id="desc">Accessible Description</DialogDescription>
        </DialogContent>,
      );

      const content = screen.getByTestId("dialog-content");
      expect(content).toHaveAttribute("role", "dialog");
      expect(content).toHaveAttribute("aria-labelledby", "title");
      expect(content).toHaveAttribute("aria-describedby", "desc");
    });

    test("should have screen reader text for close button", () => {
      render(
        <DialogContent>
          <div>Content</div>
        </DialogContent>,
      );

      expect(screen.getByText("Close")).toBeInTheDocument();
    });

    test("should support custom ARIA labels", () => {
      render(
        <DialogTrigger aria-label="Open settings dialog">
          <button>Settings</button>
        </DialogTrigger>,
      );

      const trigger = screen.getByTestId("dialog-trigger");
      expect(trigger).toHaveAttribute("aria-label", "Open settings dialog");
    });
  });
});
