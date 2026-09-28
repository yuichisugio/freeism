import { PageMain } from "./page-main";

/**
 * 文書ページの1つの節。
 * `paragraphs`は段落、`items`は箇条書きで表示する。
 */
export type DocumentSection = {
  id: string;
  title: string;
  paragraphs: string[];
  items: string[];
};

/**
 * プライバシーポリシー・利用規約など、見出しと節で構成する文書ページ。
 * カードは他の画面と同じ幅（`PageMain`の`--page-max`）に広げ、見出しと本文をカードの幅いっぱいに置く。
 * 各節の見出しには`id`を付け、ほかの画面から`#id`で案内できるようにする。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 */
export function DocumentPage({
  title,
  introduction,
  sections,
}: {
  title: string;
  introduction: string;
  sections: DocumentSection[];
}) {
  return (
    <PageMain>
      <article className="flex flex-col gap-6 rounded-xl border border-border bg-surface px-6 py-5 text-sm shadow-surface max-sm:p-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-xl">{title}</h1>
          <p>{introduction}</p>
        </header>
        {sections.map((section) => (
          <DocumentSectionView key={section.id} section={section} />
        ))}
      </article>
    </PageMain>
  );
}

/**
 * 文書ページの1つの節。
 */
function DocumentSectionView({ section }: { section: DocumentSection }) {
  const headingId = `${section.id}-heading`;
  return (
    <section
      id={section.id}
      aria-labelledby={headingId}
      className="flex scroll-mt-(--sticky-offset) flex-col gap-2"
    >
      <h2 id={headingId} className="text-md">
        {section.title}
      </h2>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.items.length === 0 ? null : (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
