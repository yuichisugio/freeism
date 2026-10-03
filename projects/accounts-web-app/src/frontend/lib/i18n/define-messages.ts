/**
 * 日英の文言を定義する。
 * 英語は日本語と同じキー・型を持つことを型で強制する。
 */
export function defineMessages<TMessages extends Record<string, unknown>>(messages: {
  ja: TMessages;
  en: NoInfer<TMessages>;
}): { ja: TMessages; en: TMessages } {
  return messages;
}
