import { useMessages } from "../../../lib/i18n/i18n-provider";
import { helpMessages, providerRevokePages } from "../messages";
import type { HelpSection } from "../messages";

/**
 * 公開ヘルプ・プライバシー説明（`/help`）。
 * ログインせずに閲覧でき、各Providerでの連携許可の取消方法を案内する。
 * @see ../../../../../docs/specification/v0.1/main.ja.md
 * @see ./help-page.test.tsx
 */
export function HelpPage() {
  const messages = useMessages(helpMessages);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p>{messages.introduction}</p>
      </header>
      {messages.sections.map((section) => (
        <HelpSectionView key={section.id} section={section} />
      ))}
      <section aria-labelledby="help-revoke" className="flex flex-col gap-3">
        <h2 id="help-revoke" className="text-lg font-semibold">
          {messages.revokeTitle}
        </h2>
        <p>{messages.revokeDescription}</p>
        <ul className="list-disc pl-6">
          {providerRevokePages.map((page) => (
            <li key={page.name}>
              <a href={page.url} className="underline" target="_blank" rel="noopener noreferrer">
                {messages.revokeLinkLabel(page.name)}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/**
 * ヘルプの1つの節。
 */
function HelpSectionView({ section }: { section: HelpSection }) {
  const headingId = `help-${section.id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
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
    </section>
  );
}
