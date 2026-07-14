import type { AuctionImportPreview } from "../client/api/markets-client";

export function AuctionImportPreviewView({ preview }: Readonly<{ preview: AuctionImportPreview }>) {
  return (
    <section aria-labelledby="import-preview-heading" className="sub-panel">
      <h2 id="import-preview-heading">サーバー検証結果</h2>
      <p>{preview.rows.length}件を作成できます。</p>
      <ul>
        {preview.rows.map((row, index) => (
          <li key={String(row.clientRowId ?? index)}>{String(row.title ?? `行 ${index + 1}`)}</li>
        ))}
      </ul>
    </section>
  );
}
