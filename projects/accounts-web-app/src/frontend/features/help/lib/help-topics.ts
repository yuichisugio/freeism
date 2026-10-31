/**
 * 使い方の本文の1ブロック。
 * 文字列の中の`` `コード` ``と`**強調**`は、表示時にそれぞれ`code`・`b`要素にする。
 */
export type HelpBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "note"; text: string; tone?: "warning" | "danger" }
  | { kind: "links"; links: { label: string; url: string }[] }
  | { kind: "code"; text: string }
  | { kind: "statuses"; entries: { status: string; text: string }[] };

/**
 * 1つの質問と回答。
 * `id`は使い方の全体で一意にする。
 */
export type HelpItem = {
  id: string;
  question: string;
  blocks: HelpBlock[];
};

/**
 * 使い方の話題。
 * `id`は節の`id`になり、ほかの画面から`/help#id`で案内するときのリンク先になる。
 */
export type HelpTopic = {
  id: string;
  audience: "user" | "developer";
  title: string;
  items: HelpItem[];
};

// --------------------------------------------------
// 絞り込み
// --------------------------------------------------

/**
 * 絞り込みの照合に使う、質問と本文の文字列（書式の記号を除き、小文字にしたもの）。
 */
function toSearchText(item: HelpItem): string {
  const blockTexts = item.blocks.flatMap((block) => {
    switch (block.kind) {
      case "paragraph":
      case "note":
      case "code":
        return [block.text];
      case "list":
      case "steps":
        return block.items;
      case "links":
        return block.links.map((link) => link.label);
      case "statuses":
        return block.entries.flatMap((entry) => [entry.status, entry.text]);
    }
  });
  return [item.question, ...blockTexts]
    .join("\n")
    .replaceAll("`", "")
    .replaceAll("**", "")
    .toLowerCase();
}

/**
 * 質問と本文に絞り込みの語句を部分一致（大文字・小文字を区別しない）で含む質問だけを残す。
 * 一致する質問が無い話題は除く。
 * 語句が空（空白だけを含む）なら、すべての話題を返す。
 * @see ../components/help-page.test.tsx
 */
export function filterHelpTopics(topics: HelpTopic[], query: string): HelpTopic[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") return topics;
  return topics
    .map((topic) => ({ ...topic, items: topic.items.filter((item) => toSearchText(item).includes(normalizedQuery)) }))
    .filter((topic) => topic.items.length > 0);
}
