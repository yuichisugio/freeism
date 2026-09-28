import { Radio, RadioGroup } from "@heroui/react";

/**
 * 1つを選ぶ設定の分割ボタン（言語・テーマ）。
 * 意味は`RadioGroup`のまま、見た目を枠の中に選択肢を並べ、選択中を主色の面にする。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 */
export function SegmentedRadioGroup<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: readonly { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      // 選択肢はoptionsの値だけのため、選ばれた値を同じ型として扱う。
      onChange={(next) => onChange(next as TValue)}
      orientation="horizontal"
      className="inline-flex flex-row flex-wrap gap-0.5 rounded-full border border-border bg-surface p-1"
    >
      {options.map((option) => (
        <Radio key={option.value} value={option.value}>
          <Radio.Content className="rounded-full px-4 py-0.5 font-normal text-muted not-data-selected:data-hovered:text-foreground data-selected:bg-accent data-selected:text-accent-foreground data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-(--focus)">
            {option.label}
          </Radio.Content>
        </Radio>
      ))}
    </RadioGroup>
  );
}
