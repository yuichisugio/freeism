import { useMessages } from "../../../lib/i18n/i18n-provider";
import { themePreferences, useTheme } from "../../../lib/theme";
import { settingsMessages } from "../messages";
import { SegmentedRadioGroup } from "./segmented-radio-group";
import { SettingsSection } from "./settings-section";

/**
 * テーマの選択（システム・ライト・ダーク）。
 * 選ぶとすぐに表示へ反映し、このブラウザーのlocalStorageへ保存する（ログイン不要）。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./settings-sections.test.tsx
 */
export function ThemeSection() {
  const messages = useMessages(settingsMessages);
  const { theme, setTheme } = useTheme();
  const options = themePreferences.map((value) => ({ value, label: messages.themeOptions[value] }));

  return (
    <SettingsSection title={messages.themeTitle}>
      <SegmentedRadioGroup label={messages.themeTitle} value={theme} options={options} onChange={setTheme} />
    </SettingsSection>
  );
}
