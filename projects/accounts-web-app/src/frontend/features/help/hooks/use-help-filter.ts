import { useState } from "react";

import { filterHelpTopics } from "../lib/help-topics";
import type { HelpTopic } from "../lib/help-topics";

/**
 * 使い方の絞り込みと、開いている質問の状態。
 * 絞り込みの語句を変えると、語句があれば一致した質問をすべて開き、空になればすべて閉じる。
 * @see ../components/help-page.test.tsx
 */
export function useHelpFilter(topics: HelpTopic[]) {
  const [query, setQuery] = useState("");
  const [expandedItemIds, setExpandedItemIds] = useState<ReadonlySet<string>>(new Set());
  const visibleTopics = filterHelpTopics(topics, query);

  const changeQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    const matchedItemIds =
      nextQuery.trim() === ""
        ? []
        : filterHelpTopics(topics, nextQuery).flatMap((topic) => topic.items.map((item) => item.id));
    setExpandedItemIds(new Set(matchedItemIds));
  };

  return { query, changeQuery, visibleTopics, expandedItemIds, changeExpandedItemIds: setExpandedItemIds };
}
