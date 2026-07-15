import { useState } from "react";

type ExportState = { cursor: string; exportId: string; expiresAt: string; nextPage: number };

export function CsvExportPanel() {
  const [pageSize, setPageSize] = useState(1000);
  const [state, setState] = useState<ExportState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function createSnapshot() {
    setMessage(null);
    const response = await fetch("/api/csv-exports", {
      body: JSON.stringify({ pageSize, type: "PROFILE" }),
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      method: "POST",
    });
    const body = (await response.json()) as {
      data?: { cursor: string; exportId: string; expiresAt: string };
    };
    if (!response.ok || !body.data) {
      setMessage("スナップショットを作成できませんでした。");
      return;
    }
    setState({ ...body.data, nextPage: 1 });
    setMessage("30分間有効なスナップショットを作成しました。");
  }

  async function downloadNext() {
    if (!state) return;
    if (Date.now() >= Date.parse(state.expiresAt)) {
      setState(null);
      setMessage("期限が切れました。新しいスナップショットの1ページ目からやり直してください。");
      return;
    }
    const response = await fetch(
      `/api/csv-exports/${encodeURIComponent(state.exportId)}/pages?cursor=${encodeURIComponent(state.cursor)}`,
    );
    if (!response.ok) {
      setMessage("CSVを取得できませんでした。");
      return;
    }
    const csv = await response.text();
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `points-profile-${String(state.nextPage).padStart(3, "0")}.csv`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
    const nextCursor = response.headers.get("X-Freeism-Next-Cursor");
    setState(nextCursor ? { ...state, cursor: nextCursor, nextPage: state.nextPage + 1 } : null);
    setMessage(
      nextCursor ? `${state.nextPage}ページ目を保存しました。` : "すべてのページを保存しました。",
    );
  }

  return (
    <section className="form-card">
      <h2>CSV export</h2>
      <p>プロフィールの非公開データを含む場合があります。保存先を確認してください。</p>
      <label>
        1ページの行数{" "}
        <input
          max={1000}
          min={1}
          onChange={(event) => setPageSize(Number(event.target.value))}
          type="number"
          value={pageSize}
        />
      </label>
      <p>スナップショットは30分間有効です。ページごとに保存し、ブラウザ内で全件を結合しません。</p>
      <div className="button-row">
        <button onClick={() => void createSnapshot()} type="button">
          スナップショットを作成
        </button>
        <button disabled={!state} onClick={() => void downloadNext()} type="button">
          次のCSVを取得
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
