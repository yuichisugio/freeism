import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./share-table-alert-dialog";

// Radix UIのモック
vi.mock("@radix-ui/react-alert-dialog", () => ({
  Root: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-root" {...props}>
      {children}
    </div>
  ),
  Trigger: ({ children, ...props }: { children: React.ReactNode }) => (
    <button data-testid="alert-dialog-trigger" {...props}>
      {children}
    </button>
  ),
  Portal: ({ children, container }: { children: React.ReactNode; container?: HTMLElement | null }) => (
    <div data-testid="alert-dialog-portal" data-container={container ? "custom" : "default"}>
      {children}
    </div>
  ),
  Overlay: ({ className, ...props }: { className?: string }) => (
    <div data-testid="alert-dialog-overlay" className={className} {...props} />
  ),
  Content: ({ className, children, ...props }: { className?: string; children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content" className={className} {...props}>
      {children}
    </div>
  ),
  Title: ({ className, children, ...props }: { className?: string; children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title" className={className} {...props}>
      {children}
    </h2>
  ),
  Description: ({ className, children, ...props }: { className?: string; children: React.ReactNode }) => (
    <p data-testid="alert-dialog-description" className={className} {...props}>
      {children}
    </p>
  ),
  Action: ({ className, children, ...props }: { className?: string; children: React.ReactNode }) => (
    <button data-testid="alert-dialog-action" className={className} {...props}>
      {children}
    </button>
  ),
  Cancel: ({ className, children, ...props }: { className?: string; children: React.ReactNode }) => (
    <button data-testid="alert-dialog-cancel" className={className} {...props}>
      {children}
    </button>
  ),
}));

describe("AlertDialog Components", () => {
  describe("AlertDialog", () => {
    test("should render AlertDialog root component", () => {
      render(
        <AlertDialog>
          <div>Test content</div>
        </AlertDialog>,
      );

      expect(screen.getByTestId("alert-dialog-root")).toBeInTheDocument();
      expect(screen.getByText("Test content")).toBeInTheDocument();
    });

    test("should pass props to AlertDialog root", () => {
      render(
        <AlertDialog open={true}>
          <div>Test content</div>
        </AlertDialog>,
      );

      const root = screen.getByTestId("alert-dialog-root");
      expect(root).toHaveAttribute("open");
    });
  });

  describe("AlertDialogTrigger", () => {
    test("should render AlertDialogTrigger component", () => {
      render(
        <AlertDialogTrigger>
          <span>Trigger button</span>
        </AlertDialogTrigger>,
      );

      expect(screen.getByTestId("alert-dialog-trigger")).toBeInTheDocument();
      expect(screen.getByText("Trigger button")).toBeInTheDocument();
    });

    test("should pass props to AlertDialogTrigger", () => {
      render(
        <AlertDialogTrigger disabled>
          <span>Trigger button</span>
        </AlertDialogTrigger>,
      );

      const trigger = screen.getByTestId("alert-dialog-trigger");
      expect(trigger).toHaveAttribute("disabled");
    });
  });

  describe("AlertDialogOverlay", () => {
    test("should render AlertDialogOverlay with default classes", () => {
      render(<AlertDialogOverlay />);

      const overlay = screen.getByTestId("alert-dialog-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass(
        "data-[state=open]:animate-in",
        "data-[state=closed]:animate-out",
        "fixed",
        "inset-0",
        "z-50",
        "backdrop-blur-sm",
      );
    });

    test("should merge custom className with default classes", () => {
      render(<AlertDialogOverlay className="custom-class" />);

      const overlay = screen.getByTestId("alert-dialog-overlay");
      expect(overlay).toHaveClass("custom-class");
      expect(overlay).toHaveClass("fixed", "inset-0", "z-50");
    });

    test("should handle null className", () => {
      render(<AlertDialogOverlay className={undefined} />);

      const overlay = screen.getByTestId("alert-dialog-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass("fixed", "inset-0", "z-50");
    });
  });

  describe("AlertDialogContent", () => {
    test("should render AlertDialogContent with default classes", () => {
      render(
        <AlertDialogContent>
          <div>Content</div>
        </AlertDialogContent>,
      );

      expect(screen.getByTestId("alert-dialog-portal")).toBeInTheDocument();
      expect(screen.getByTestId("alert-dialog-overlay")).toBeInTheDocument();
      expect(screen.getByTestId("alert-dialog-content")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    test("should render with custom container", () => {
      const customContainer = document.createElement("div");
      render(
        <AlertDialogContent container={customContainer}>
          <div>Content</div>
        </AlertDialogContent>,
      );

      const portal = screen.getByTestId("alert-dialog-portal");
      expect(portal).toHaveAttribute("data-container", "custom");
    });

    test("should render with default container when container is null", () => {
      render(
        <AlertDialogContent container={null}>
          <div>Content</div>
        </AlertDialogContent>,
      );

      const portal = screen.getByTestId("alert-dialog-portal");
      expect(portal).toHaveAttribute("data-container", "default");
    });

    test("should merge custom className", () => {
      render(
        <AlertDialogContent className="custom-content-class">
          <div>Content</div>
        </AlertDialogContent>,
      );

      const content = screen.getByTestId("alert-dialog-content");
      expect(content).toHaveClass("custom-content-class");
    });
  });

  describe("AlertDialogHeader", () => {
    test("should render AlertDialogHeader with default classes", () => {
      render(
        <AlertDialogHeader>
          <div>Header content</div>
        </AlertDialogHeader>,
      );

      const header = screen.getByText("Header content").parentElement;
      expect(header).toHaveClass("flex", "flex-col", "space-y-2", "text-center", "sm:text-left");
    });

    test("should merge custom className", () => {
      render(
        <AlertDialogHeader className="custom-header">
          <div>Header content</div>
        </AlertDialogHeader>,
      );

      const header = screen.getByText("Header content").parentElement;
      expect(header).toHaveClass("custom-header");
      expect(header).toHaveClass("flex", "flex-col");
    });
  });

  describe("AlertDialogFooter", () => {
    test("should render AlertDialogFooter with default classes", () => {
      render(
        <AlertDialogFooter>
          <div>Footer content</div>
        </AlertDialogFooter>,
      );

      const footer = screen.getByText("Footer content").parentElement;
      expect(footer).toHaveClass("flex", "flex-col-reverse", "sm:flex-row", "sm:justify-end", "sm:space-x-2");
    });

    test("should merge custom className", () => {
      render(
        <AlertDialogFooter className="custom-footer">
          <div>Footer content</div>
        </AlertDialogFooter>,
      );

      const footer = screen.getByText("Footer content").parentElement;
      expect(footer).toHaveClass("custom-footer");
      expect(footer).toHaveClass("flex", "flex-col-reverse");
    });
  });

  describe("AlertDialogTitle", () => {
    test("should render AlertDialogTitle with default classes", () => {
      render(<AlertDialogTitle>Dialog Title</AlertDialogTitle>);

      const title = screen.getByTestId("alert-dialog-title");
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("text-lg", "font-semibold");
      expect(title).toHaveTextContent("Dialog Title");
    });

    test("should merge custom className", () => {
      render(<AlertDialogTitle className="custom-title">Dialog Title</AlertDialogTitle>);

      const title = screen.getByTestId("alert-dialog-title");
      expect(title).toHaveClass("custom-title");
      expect(title).toHaveClass("text-lg", "font-semibold");
    });

    test("should handle undefined className", () => {
      render(<AlertDialogTitle className={undefined}>Dialog Title</AlertDialogTitle>);

      const title = screen.getByTestId("alert-dialog-title");
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass("text-lg", "font-semibold");
    });
  });

  describe("AlertDialogDescription", () => {
    test("should render AlertDialogDescription with default classes", () => {
      render(<AlertDialogDescription>Dialog Description</AlertDialogDescription>);

      const description = screen.getByTestId("alert-dialog-description");
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass("text-sm", "text-neutral-500", "dark:text-neutral-400");
      expect(description).toHaveTextContent("Dialog Description");
    });

    test("should merge custom className", () => {
      render(<AlertDialogDescription className="custom-description">Dialog Description</AlertDialogDescription>);

      const description = screen.getByTestId("alert-dialog-description");
      expect(description).toHaveClass("custom-description");
      expect(description).toHaveClass("text-sm", "text-neutral-500");
    });

    test("should handle null className", () => {
      render(<AlertDialogDescription className={null as unknown as string}>Dialog Description</AlertDialogDescription>);

      const description = screen.getByTestId("alert-dialog-description");
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass("text-sm", "text-neutral-500");
    });
  });

  describe("AlertDialogAction", () => {
    test("should render AlertDialogAction with default button styles", () => {
      render(<AlertDialogAction>Confirm</AlertDialogAction>);

      const action = screen.getByTestId("alert-dialog-action");
      expect(action).toBeInTheDocument();
      expect(action).toHaveTextContent("Confirm");
      // buttonVariantsのデフォルトクラスが適用されることを確認
      expect(action).toHaveClass("inline-flex");
    });

    test("should merge custom className with button variants", () => {
      render(<AlertDialogAction className="custom-action">Confirm</AlertDialogAction>);

      const action = screen.getByTestId("alert-dialog-action");
      expect(action).toHaveClass("custom-action");
      expect(action).toHaveClass("inline-flex");
    });

    test("should handle click events", () => {
      const handleClick = vi.fn();
      render(<AlertDialogAction onClick={handleClick}>Confirm</AlertDialogAction>);

      const action = screen.getByTestId("alert-dialog-action");
      action.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test("should handle disabled state", () => {
      render(<AlertDialogAction disabled>Confirm</AlertDialogAction>);

      const action = screen.getByTestId("alert-dialog-action");
      expect(action).toHaveAttribute("disabled");
    });
  });

  describe("AlertDialogCancel", () => {
    test("should render AlertDialogCancel with outline variant", () => {
      render(<AlertDialogCancel>Cancel</AlertDialogCancel>);

      const cancel = screen.getByTestId("alert-dialog-cancel");
      expect(cancel).toBeInTheDocument();
      expect(cancel).toHaveTextContent("Cancel");
      // outline variantとmarginクラスが適用されることを確認
      expect(cancel).toHaveClass("inline-flex", "mt-2", "sm:mt-0");
    });

    test("should merge custom className with button variants", () => {
      render(<AlertDialogCancel className="custom-cancel">Cancel</AlertDialogCancel>);

      const cancel = screen.getByTestId("alert-dialog-cancel");
      expect(cancel).toHaveClass("custom-cancel");
      expect(cancel).toHaveClass("inline-flex", "mt-2");
    });

    test("should handle click events", () => {
      const handleClick = vi.fn();
      render(<AlertDialogCancel onClick={handleClick}>Cancel</AlertDialogCancel>);

      const cancel = screen.getByTestId("alert-dialog-cancel");
      cancel.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    test("should handle disabled state", () => {
      render(<AlertDialogCancel disabled>Cancel</AlertDialogCancel>);

      const cancel = screen.getByTestId("alert-dialog-cancel");
      expect(cancel).toHaveAttribute("disabled");
    });
  });

  describe("forwardRef functionality", () => {
    test("should forward ref for AlertDialogOverlay", () => {
      const ref = vi.fn();
      render(<AlertDialogOverlay ref={ref} />);

      expect(ref).toHaveBeenCalled();
    });

    test("should forward ref for AlertDialogContent", () => {
      const ref = vi.fn();
      render(
        <AlertDialogContent ref={ref}>
          <div>Content</div>
        </AlertDialogContent>,
      );

      expect(ref).toHaveBeenCalled();
    });

    test("should forward ref for AlertDialogTitle", () => {
      const ref = vi.fn();
      render(<AlertDialogTitle ref={ref}>Title</AlertDialogTitle>);

      expect(ref).toHaveBeenCalled();
    });

    test("should forward ref for AlertDialogDescription", () => {
      const ref = vi.fn();
      render(<AlertDialogDescription ref={ref}>Description</AlertDialogDescription>);

      expect(ref).toHaveBeenCalled();
    });

    test("should forward ref for AlertDialogAction", () => {
      const ref = vi.fn();
      render(<AlertDialogAction ref={ref}>Action</AlertDialogAction>);

      expect(ref).toHaveBeenCalled();
    });

    test("should forward ref for AlertDialogCancel", () => {
      const ref = vi.fn();
      render(<AlertDialogCancel ref={ref}>Cancel</AlertDialogCancel>);

      expect(ref).toHaveBeenCalled();
    });
  });

  describe("edge cases and error handling", () => {
    test("should handle empty children", () => {
      render(<AlertDialog />);
      expect(screen.getByTestId("alert-dialog-root")).toBeInTheDocument();
    });

    test("should handle multiple children in AlertDialogContent", () => {
      render(
        <AlertDialogContent>
          <div>First child</div>
          <div>Second child</div>
        </AlertDialogContent>,
      );

      expect(screen.getByText("First child")).toBeInTheDocument();
      expect(screen.getByText("Second child")).toBeInTheDocument();
    });

    test("should handle complex nested structure", () => {
      render(
        <AlertDialog>
          <AlertDialogTrigger>
            <button>Open Dialog</button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Action</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to proceed?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );

      expect(screen.getByText("Open Dialog")).toBeInTheDocument();
      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
      expect(screen.getByText("Are you sure you want to proceed?")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Confirm")).toBeInTheDocument();
    });

    test("should handle container prop with undefined", () => {
      render(
        <AlertDialogContent container={undefined}>
          <div>Content</div>
        </AlertDialogContent>,
      );

      const portal = screen.getByTestId("alert-dialog-portal");
      expect(portal).toHaveAttribute("data-container", "default");
    });
  });
});
