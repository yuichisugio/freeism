/**
 * サービス識別子の表示名（固有名詞のため日英共通）。
 */
const serviceNames: Partial<Record<string, string>> = {
  google: "Google",
  github: "GitHub",
  orcid: "ORCID",
  gitlab: "GitLab",
  stackoverflow: "Stack Overflow",
  qiita: "Qiita",
  note: "note",
  zenn: "Zenn",
  codeberg: "Codeberg",
  x: "X",
  huggingface: "Hugging Face",
};

/**
 * サービス識別子を表示名にする。
 * 汎用Webページなどサービスを判定できない場合は`Web`とする。
 */
export function formatServiceName(service: string | null): string {
  if (service === null) return "Web";
  return serviceNames[service] ?? service;
}
