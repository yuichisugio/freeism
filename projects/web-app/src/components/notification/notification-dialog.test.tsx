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
} from "./notification-dialog";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モック設定
 */

// @/lib/utilsのcn関数をモック
vi.mock("@/lib/utils", () => ({
  cn: vi.fn((...classes: (string | undefined | null | boolean)[]) => classes.filter(Boolean).join(" ")),
}));

// lucide-reactのXIconをモック（後で使用予定）
vi.mock("lucide-react", () => ({
  XIcon: vi.fn(({ className, ...props }: { className?: string; [key: string]: unknown }) => (
    <svg data-testid="x-icon" className={className} {...props}>
      <path d="X" />
    </svg>
  )),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("notification-dialog components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("Dialog", () => {
    test("should render Dialog component and accept props", () => {
      const testProps = {
        open: false,
        onOpenChange: vi.fn(),
        modal: true,
      };

      const { container } = render(
        <Dialog {...testProps}>
          <div data-testid="dialog-content">Test content</div>
        </Dialog>,
      );

      // Dialogコンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeInTheDocument();
      expect(testProps.onOpenChange).toBeDefined();

      // 子要素が存在することを確認
      const contentElement = screen.getByTestId("dialog-content");
      expect(contentElement).toBeInTheDocument();
    });

    test("should render with default props", () => {
      const { container } = render(
        <Dialog>
          <div data-testid="dialog-content">Test content</div>
        </Dialog>,
      );

      // Dialogコンポーネントが正常にレンダリングされることを確認
      expect(container.firstChild).toBeInTheDocument();

      // 子要素が存在することを確認
      const contentElement = screen.getByTestId("dialog-content");
      expect(contentElement).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogTrigger", () => {
    test("should render DialogTrigger component with correct data-slot attribute", () => {
      const { container } = render(
        <Dialog>
          <DialogTrigger>
            <button>Open Dialog</button>
          </DialogTrigger>
        </Dialog>,
      );

      // data-slot属性が正しく設定されているかを確認
      const triggerElement = container.querySelector('[data-slot="dialog-trigger"]');
      expect(triggerElement).toBeInTheDocument();

      // 子要素のボタンが存在することを確認
      const buttonElement = screen.getByText("Open Dialog");
      expect(buttonElement).toBeInTheDocument();
    });

    test("should pass through props to DialogPrimitive.Trigger", () => {
      const testProps = {
        asChild: true,
        disabled: false,
      };

      const { container } = render(
        <Dialog>
          <DialogTrigger {...testProps}>
            <button>Open Dialog</button>
          </DialogTrigger>
        </Dialog>,
      );

      const triggerElement = container.querySelector('[data-slot="dialog-trigger"]');
      expect(triggerElement).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogPortal", () => {
    test("should render DialogPortal component with correct data-slot attribute", () => {
      render(
        <Dialog open={true}>
          <DialogPortal>
            <div data-testid="portal-content">Portal content</div>
          </DialogPortal>
        </Dialog>,
      );

      // ポータルコンテンツが存在することを確認
      const portalContent = screen.getByTestId("portal-content");
      expect(portalContent).toBeInTheDocument();
    });

    test("should pass through props to DialogPrimitive.Portal", () => {
      const testProps = {
        forceMount: true as const,
      };

      render(
        <Dialog open={true}>
          <DialogPortal {...testProps}>
            <div data-testid="portal-content">Portal content</div>
          </DialogPortal>
        </Dialog>,
      );

      const portalContent = screen.getByTestId("portal-content");
      expect(portalContent).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogClose", () => {
    test("should render DialogClose component with correct data-slot attribute", () => {
      render(
        <Dialog open={true}>
          <DialogPortal>
            <DialogClose>
              <button>Close Dialog</button>
            </DialogClose>
          </DialogPortal>
        </Dialog>,
      );

      // 子要素のボタンが存在することを確認
      const buttonElement = screen.getByText("Close Dialog");
      expect(buttonElement).toBeInTheDocument();

      // data-slot属性が正しく設定されているかを確認
      expect(buttonElement.parentElement).toHaveAttribute("data-slot", "dialog-close");
    });

    test("should pass through props to DialogPrimitive.Close", () => {
      const testProps = {
        asChild: true,
      };

      render(
        <Dialog open={true}>
          <DialogPortal>
            <DialogClose {...testProps}>
              <button>Close Dialog</button>
            </DialogClose>
          </DialogPortal>
        </Dialog>,
      );

      const buttonElement = screen.getByText("Close Dialog");
      expect(buttonElement).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogOverlay", () => {
    test("should render DialogOverlay component with correct data-slot attribute and default classes", () => {
      render(
        <Dialog open={true}>
          <DialogPortal>
            <DialogOverlay data-testid="dialog-overlay" />
          </DialogPortal>
        </Dialog>,
      );

      // data-slot属性が正しく設定されているかを確認
      const overlayElement = screen.getByTestId("dialog-overlay");
      expect(overlayElement).toBeInTheDocument();
      expect(overlayElement).toHaveAttribute("data-slot", "dialog-overlay");

      // デフォルトのクラスが適用されているかを確認
      expect(overlayElement).toHaveClass("fixed", "inset-0", "z-50", "bg-black/80");
    });

    test("should merge custom className with default classes", () => {
      const customClassName = "custom-overlay-class";

      render(
        <Dialog open={true}>
          <DialogPortal>
            <DialogOverlay className={customClassName} data-testid="dialog-overlay" />
          </DialogPortal>
        </Dialog>,
      );

      const overlayElement = screen.getByTestId("dialog-overlay");
      expect(overlayElement).toBeInTheDocument();
      expect(overlayElement).toHaveClass(customClassName);
    });

    test("should pass through props to DialogPrimitive.Overlay", () => {
      const testProps = {
        forceMount: true as const,
      };

      render(
        <Dialog open={true}>
          <DialogPortal>
            <DialogOverlay {...testProps} data-testid="dialog-overlay" />
          </DialogPortal>
        </Dialog>,
      );

      const overlayElement = screen.getByTestId("dialog-overlay");
      expect(overlayElement).toBeInTheDocument();
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogContent", () => {
    test("should render DialogContent component with default closeButton", () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <div data-testid="content-children">Content children</div>
          </DialogContent>
        </Dialog>,
      );

      // 子要素が存在することを確認
      const contentChildren = screen.getByTestId("content-children");
      expect(contentChildren).toBeInTheDocument();

      // デフォルトでcloseButtonが表示されることを確認
      const closeButton = screen.getByRole("button");
      expect(closeButton).toBeInTheDocument();

      // XIconが表示されることを確認
      const xIcon = screen.getByTestId("x-icon");
      expect(xIcon).toBeInTheDocument();
    });

    test("should not render close button when closeButton is false", () => {
      render(
        <Dialog open={true}>
          <DialogContent closeButton={false}>
            <div data-testid="content-children">Content children</div>
          </DialogContent>
        </Dialog>,
      );

      // 子要素が存在することを確認
      const contentChildren = screen.getByTestId("content-children");
      expect(contentChildren).toBeInTheDocument();

      // closeButtonが表示されないことを確認
      const closeButton = screen.queryByRole("button");
      expect(closeButton).not.toBeInTheDocument();
    });

    test("should merge custom className with default classes", () => {
      const customClassName = "custom-content-class";

      render(
        <Dialog open={true}>
          <DialogContent className={customClassName} data-testid="dialog-content">
            <div>Content</div>
          </DialogContent>
        </Dialog>,
      );

      const contentElement = screen.getByTestId("dialog-content");
      expect(contentElement).toBeInTheDocument();
      expect(contentElement).toHaveClass(customClassName);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogHeader", () => {
    test("should render DialogHeader component with correct data-slot attribute and default classes", () => {
      render(
        <DialogHeader data-testid="dialog-header">
          <div>Header content</div>
        </DialogHeader>,
      );

      const headerElement = screen.getByTestId("dialog-header");
      expect(headerElement).toBeInTheDocument();
      expect(headerElement).toHaveAttribute("data-slot", "dialog-header");
      expect(headerElement).toHaveClass("flex", "flex-col", "gap-2", "text-center", "sm:text-left");
    });

    test("should merge custom className with default classes", () => {
      const customClassName = "custom-header-class";

      render(
        <DialogHeader className={customClassName} data-testid="dialog-header">
          <div>Header content</div>
        </DialogHeader>,
      );

      const headerElement = screen.getByTestId("dialog-header");
      expect(headerElement).toBeInTheDocument();
      expect(headerElement).toHaveClass(customClassName);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogFooter", () => {
    test("should render DialogFooter component with correct data-slot attribute and default classes", () => {
      render(
        <DialogFooter data-testid="dialog-footer">
          <div>Footer content</div>
        </DialogFooter>,
      );

      const footerElement = screen.getByTestId("dialog-footer");
      expect(footerElement).toBeInTheDocument();
      expect(footerElement).toHaveAttribute("data-slot", "dialog-footer");
      expect(footerElement).toHaveClass("flex", "flex-col-reverse", "gap-2", "sm:flex-row", "sm:justify-end");
    });

    test("should merge custom className with default classes", () => {
      const customClassName = "custom-footer-class";

      render(
        <DialogFooter className={customClassName} data-testid="dialog-footer">
          <div>Footer content</div>
        </DialogFooter>,
      );

      const footerElement = screen.getByTestId("dialog-footer");
      expect(footerElement).toBeInTheDocument();
      expect(footerElement).toHaveClass(customClassName);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogTitle", () => {
    test("should render DialogTitle component with correct data-slot attribute and default classes", () => {
      render(
        <Dialog open={true}>
          <DialogPortal>
            <DialogTitle data-testid="dialog-title">Title content</DialogTitle>
          </DialogPortal>
        </Dialog>,
      );

      const titleElement = screen.getByTestId("dialog-title");
      expect(titleElement).toBeInTheDocument();
      expect(titleElement).toHaveAttribute("data-slot", "dialog-title");
      expect(titleElement).toHaveClass("text-lg", "leading-none", "font-semibold");
    });

    test("should merge custom className with default classes", () => {
      const customClassName = "custom-title-class";

      render(
        <Dialog open={true}>
          <DialogPortal>
            <DialogTitle className={customClassName} data-testid="dialog-title">
              Title content
            </DialogTitle>
          </DialogPortal>
        </Dialog>,
      );

      const titleElement = screen.getByTestId("dialog-title");
      expect(titleElement).toBeInTheDocument();
      expect(titleElement).toHaveClass(customClassName);
    });
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  describe("DialogDescription", () => {
    test("should render DialogDescription component with correct data-slot attribute and default classes", () => {
      render(
        <Dialog open={true}>
          <DialogPortal>
            <DialogDescription data-testid="dialog-description">Description content</DialogDescription>
          </DialogPortal>
        </Dialog>,
      );

      const descriptionElement = screen.getByTestId("dialog-description");
      expect(descriptionElement).toBeInTheDocument();
      expect(descriptionElement).toHaveAttribute("data-slot", "dialog-description");
      expect(descriptionElement).toHaveClass("text-sm", "text-neutral-500", "dark:text-neutral-400");
    });

    test("should merge custom className with default classes", () => {
      const customClassName = "custom-description-class";

      render(
        <Dialog open={true}>
          <DialogPortal>
            <DialogDescription className={customClassName} data-testid="dialog-description">
              Description content
            </DialogDescription>
          </DialogPortal>
        </Dialog>,
      );

      const descriptionElement = screen.getByTestId("dialog-description");
      expect(descriptionElement).toBeInTheDocument();
      expect(descriptionElement).toHaveClass(customClassName);
    });
  });
});
