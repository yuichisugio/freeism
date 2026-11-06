import { Alert } from "@heroui/react";
import type { ReactNode } from "react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ExternalLinkIcon } from "../../app-shell/components/icons";
import type { HelpBlock } from "../lib/help-topics";
import { helpMessages } from "../messages";

const codeClassName = "rounded-sm bg-surface-secondary px-1 py-0.5 font-mono text-xs [overflow-wrap:anywhere]";

/**
 * 文字列の`` `コード` ``を`code`要素、`**強調**`を`b`要素にして表示する。
 */
function RichText({ text }: { text: string }): ReactNode {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className={codeClassName}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) return <b key={index}>{part.slice(2, -2)}</b>;
    return part;
  });
}

/**
 * 1つの質問の回答（本文のブロックの並び）。
 * @see ./help-page.test.tsx
 */
export function HelpBlocks({ blocks }: { blocks: HelpBlock[] }) {
  return blocks.map((block, index) => <HelpBlockView key={index} block={block} />);
}

/**
 * 本文の1ブロック。
 */
function HelpBlockView({ block }: { block: HelpBlock }) {
  const messages = useMessages(helpMessages);
  switch (block.kind) {
    case "paragraph":
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
    case "list":
    case "steps": {
      const List = block.kind === "list" ? "ul" : "ol";
      return (
        <List className={`flex flex-col gap-1 pl-5 ${block.kind === "list" ? "list-disc" : "list-decimal"}`}>
          {block.items.map((item) => (
            <li key={item}>
              <RichText text={item} />
            </li>
          ))}
        </List>
      );
    }
    case "note":
      return (
        <Alert status={block.tone ?? "accent"} className="gap-2 py-2">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              <RichText text={block.text} />
            </Alert.Description>
          </Alert.Content>
        </Alert>
      );
    case "links":
      return (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {block.links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                {link.label}
                <ExternalLinkIcon className="size-3.5" />
                <span className="sr-only">{messages.opensInNewTab}</span>
              </a>
            </li>
          ))}
        </ul>
      );
    case "code":
      return (
        <p>
          <code className={codeClassName}>{block.text}</code>
        </p>
      );
    case "statuses":
      return (
        <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1">
          {block.entries.map((entry) => (
            <div key={entry.status} className="contents">
              <dt>
                <code className={codeClassName}>{entry.status}</code>
              </dt>
              <dd className="m-0">
                <RichText text={entry.text} />
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}
