import { useState } from "react";

import { GoogleReauthButton } from "../auth/google-reauth-button";

type Validation = { fileHash: string; rowCount: number; validationHash: string };

export function CsvValidationForm({
  endpoint,
  title,
}: Readonly<{ endpoint: string; title: string }>) {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const requiresReason = endpoint.startsWith("/api/admin/");

  async function send(action: "commit" | "validate") {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${endpoint}/${action}`, {
        body: file,
        headers: {
          "Content-Type": "text/csv",
          ...(action === "commit" && validation
            ? {
                "Idempotency-Key": crypto.randomUUID(),
                "X-Validation-Hash": validation.validationHash,
                ...(requiresReason ? { "X-Reason": reason.trim() } : {}),
              }
            : {}),
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        data?: Validation;
        errors?: Array<{ code?: string; column?: string | null; message?: string; row?: number }>;
        title?: string;
      };
      if (!response.ok) {
        setValidation(null);
        setError(
          [
            body.title,
            ...(body.errors ?? []).map(
              (item) =>
                item.message ??
                [item.row ? `${item.row}行` : null, item.column, item.code]
                  .filter(Boolean)
                  .join(" "),
            ),
          ]
            .filter(Boolean)
            .join(" / ") || `HTTP ${response.status}`,
        );
        return;
      }
      if (action === "validate" && body.data) setValidation(body.data);
      if (action === "commit") setValidation(null);
    } catch {
      setValidation(null);
      setError("通信に失敗しました。CSVを選び直さず、もう一度実行できます。");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="form-card" aria-labelledby="csv-heading">
      <h2 id="csv-heading">{title} CSV</h2>
      <label className="file-control">
        <span>CSVファイルを選択</span>
        <input
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setValidation(null);
            setError(null);
          }}
          type="file"
        />
      </label>
      {file ? <p className="data-line">{file.name}</p> : <p>UTF-8のCSVを選択してください。</p>}
      {error ? (
        <p className="status-card status-error" role="alert">
          {error}
        </p>
      ) : null}
      {validation ? (
        <div className="status-card" aria-live="polite">
          <strong>{validation.rowCount}行を確認しました。</strong>
          <p>この検証結果を確定すると台帳へ反映します。</p>
          {requiresReason ? (
            <label>
              変更理由
              <textarea onChange={(event) => setReason(event.target.value)} value={reason} />
            </label>
          ) : null}
          <GoogleReauthButton />
          <button
            disabled={pending || (requiresReason && !reason.trim())}
            onClick={() => void send("commit")}
            type="button"
          >
            内容を確定する
          </button>
        </div>
      ) : (
        <button disabled={!file || pending} onClick={() => void send("validate")} type="button">
          {pending ? "確認中…" : "サーバーで内容を確認"}
        </button>
      )}
    </section>
  );
}
