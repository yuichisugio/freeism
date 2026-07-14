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
    <section aria-labelledby="points-state-heading" className="sub-panel">
      <h2 id="points-state-heading">接続状態</h2>
      <p className="status-label">{state.status}</p>
      {error ? <ProblemBanner message={error} /> : null}
      {state.pendingAction ? (
        <div>
          <p>
            確認待ち（期限: <LocalDateTime value={state.pendingAction.expiresAt} />）
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void run(() =>
                state.pendingAction?.kind === "LINK_CONFIRM"
                  ? client.confirmPointsConnection(state.pendingAction.pendingId, {
                      idempotencyKey: createIdempotencyKey("points_confirm"),
                    })
                  : client.confirmPointsUnlink(state.pendingAction!.pendingId, {
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
      {state.status === "UNLINKED" || state.status === "REAUTH_REQUIRED" ? (
        <button
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                client.startPointsConnection({
                  idempotencyKey: createIdempotencyKey("points_link"),
                }),
              true,
            )
          }
          type="button"
        >
          {state.status === "REAUTH_REQUIRED" ? "Pointsへ再連携" : "Pointsへ連携"}
        </button>
      ) : null}
      {state.status === "ACTIVE" ? (
        <button
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                client.startPointsUnlink("利用者による連携解除", {
                  idempotencyKey: createIdempotencyKey("points_unlink"),
                }),
              true,
            )
          }
          type="button"
        >
          Points連携を解除
        </button>
      ) : null}
    </section>
  );
}
