import { useState } from "react";

import {
  createIdempotencyKey,
  MarketsApiError,
  type MarketsClient,
  type PointsConnectionPageState,
} from "../client/api/markets-client";
import { LocalDateTime } from "./local-date-time";
import { ProblemBanner } from "./problem-banner";

export function PointsConnectionPanel({
  client,
  onChanged,
  state,
}: Readonly<{
  client: MarketsClient;
  onChanged: () => void;
  state: PointsConnectionPageState;
}>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connection = state.connection;
  const pending = connection?.pendingAction;

  async function run(operation: () => Promise<unknown>, redirect = false) {
    setBusy(true);
    setError(null);
    try {
      const result = (await operation()) as { authorizationUrl?: string };
      if (redirect && result.authorizationUrl) window.location.assign(result.authorizationUrl);
      else onChanged();
    } catch (reason) {
      setError(reason instanceof MarketsApiError ? reason.problem.code : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`points-${state.providerId}`} className="sub-panel">
      <h2 id={`points-${state.providerId}`}>{state.displayName}</h2>
      <p className="status-label">
        {state.status === "STOPPED"
          ? "新規利用停止中"
          : connection?.status === "ACTIVE"
            ? "連携済み"
            : connection?.status === "REAUTH_REQUIRED"
              ? "再連携が必要"
              : "未連携"}
      </p>
      {error ? <ProblemBanner message={error} /> : null}
      {pending ? (
        <div>
          <p>
            確認待ち（期限: <LocalDateTime value={new Date(pending.expiresAt).toISOString()} />）
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(() =>
                pending.kind === "LINK"
                  ? client.confirmPointsConnection(pending.pendingId, {
                      idempotencyKey: createIdempotencyKey("points_confirm"),
                    })
                  : client.confirmPointsUnlink(pending.pendingId, {
                      idempotencyKey: createIdempotencyKey("points_unlink_confirm"),
                    }),
              )
            }
            type="button"
          >
            内容を確認して確定
          </button>
        </div>
      ) : null}
      {(!connection && state.status === "ACTIVE") || connection?.status === "REAUTH_REQUIRED" ? (
        <button
          disabled={busy || Boolean(pending)}
          onClick={() =>
            void run(
              () =>
                client.startPointsConnection(state.providerId, {
                  idempotencyKey: createIdempotencyKey("points_link"),
                }),
              true,
            )
          }
          type="button"
        >
          {connection ? "再連携する" : "連携する"}
        </button>
      ) : null}
      {connection?.status === "REAUTH_REQUIRED" ? (
        <p>連携を解除するには、先に再連携してください。</p>
      ) : null}
      {connection?.status === "ACTIVE" ? (
        <button
          disabled={busy || Boolean(pending)}
          onClick={() =>
            void run(
              () =>
                client.startPointsUnlink(state.providerId, "利用者による連携解除", {
                  idempotencyKey: createIdempotencyKey("points_unlink"),
                }),
              true,
            )
          }
          type="button"
        >
          連携を解除する
        </button>
      ) : null}
    </section>
  );
}
