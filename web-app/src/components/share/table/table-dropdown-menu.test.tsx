import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./table-dropdown-menu";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenu", () => {
  test("should render DropdownMenu with correct data-slot attribute", () => {
    render(
      <DropdownMenu data-testid="dropdown-menu-test">
        <DropdownMenuTrigger data-testid="trigger">
          <button>Open Menu</button>
        </DropdownMenuTrigger>
      </DropdownMenu>,
    );

    // DropdownMenuはRadix UIのRootコンポーネントなので、直接的なDOM要素は作成されない
    // 代わりに、data-slot属性がTriggerに正しく設定されているかを確認
    const trigger = screen.getByTestId("trigger");
    expect(trigger).toHaveAttribute("data-slot", "dropdown-menu-trigger");
  });

  test("should pass through props to DropdownMenu", () => {
    render(
      <DropdownMenu open data-testid="dropdown-menu-test">
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <div>Menu Content</div>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    // openプロパティが正しく動作しているかを確認
    const content = screen.getByText("Menu Content");
    expect(content).toBeInTheDocument();
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuTrigger", () => {
  test("should render DropdownMenuTrigger with correct data-slot attribute", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="dropdown-trigger">
          <button>Open Menu</button>
        </DropdownMenuTrigger>
      </DropdownMenu>,
    );

    const trigger = screen.getByTestId("dropdown-trigger");
    expect(trigger).toHaveAttribute("data-slot", "dropdown-menu-trigger");
  });

  test("should render trigger content correctly", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>
          <span>Open Menu</span>
        </DropdownMenuTrigger>
      </DropdownMenu>,
    );

    const triggerContent = screen.getByText("Open Menu");
    expect(triggerContent).toBeInTheDocument();
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuContent", () => {
  test("should render DropdownMenuContent with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent data-testid="dropdown-content">
          <div>Menu Content</div>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = screen.getByTestId("dropdown-content");
    expect(content).toHaveAttribute("data-slot", "dropdown-menu-content");
  });

  test("should apply default sideOffset", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent data-testid="dropdown-content">
          <div>Menu Content</div>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = screen.getByTestId("dropdown-content");
    expect(content).toBeInTheDocument();
  });

  test("should apply custom sideOffset", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={8} data-testid="dropdown-content">
          <div>Menu Content</div>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = screen.getByTestId("dropdown-content");
    expect(content).toBeInTheDocument();
  });

  test("should apply custom className", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="custom-class" data-testid="dropdown-content">
          <div>Menu Content</div>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = screen.getByTestId("dropdown-content");
    expect(content).toHaveClass("custom-class");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuGroup", () => {
  test("should render DropdownMenuGroup with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup data-testid="dropdown-group">
            <div>Group Content</div>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const group = screen.getByTestId("dropdown-group");
    expect(group).toHaveAttribute("data-slot", "dropdown-menu-group");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuLabel", () => {
  test("should render DropdownMenuLabel with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel data-testid="dropdown-label">Label Text</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const label = screen.getByTestId("dropdown-label");
    expect(label).toHaveAttribute("data-slot", "dropdown-menu-label");
    expect(label).toHaveTextContent("Label Text");
  });

  test("should apply inset styling when inset prop is true", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel inset data-testid="dropdown-label">
            Label Text
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const label = screen.getByTestId("dropdown-label");
    expect(label).toHaveAttribute("data-inset", "true");
  });

  test("should apply custom className", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel className="custom-label" data-testid="dropdown-label">
            Label Text
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const label = screen.getByTestId("dropdown-label");
    expect(label).toHaveClass("custom-label");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuSeparator", () => {
  test("should render DropdownMenuSeparator with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSeparator data-testid="dropdown-separator" />
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const separator = screen.getByTestId("dropdown-separator");
    expect(separator).toHaveAttribute("data-slot", "dropdown-menu-separator");
  });

  test("should apply custom className", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSeparator className="custom-separator" data-testid="dropdown-separator" />
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const separator = screen.getByTestId("dropdown-separator");
    expect(separator).toHaveClass("custom-separator");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuShortcut", () => {
  test("should render DropdownMenuShortcut with correct data-slot attribute", () => {
    render(<DropdownMenuShortcut data-testid="dropdown-shortcut">Ctrl+S</DropdownMenuShortcut>);

    const shortcut = screen.getByTestId("dropdown-shortcut");
    expect(shortcut).toHaveAttribute("data-slot", "dropdown-menu-shortcut");
    expect(shortcut).toHaveTextContent("Ctrl+S");
  });

  test("should apply custom className", () => {
    render(
      <DropdownMenuShortcut className="custom-shortcut" data-testid="dropdown-shortcut">
        Ctrl+S
      </DropdownMenuShortcut>,
    );

    const shortcut = screen.getByTestId("dropdown-shortcut");
    expect(shortcut).toHaveClass("custom-shortcut");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuItem", () => {
  test("should render DropdownMenuItem with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem data-testid="dropdown-item">Menu Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = screen.getByTestId("dropdown-item");
    expect(item).toHaveAttribute("data-slot", "dropdown-menu-item");
    expect(item).toHaveTextContent("Menu Item");
  });

  test("should apply default variant", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem data-testid="dropdown-item">Menu Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = screen.getByTestId("dropdown-item");
    expect(item).toHaveAttribute("data-variant", "default");
  });

  test("should apply destructive variant", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant="destructive" data-testid="dropdown-item">
            Delete Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = screen.getByTestId("dropdown-item");
    expect(item).toHaveAttribute("data-variant", "destructive");
  });

  test("should apply inset styling when inset prop is true", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem inset data-testid="dropdown-item">
            Menu Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = screen.getByTestId("dropdown-item");
    expect(item).toHaveAttribute("data-inset", "true");
  });

  test("should apply custom className", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem className="custom-item" data-testid="dropdown-item">
            Menu Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = screen.getByTestId("dropdown-item");
    expect(item).toHaveClass("custom-item");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuCheckboxItem", () => {
  test("should render DropdownMenuCheckboxItem with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem data-testid="dropdown-checkbox">Checkbox Item</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const checkboxItem = screen.getByTestId("dropdown-checkbox");
    expect(checkboxItem).toHaveAttribute("data-slot", "dropdown-menu-checkbox-item");
    expect(checkboxItem).toHaveTextContent("Checkbox Item");
  });

  test("should handle checked state", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={true} data-testid="dropdown-checkbox">
            Checked Item
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const checkboxItem = screen.getByTestId("dropdown-checkbox");
    expect(checkboxItem).toHaveAttribute("data-state", "checked");
  });

  test("should handle unchecked state", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={false} data-testid="dropdown-checkbox">
            Unchecked Item
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const checkboxItem = screen.getByTestId("dropdown-checkbox");
    expect(checkboxItem).toHaveAttribute("data-state", "unchecked");
  });

  test("should apply custom className", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem className="custom-checkbox" data-testid="dropdown-checkbox">
            Checkbox Item
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const checkboxItem = screen.getByTestId("dropdown-checkbox");
    expect(checkboxItem).toHaveClass("custom-checkbox");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuRadioGroup", () => {
  test("should render DropdownMenuRadioGroup with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup data-testid="dropdown-radio-group">
            <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const radioGroup = screen.getByTestId("dropdown-radio-group");
    expect(radioGroup).toHaveAttribute("data-slot", "dropdown-menu-radio-group");
  });

  test("should handle value prop", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="option1" data-testid="dropdown-radio-group">
            <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const radioGroup = screen.getByTestId("dropdown-radio-group");
    expect(radioGroup).toBeInTheDocument();
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuRadioItem", () => {
  test("should render DropdownMenuRadioItem with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup>
            <DropdownMenuRadioItem value="option1" data-testid="dropdown-radio">
              Radio Option
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const radioItem = screen.getByTestId("dropdown-radio");
    expect(radioItem).toHaveAttribute("data-slot", "dropdown-menu-radio-item");
    expect(radioItem).toHaveTextContent("Radio Option");
  });

  test("should apply custom className", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup>
            <DropdownMenuRadioItem value="option1" className="custom-radio" data-testid="dropdown-radio">
              Radio Option
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const radioItem = screen.getByTestId("dropdown-radio");
    expect(radioItem).toHaveClass("custom-radio");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuSub", () => {
  test("should render DropdownMenuSub components correctly", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="sub-trigger">Sub Menu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    // DropdownMenuSubは直接的なDOM要素を作成しないため、
    // 子要素のSubTriggerが正しくレンダリングされているかを確認
    const subTrigger = screen.getByTestId("sub-trigger");
    expect(subTrigger).toHaveAttribute("data-slot", "dropdown-menu-sub-trigger");
    expect(subTrigger).toHaveTextContent("Sub Menu");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuSubTrigger", () => {
  test("should render DropdownMenuSubTrigger with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="dropdown-sub-trigger">Sub Menu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subTrigger = screen.getByTestId("dropdown-sub-trigger");
    expect(subTrigger).toHaveAttribute("data-slot", "dropdown-menu-sub-trigger");
    expect(subTrigger).toHaveTextContent("Sub Menu");
  });

  test("should apply inset styling when inset prop is true", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger inset data-testid="dropdown-sub-trigger">
              Sub Menu
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subTrigger = screen.getByTestId("dropdown-sub-trigger");
    expect(subTrigger).toHaveAttribute("data-inset", "true");
  });

  test("should apply custom className", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="custom-sub-trigger" data-testid="dropdown-sub-trigger">
              Sub Menu
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subTrigger = screen.getByTestId("dropdown-sub-trigger");
    expect(subTrigger).toHaveClass("custom-sub-trigger");
  });

  test("should render ChevronRightIcon", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger data-testid="dropdown-sub-trigger">Sub Menu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subTrigger = screen.getByTestId("dropdown-sub-trigger");
    const chevronIcon = subTrigger.querySelector("svg");
    expect(chevronIcon).toBeInTheDocument();
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("DropdownMenuSubContent", () => {
  test("should render DropdownMenuSubContent with correct data-slot attribute", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger>Sub Menu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent data-testid="dropdown-sub-content">
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subContent = screen.getByTestId("dropdown-sub-content");
    expect(subContent).toHaveAttribute("data-slot", "dropdown-menu-sub-content");
  });

  test("should apply custom className", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger>Sub Menu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="custom-sub-content" data-testid="dropdown-sub-content">
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subContent = screen.getByTestId("dropdown-sub-content");
    expect(subContent).toHaveClass("custom-sub-content");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("Edge Cases and Error Handling", () => {
  test("should handle undefined className gracefully", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={undefined} data-testid="dropdown-content">
          <DropdownMenuItem className={undefined} data-testid="dropdown-item">
            Menu Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = screen.getByTestId("dropdown-content");
    const item = screen.getByTestId("dropdown-item");

    expect(content).toBeInTheDocument();
    expect(item).toBeInTheDocument();
  });

  test("should handle null children gracefully", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem data-testid="dropdown-item">{null}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = screen.getByTestId("dropdown-item");
    expect(item).toBeInTheDocument();
    expect(item).toHaveTextContent("");
  });

  test("should handle empty string children", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem data-testid="dropdown-item">{""}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = screen.getByTestId("dropdown-item");
    expect(item).toBeInTheDocument();
    expect(item).toHaveTextContent("");
  });

  test("should handle multiple className values", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="class1 class2 class3" data-testid="dropdown-content">
          <DropdownMenuItem>Menu Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = screen.getByTestId("dropdown-content");
    expect(content).toHaveClass("class1");
    expect(content).toHaveClass("class2");
    expect(content).toHaveClass("class3");
  });

  test("should handle boolean props correctly", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem inset={false} data-testid="dropdown-item-false">
            Item False
          </DropdownMenuItem>
          <DropdownMenuItem inset={true} data-testid="dropdown-item-true">
            Item True
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const itemFalse = screen.getByTestId("dropdown-item-false");
    const itemTrue = screen.getByTestId("dropdown-item-true");

    expect(itemFalse).toHaveAttribute("data-inset", "false");
    expect(itemTrue).toHaveAttribute("data-inset", "true");
  });

  test("should handle variant prop edge cases", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant={undefined} data-testid="dropdown-item-undefined">
            Undefined Variant
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = screen.getByTestId("dropdown-item-undefined");
    // undefinedの場合はデフォルト値"default"が適用される
    expect(item).toHaveAttribute("data-variant", "default");
  });

  test("should handle CheckboxItem with undefined checked state", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={undefined} data-testid="dropdown-checkbox">
            Undefined Checked
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const checkboxItem = screen.getByTestId("dropdown-checkbox");
    expect(checkboxItem).toBeInTheDocument();
  });

  test("should handle RadioGroup with empty value", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="" data-testid="dropdown-radio-group">
            <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const radioGroup = screen.getByTestId("dropdown-radio-group");
    expect(radioGroup).toBeInTheDocument();
  });

  test("should handle sideOffset boundary values", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={0} data-testid="dropdown-content-zero">
          <DropdownMenuItem>Zero Offset</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = screen.getByTestId("dropdown-content-zero");
    expect(content).toBeInTheDocument();
  });

  test("should handle negative sideOffset", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={-10} data-testid="dropdown-content-negative">
          <DropdownMenuItem>Negative Offset</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = screen.getByTestId("dropdown-content-negative");
    expect(content).toBeInTheDocument();
  });

  test("should handle very large sideOffset", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={1000} data-testid="dropdown-content-large">
          <DropdownMenuItem>Large Offset</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const content = screen.getByTestId("dropdown-content-large");
    expect(content).toBeInTheDocument();
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("Accessibility Tests", () => {
  test("should have proper ARIA attributes for DropdownMenuTrigger", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger data-testid="trigger">
          <button>Open Menu</button>
        </DropdownMenuTrigger>
      </DropdownMenu>,
    );

    const trigger = screen.getByTestId("trigger");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
  });

  test("should have proper ARIA attributes when menu is open", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger data-testid="trigger">
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent data-testid="content">
          <DropdownMenuItem>Menu Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByTestId("trigger");
    const content = screen.getByTestId("content");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(content).toHaveAttribute("role", "menu");
  });

  test("should have proper tabindex for menu items", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem data-testid="menu-item">Menu Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const menuItem = screen.getByTestId("menu-item");
    expect(menuItem).toHaveAttribute("tabindex", "-1");
  });

  test("should have proper role for checkbox items", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem data-testid="checkbox-item">Checkbox Item</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const checkboxItem = screen.getByTestId("checkbox-item");
    expect(checkboxItem).toHaveAttribute("role", "menuitemcheckbox");
  });

  test("should have proper role for radio items", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup>
            <DropdownMenuRadioItem value="option1" data-testid="radio-item">
              Radio Item
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const radioItem = screen.getByTestId("radio-item");
    expect(radioItem).toHaveAttribute("role", "menuitemradio");
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("Complex Scenarios", () => {
  test("should handle nested menu structure", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Group Label</DropdownMenuLabel>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={true}>Checkbox Item</DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value="option1">
            <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Sub Menu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item 1</DropdownMenuItem>
              <DropdownMenuItem>Sub Item 2</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.getByText("Group Label")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText("Checkbox Item")).toBeInTheDocument();
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Sub Menu")).toBeInTheDocument();
  });

  test("should handle menu with shortcuts", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Save
            <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            Copy
            <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+S")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+C")).toBeInTheDocument();
  });

  test("should handle menu with mixed variants", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant="default" data-testid="default-item">
            Default Item
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" data-testid="destructive-item">
            Delete Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const defaultItem = screen.getByTestId("default-item");
    const destructiveItem = screen.getByTestId("destructive-item");

    expect(defaultItem).toHaveAttribute("data-variant", "default");
    expect(destructiveItem).toHaveAttribute("data-variant", "destructive");
  });

  test("should handle menu with mixed inset styles", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>
          <button>Open Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel data-testid="normal-label">Normal Label</DropdownMenuLabel>
          <DropdownMenuLabel inset data-testid="inset-label">
            Inset Label
          </DropdownMenuLabel>
          <DropdownMenuItem data-testid="normal-item">Normal Item</DropdownMenuItem>
          <DropdownMenuItem inset data-testid="inset-item">
            Inset Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const normalLabel = screen.getByTestId("normal-label");
    const insetLabel = screen.getByTestId("inset-label");
    const normalItem = screen.getByTestId("normal-item");
    const insetItem = screen.getByTestId("inset-item");

    expect(normalLabel).not.toHaveAttribute("data-inset", "true");
    expect(insetLabel).toHaveAttribute("data-inset", "true");
    expect(normalItem).not.toHaveAttribute("data-inset", "true");
    expect(insetItem).toHaveAttribute("data-inset", "true");
  });
});
