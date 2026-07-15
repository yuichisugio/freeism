import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import {
  createIdempotencyKey,
  marketsClient,
  type AuctionImportPreview,
  type MarketsClient,
} from "../../client/api/markets-client";
import { AuctionImportPreviewView } from "../../components/auction-import-preview";
import { ProblemBanner } from "../../components/problem-banner";

export const Route = createFileRoute("/auctions/import")({
  component: AuctionImportPage,
  head: () => ({ meta: [{ title: "Auction CSV作成 | Freeism Markets" }] }),
});

export function AuctionImportPage({
  client = marketsClient,
}: Readonly<{ client?: MarketsClient }>) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AuctionImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(
        await client.validateAuctionImport(file, {
          idempotencyKey: createIdempotencyKey("auction_csv_validate"),
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "VALIDATION_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <section aria-labelledby="import-heading" className="ledger-panel">
        <p className="eyebrow">CSV import</p>
        <h1 id="import-heading">CSVからAuctionを作成</h1>
        <p>1回につき最大1,000行です。サーバー検証済みpreviewだけを確定できます。</p>
        {error ? <ProblemBanner message={error} /> : null}
        {message ? <p aria-live="polite">{message}</p> : null}
        <label htmlFor="auction-csv">CSVファイル</label>
        <input
          accept="text/csv,.csv"
          id="auction-csv"
          onChange={(event) => {
            setFile(event.currentTarget.files?.[0] ?? null);
            setPreview(null);
            setMessage(null);
          }}
          type="file"
        />
        <button disabled={!file || busy} onClick={() => void validate()} type="button">
          サーバーで検証
        </button>
        {preview ? <AuctionImportPreviewView preview={preview} /> : null}
        <button
          disabled={!preview || busy}
          onClick={() => {
            if (!preview) return;
            setBusy(true);
            setError(null);
            void client
              .commitAuctionImport(preview, {
                idempotencyKey: createIdempotencyKey("auction_csv_commit"),
              })
              .then(
                () => setMessage("Auctionを作成しました。出品履歴から確認してください。"),
                (reason: unknown) =>
                  setError(reason instanceof Error ? reason.message : "COMMIT_FAILED"),
              )
              .finally(() => setBusy(false));
          }}
          type="button"
        >
          検証済み内容を確定
        </button>
      </section>
    </main>
  );
}
