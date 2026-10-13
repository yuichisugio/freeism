import { useI18n, useMessages } from "../../../lib/i18n/i18n-provider";
import type { Language } from "../../../lib/i18n/language";
import { settingsMessages } from "../messages";
import { SegmentedRadioGroup } from "./segmented-radio-group";
import { SettingsSection } from "./settings-section";

/**
 * 言語の選択肢。
 * どちらの言語で表示していても読めるよう、各言語の名前はその言語で示す。
 */
const languageOptions: readonly { value: Language; label: string }[] = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
];

/**
 * 言語の選択。
 * 選ぶとすぐに表示を切り替え、このブラウザーのlocalStorageへ保存する（ログイン不要）。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./settings-sections.test.tsx
 */
export function LanguageSection() {
  const messages = useMessages(settingsMessages);
  const { language, setLanguage } = useI18n();

  return (
    <SettingsSection title={messages.languageTitle} description={messages.languageDescription}>
      <SegmentedRadioGroup
        label={messages.languageTitle}
        value={language}
        options={languageOptions}
        onChange={setLanguage}
      />
    </SettingsSection>
  );
}
