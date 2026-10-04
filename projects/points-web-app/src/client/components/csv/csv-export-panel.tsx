import { useState } from "react";

type ExportState = { cursor: string; nextPage: number };

export function CsvExportPanel() {
  const [pageSize, setPageSize] = useState(1000);
  const [state, setState] = useState<ExportState | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function downloadPage() {
    setDownloading(true);
    setMessage(null);
    try {
      const page = state ?? { cursor: "0", nextPage: 1 };
      const response = await fetch("/api/csv-exports", {
        body: JSON.stringify({ cursor: page.cursor, pageSize, type: "PROFILE" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        setMessage("CSVを取得できませんでした。");
        return;
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      try {
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = `points-profile-${String(page.nextPage).padStart(3, "0")}.csv`;
        anchor.click();
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
      const nextCursor = response.headers.get("X-Freeism-Next-Cursor");
      setState(nextCursor ? { cursor: nextCursor, nextPage: page.nextPage + 1 } : null);
      setMessage(
        nextCursor ? `${page.nextPage}ページ目を保存しました。` : "すべてのページを保存しました。",
      );
    } catch {
      setMessage("CSVを取得できませんでした。");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="form-card">
      <h2>CSV export</h2>
      <p>プロフィールの非公開データを含む場合があります。保存先を確認してください。</p>
      <label>
        1ページの行数{" "}
        <input
          disabled={downloading || state !== null}
          max={1000}
          min={1}
          onChange={(event) => setPageSize(Number(event.target.value))}
          type="number"
          value={pageSize}
        />
      </label>
      <p>取得時点のデータをページごとに保存します。</p>
      <div className="button-row">
        <button disabled={downloading} onClick={() => void downloadPage()} type="button">
          {state ? "次のCSVを取得" : "CSVを取得"}
        </button>
      </div>
      {message ? (
        <p aria-live="polite" className="status-card">
          {message}
        </p>
      ) : null}
    </section>
  );
}
