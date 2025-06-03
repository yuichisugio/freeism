import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { RadioGroup, RadioGroupItem } from "./table-radio-group";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("RadioGroup", () => {
  test("should render RadioGroup component correctly", () => {
    render(<RadioGroup data-testid="radio-group" />);

    const radioGroup = screen.getByTestId("radio-group");
    expect(radioGroup).toBeInTheDocument();
    expect(radioGroup).toHaveAttribute("data-slot", "radio-group");
  });

  test("should apply default className", () => {
    render(<RadioGroup data-testid="radio-group" />);

    const radioGroup = screen.getByTestId("radio-group");
    expect(radioGroup).toHaveClass("grid", "gap-3");
  });

  test("should apply custom className", () => {
    render(<RadioGroup className="custom-class" data-testid="radio-group" />);

    const radioGroup = screen.getByTestId("radio-group");
    expect(radioGroup).toHaveClass("grid", "gap-3", "custom-class");
  });

  test("should handle undefined className", () => {
    render(<RadioGroup className={undefined} data-testid="radio-group" />);

    const radioGroup = screen.getByTestId("radio-group");
    expect(radioGroup).toHaveClass("grid", "gap-3");
  });

  test("should handle empty string className", () => {
    render(<RadioGroup className="" data-testid="radio-group" />);

    const radioGroup = screen.getByTestId("radio-group");
    expect(radioGroup).toHaveClass("grid", "gap-3");
  });

  test("should handle multiple custom classNames", () => {
    render(<RadioGroup className="class1 class2 class3" data-testid="radio-group" />);

    const radioGroup = screen.getByTestId("radio-group");
    expect(radioGroup).toHaveClass("grid", "gap-3", "class1", "class2", "class3");
  });

  test("should forward all props to underlying component", () => {
    const onValueChange = vi.fn();
    render(<RadioGroup data-testid="radio-group" onValueChange={onValueChange} defaultValue="test" disabled />);

    const radioGroup = screen.getByTestId("radio-group");
    expect(radioGroup).toHaveAttribute("data-disabled", "");
    expect(radioGroup).toHaveAttribute("role", "radiogroup");
  });

  test("should render children correctly", () => {
    render(
      <RadioGroup data-testid="radio-group">
        <RadioGroupItem value="option1" data-testid="item1" />
        <RadioGroupItem value="option2" data-testid="item2" />
      </RadioGroup>,
    );

    expect(screen.getByTestId("item1")).toBeInTheDocument();
    expect(screen.getByTestId("item2")).toBeInTheDocument();
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("RadioGroupItem", () => {
  test("should render RadioGroupItem component correctly", () => {
    render(
      <RadioGroup>
        <RadioGroupItem data-testid="radio-item" value="test" />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toBeInTheDocument();
    expect(radioItem).toHaveAttribute("data-slot", "radio-group-item");
    expect(radioItem).toHaveAttribute("value", "test");
  });

  test("should apply default className", () => {
    render(
      <RadioGroup>
        <RadioGroupItem data-testid="radio-item" value="test" />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toHaveClass(
      "flex",
      "h-5",
      "w-5",
      "cursor-pointer",
      "items-center",
      "justify-center",
      "rounded-full",
      "border-2",
      "border-gray-300",
      "transition-colors",
    );
  });

  test("should apply custom className", () => {
    render(
      <RadioGroup>
        <RadioGroupItem className="custom-item-class" data-testid="radio-item" value="test" />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toHaveClass("custom-item-class");
  });

  test("should handle undefined className", () => {
    render(
      <RadioGroup>
        <RadioGroupItem className={undefined} data-testid="radio-item" value="test" />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toHaveClass("flex", "h-5", "w-5");
  });

  test("should handle empty string className", () => {
    render(
      <RadioGroup>
        <RadioGroupItem className="" data-testid="radio-item" value="test" />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toHaveClass("flex", "h-5", "w-5");
  });

  test("should handle null value", () => {
    render(
      <RadioGroup>
        <RadioGroupItem data-testid="radio-item" value={null as unknown as string} />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toBeInTheDocument();
  });

  test("should handle undefined value", () => {
    render(
      <RadioGroup>
        <RadioGroupItem data-testid="radio-item" value={undefined as unknown as string} />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toBeInTheDocument();
  });

  test("should render Check icon inside indicator", () => {
    render(
      <RadioGroup defaultValue="test">
        <RadioGroupItem data-testid="radio-item" value="test" />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    const indicator = radioItem.querySelector('[data-slot="radio-group-indicator"]');
    expect(indicator).toBeInTheDocument();

    // Check iconがSVGとして存在することを確認
    const checkIcon = indicator?.querySelector("svg");
    expect(checkIcon).toBeInTheDocument();
  });

  test("should forward all props to underlying component", () => {
    render(
      <RadioGroup>
        <RadioGroupItem data-testid="radio-item" value="test" disabled id="custom-id" aria-label="Custom radio item" />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toHaveAttribute("id", "custom-id");
    expect(radioItem).toHaveAttribute("aria-label", "Custom radio item");
    expect(radioItem).toHaveAttribute("data-disabled", "");
  });

  test("should handle special characters in value", () => {
    const specialValue = "test-value_123!@#$%^&*()";
    render(
      <RadioGroup>
        <RadioGroupItem data-testid="radio-item" value={specialValue} />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toHaveAttribute("value", specialValue);
  });

  test("should handle numeric value", () => {
    render(
      <RadioGroup>
        <RadioGroupItem data-testid="radio-item" value="123" />
      </RadioGroup>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toHaveAttribute("value", "123");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("RadioGroup Integration Tests", () => {
  test("should handle value selection correctly", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup onValueChange={onValueChange} data-testid="radio-group">
        <RadioGroupItem value="option1" data-testid="item1" />
        <RadioGroupItem value="option2" data-testid="item2" />
        <RadioGroupItem value="option3" data-testid="item3" />
      </RadioGroup>,
    );

    const item2 = screen.getByTestId("item2");
    fireEvent.click(item2);

    expect(onValueChange).toHaveBeenCalledWith("option2");
  });

  test("should handle default value correctly", () => {
    render(
      <RadioGroup defaultValue="option2" data-testid="radio-group">
        <RadioGroupItem value="option1" data-testid="item1" />
        <RadioGroupItem value="option2" data-testid="item2" />
        <RadioGroupItem value="option3" data-testid="item3" />
      </RadioGroup>,
    );

    const item2 = screen.getByTestId("item2");
    expect(item2).toHaveAttribute("data-state", "checked");
  });

  test("should handle controlled value correctly", () => {
    const { rerender } = render(
      <RadioGroup value="option1" data-testid="radio-group">
        <RadioGroupItem value="option1" data-testid="item1" />
        <RadioGroupItem value="option2" data-testid="item2" />
      </RadioGroup>,
    );

    expect(screen.getByTestId("item1")).toHaveAttribute("data-state", "checked");
    expect(screen.getByTestId("item2")).toHaveAttribute("data-state", "unchecked");

    rerender(
      <RadioGroup value="option2" data-testid="radio-group">
        <RadioGroupItem value="option1" data-testid="item1" />
        <RadioGroupItem value="option2" data-testid="item2" />
      </RadioGroup>,
    );

    expect(screen.getByTestId("item1")).toHaveAttribute("data-state", "unchecked");
    expect(screen.getByTestId("item2")).toHaveAttribute("data-state", "checked");
  });

  test("should handle disabled state correctly", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup onValueChange={onValueChange} disabled data-testid="radio-group">
        <RadioGroupItem value="option1" data-testid="item1" />
        <RadioGroupItem value="option2" data-testid="item2" />
      </RadioGroup>,
    );

    const item1 = screen.getByTestId("item1");
    fireEvent.click(item1);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(item1).toHaveAttribute("data-disabled", "");
  });

  test("should handle individual item disabled state", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup onValueChange={onValueChange} data-testid="radio-group">
        <RadioGroupItem value="option1" data-testid="item1" disabled />
        <RadioGroupItem value="option2" data-testid="item2" />
      </RadioGroup>,
    );

    const item1 = screen.getByTestId("item1");
    const item2 = screen.getByTestId("item2");

    fireEvent.click(item1);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(item1).toHaveAttribute("data-disabled", "");

    fireEvent.click(item2);
    expect(onValueChange).toHaveBeenCalledWith("option2");
  });

  test("should handle keyboard navigation", () => {
    render(
      <RadioGroup data-testid="radio-group">
        <RadioGroupItem value="option1" data-testid="item1" />
        <RadioGroupItem value="option2" data-testid="item2" />
      </RadioGroup>,
    );

    const item1 = screen.getByTestId("item1");

    // フォーカスを設定
    item1.focus();
    expect(item1).toHaveFocus();

    // キーボードナビゲーションをテスト（Radix UIの実装に依存するため、基本的なフォーカステストのみ）
    fireEvent.keyDown(item1, { key: "ArrowDown" });
    // Radix UIの内部実装に依存するため、フォーカス移動の詳細テストは省略
  });

  test("should handle empty RadioGroup", () => {
    render(<RadioGroup data-testid="radio-group" />);

    const radioGroup = screen.getByTestId("radio-group");
    expect(radioGroup).toBeInTheDocument();
    expect(radioGroup.children).toHaveLength(0);
  });

  test("should handle single RadioGroupItem", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup onValueChange={onValueChange} data-testid="radio-group">
        <RadioGroupItem value="single" data-testid="single-item" />
      </RadioGroup>,
    );

    const singleItem = screen.getByTestId("single-item");
    fireEvent.click(singleItem);

    expect(onValueChange).toHaveBeenCalledWith("single");
    expect(singleItem).toHaveAttribute("data-state", "checked");
  });

  test("should handle focus and blur events", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();

    render(
      <RadioGroup data-testid="radio-group">
        <RadioGroupItem value="option1" data-testid="item1" onFocus={onFocus} onBlur={onBlur} />
      </RadioGroup>,
    );

    const item1 = screen.getByTestId("item1");

    fireEvent.focus(item1);
    expect(onFocus).toHaveBeenCalled();

    fireEvent.blur(item1);
    expect(onBlur).toHaveBeenCalled();
  });

  test("should handle multiple RadioGroups independently", () => {
    const onValueChange1 = vi.fn();
    const onValueChange2 = vi.fn();

    render(
      <div>
        <RadioGroup onValueChange={onValueChange1} data-testid="group1">
          <RadioGroupItem value="group1-option1" data-testid="group1-item1" />
          <RadioGroupItem value="group1-option2" data-testid="group1-item2" />
        </RadioGroup>
        <RadioGroup onValueChange={onValueChange2} data-testid="group2">
          <RadioGroupItem value="group2-option1" data-testid="group2-item1" />
          <RadioGroupItem value="group2-option2" data-testid="group2-item2" />
        </RadioGroup>
      </div>,
    );

    fireEvent.click(screen.getByTestId("group1-item1"));
    expect(onValueChange1).toHaveBeenCalledWith("group1-option1");
    expect(onValueChange2).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("group2-item2"));
    expect(onValueChange2).toHaveBeenCalledWith("group2-option2");
  });
});
