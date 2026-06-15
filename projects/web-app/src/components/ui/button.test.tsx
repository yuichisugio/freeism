import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  test("should render button with default props", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-slot", "button");
  });

  test("should handle click events", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole("button", { name: "Click me" });
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test("should apply variant classes correctly", () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    let button = screen.getByRole("button");
    expect(button).toHaveClass("bg-neutral-900", "text-neutral-50");

    rerender(<Button variant="destructive">Destructive</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("bg-red-500", "text-white");

    rerender(<Button variant="outline">Outline</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("border", "bg-white");

    rerender(<Button variant="secondary">Secondary</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("bg-neutral-100", "text-neutral-900");

    rerender(<Button variant="ghost">Ghost</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("hover:bg-neutral-100");

    rerender(<Button variant="link">Link</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("underline-offset-4", "hover:underline");
  });

  test("should apply size classes correctly", () => {
    const { rerender } = render(<Button size="default">Default Size</Button>);
    let button = screen.getByRole("button");
    expect(button).toHaveClass("h-9", "px-4", "py-2");

    rerender(<Button size="sm">Small Size</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("h-8", "px-3");

    rerender(<Button size="lg">Large Size</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("h-10", "px-6");

    rerender(<Button size="icon">Icon Size</Button>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("size-9");
  });

  test("should apply custom className", () => {
    render(<Button className="custom-class">Custom</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });

  test("should be disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled Button</Button>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("disabled:pointer-events-none", "disabled:opacity-50");
  });

  test("should not call onClick when disabled", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled Button
      </Button>,
    );

    const button = screen.getByRole("button");
    await user.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  test("should render as child component when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Link Button" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
    expect(link).toHaveAttribute("data-slot", "button");
  });

  test("should handle keyboard events", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Keyboard Button</Button>);

    const button = screen.getByRole("button");
    button.focus();

    await user.keyboard("{Enter}");
    expect(handleClick).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  test("should support all HTML button attributes", () => {
    render(
      <Button
        type="submit"
        form="test-form"
        name="test-button"
        value="test-value"
        aria-label="Test button"
        data-testid="test-button"
      >
        Submit
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("form", "test-form");
    expect(button).toHaveAttribute("name", "test-button");
    expect(button).toHaveAttribute("value", "test-value");
    expect(button).toHaveAttribute("aria-label", "Test button");
    expect(button).toHaveAttribute("data-testid", "test-button");
  });

  test("should handle focus and blur events", async () => {
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();
    const user = userEvent.setup();

    render(
      <Button onFocus={handleFocus} onBlur={handleBlur}>
        Focus Button
      </Button>,
    );

    const button = screen.getByRole("button");

    await user.click(button);
    expect(handleFocus).toHaveBeenCalled();

    await user.tab();
    expect(handleBlur).toHaveBeenCalled();
  });

  test("should render with icon and maintain proper spacing", () => {
    render(
      <Button>
        <svg data-testid="icon" />
        Button with Icon
      </Button>,
    );

    const button = screen.getByRole("button");
    const icon = screen.getByTestId("icon");

    expect(button).toBeInTheDocument();
    expect(icon).toBeInTheDocument();
    expect(button).toHaveClass("gap-2");
  });

  test("should combine multiple variants and sizes", () => {
    render(
      <Button variant="outline" size="lg" className="custom-class">
        Combined Props
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveClass("border", "bg-white"); // outline variant
    expect(button).toHaveClass("h-10", "px-6"); // lg size
    expect(button).toHaveClass("custom-class"); // custom class
  });

  test("should handle aria-invalid attribute", () => {
    render(<Button aria-invalid="true">Invalid Button</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-invalid", "true");
    expect(button).toHaveClass("aria-invalid:border-red-500");
  });
});
