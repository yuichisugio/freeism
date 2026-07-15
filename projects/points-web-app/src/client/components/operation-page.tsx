import type { ReactNode } from "react";

import { en } from "../i18n/catalogs/en";
import { ja } from "../i18n/catalogs/ja";

export function OperationPage({
  children,
  description,
  eyebrow,
  title,
}: Readonly<{ children?: ReactNode; description: string; eyebrow: string; title: string }>) {
  return (
    <main className="app-page">
      <header className="app-header">
        <a className="wordmark" href="/">
          Freeism Points
        </a>
        <nav aria-label="主要メニュー" className="app-nav">
          <a href="/search">検索</a>
          <a href="/settings/profile">設定</a>
          <a href="/settings/exports">CSV</a>
        </nav>
        <div aria-label="Language" className="locale-switch">
          <button type="button">{ja.language}</button>
          <button type="button">{en.language}</button>
        </div>
      </header>
      <section className="operation-layout">
        <aside aria-hidden="true" className="ledger-rail">
          <span>FIX</span>
          <span>＋</span>
          <span>−</span>
        </aside>
        <div className="operation-main">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lede">{description}</p>
          <div className="operation-content">{children}</div>
        </div>
      </section>
    </main>
  );
}

export function EmptyState({ children }: Readonly<{ children?: ReactNode }>) {
  return <p className="status-card">{children ?? ja.empty}</p>;
}

export function ProblemState({ message = ja.error }: Readonly<{ message?: string }>) {
  return (
    <p className="status-card status-error" role="alert">
      {message}
    </p>
  );
}
