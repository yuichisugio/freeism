/**
 * 文書ページの1つの節。
 * `items`は箇条書き、`externalLinks`は新しいタブで開く外部ページへのリンクの一覧で表示する。
 */
export type DocumentSection = {
  id: string;
  title: string;
  paragraphs: string[];
  items: string[];
  externalLinks?: { label: string; url: string }[];
};

/**
 * ヘルプ・プライバシーポリシー・利用規約など、見出しと節で構成する文書ページ。
 * 各節の見出しには`id`を付け、ほかの画面から`#id`で案内できるようにする。
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
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p>{introduction}</p>
      </header>
      {sections.map((section) => (
        <DocumentSectionView key={section.id} section={section} />
      ))}
    </main>
  );
}

/**
 * 文書ページの1つの節。
 */
function DocumentSectionView({ section }: { section: DocumentSection }) {
  const headingId = `${section.id}-heading`;
  return (
    <section id={section.id} aria-labelledby={headingId} className="flex scroll-mt-4 flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold">
        {section.title}
      </h2>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.items.length === 0 ? null : (
        <ul className="list-disc pl-6">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {section.externalLinks === undefined ? null : (
        <ul className="list-disc pl-6">
          {section.externalLinks.map((link) => (
            <li key={link.url}>
              <a href={link.url} className="underline" target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
