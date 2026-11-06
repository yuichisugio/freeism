import { Accordion, Chip, Input } from "@heroui/react";
import { useRef } from "react";
import type { MouseEvent } from "react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ChevronDownIcon } from "../../app-shell/components/icons";
import { PageMain } from "../../app-shell/components/page-main";
import { useHelpFilter } from "../hooks/use-help-filter";
import type { HelpTopic } from "../lib/help-topics";
import { helpMessages } from "../messages";
import { HelpBlocks } from "./help-blocks";

const filterInputId = "help-filter";

/**
 * 使い方（`/help`）。
 * ログインせずに閲覧でき、話題ごとの質問と回答を開閉して読む。
 * PC幅は左に目次を固定し、820px以下は目次を本文の上の折りたたみにする。
 * 本文の先頭の「絞り込み」で、質問と本文に語句を含む質問だけを開いて表示する。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ../../../../../docs/specification/v0.1/design-system/design-system.ja.md
 * @see ./help-page.test.tsx
 */
export function HelpPage() {
  const messages = useMessages(helpMessages);
  const { query, changeQuery, visibleTopics, expandedItemIds, changeExpandedItemIds } = useHelpFilter(
    messages.topics,
  );
  const collapsibleTableOfContentsRef = useRef<HTMLDetailsElement>(null);

  // 目次から話題へ移動する。
  // 折りたたみの目次は閉じる。
  const scrollToTopic = (event: MouseEvent<HTMLAnchorElement>, topicId: string) => {
    event.preventDefault();
    if (collapsibleTableOfContentsRef.current !== null) collapsibleTableOfContentsRef.current.open = false;
    document.getElementById(topicId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tableOfContents = (
    <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
      {visibleTopics.map((topic) => (
        <li key={topic.id}>
          <a href={`#${topic.id}`} onClick={(event) => scrollToTopic(event, topic.id)}>
            {topic.title}
          </a>
        </li>
      ))}
    </ol>
  );
  const tableOfContentsCardClassName = "rounded-xl border border-border bg-surface p-4 shadow-surface";
  const tableOfContentsTitleClassName = "font-display text-sm font-bold text-muted";

  return (
    <PageMain>
      <h1 className="pt-2 text-2xl">{messages.title}</h1>
      <div className="grid grid-cols-[var(--q-label-w)_minmax(0,1fr)] items-start gap-8 max-[820px]:grid-cols-1">
        <nav
          aria-label={messages.tableOfContents}
          className={`sticky top-(--sticky-offset) flex flex-col gap-2 max-[820px]:hidden ${tableOfContentsCardClassName}`}
        >
          <h2 className={tableOfContentsTitleClassName}>{messages.tableOfContents}</h2>
          {tableOfContents}
        </nav>
        <details ref={collapsibleTableOfContentsRef} className={`hidden max-[820px]:block ${tableOfContentsCardClassName}`}>
          <summary className={`cursor-pointer ${tableOfContentsTitleClassName} [[open]>&]:mb-2`}>
            {messages.tableOfContents}
          </summary>
          {tableOfContents}
        </details>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex max-w-105 flex-col gap-2">
            <h2 className="text-lg">
              <label htmlFor={filterInputId}>{messages.filterLabel}</label>
            </h2>
            <Input
              id={filterInputId}
              type="search"
              value={query}
              placeholder={messages.filterPlaceholder}
              onChange={(event) => changeQuery(event.target.value)}
              className="border-border bg-surface focus:border-accent"
            />
          </div>
          <Accordion
            allowsMultipleExpanded
            hideSeparator
            expandedKeys={expandedItemIds}
            onExpandedChange={(keys) => changeExpandedItemIds(new Set(Array.from(keys, String)))}
            className="flex flex-col gap-6"
          >
            {visibleTopics.map((topic) => (
              <HelpTopicSection key={topic.id} topic={topic} developerChip={messages.developerChip} />
            ))}
          </Accordion>
          {visibleTopics.length === 0 ? <p className="text-muted">{messages.noMatch}</p> : null}
        </div>
      </div>
    </PageMain>
  );
}

/**
 * 1つの話題の節と、その質問のアコーディオン。
 * 開発者向けの話題は見出しに「開発者向け」の印を付ける。
 */
function HelpTopicSection({ topic, developerChip }: { topic: HelpTopic; developerChip: string }) {
  const headingId = `${topic.id}-heading`;
  return (
    <section id={topic.id} aria-labelledby={headingId} className="flex scroll-mt-(--sticky-offset) flex-col gap-2">
      <h2 id={headingId} className="mb-1 flex items-center gap-2 text-lg">
        {topic.title}
        {topic.audience === "developer" ? (
          <Chip size="sm" color="accent" variant="soft">
            {developerChip}
          </Chip>
        ) : null}
      </h2>
      {topic.items.map((item) => (
        <Accordion.Item key={item.id} id={item.id} className="rounded-lg border border-solid border-border bg-surface">
          <Accordion.Heading>
            <Accordion.Trigger className="gap-3 rounded-lg px-4 py-3 font-sans text-md">
              {item.question}
              <Accordion.Indicator>
                <ChevronDownIcon />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="flex max-w-(--prose-max) flex-col gap-3 text-foreground">
              <HelpBlocks blocks={item.blocks} />
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </section>
  );
}
