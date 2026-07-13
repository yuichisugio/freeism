import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { GoogleReauthButton } from "../client/components/auth/google-reauth-button";
import { EmptyState, OperationPage, ProblemState } from "../client/components/operation-page";

type AdminMembership = { pointsUserId: string; role: "ADMIN" };

export const Route = createFileRoute("/admin/members")({ component: AdminMembersPage });

export function AdminMembersPage() {
  const [pointsUserId, setPointsUserId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<AdminMembership[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadMembers = useCallback(async () => {
    const response = await fetch("/api/admin/admin-memberships");
    if (!response.ok) {
      setLoadFailed(true);
      return;
    }
    const body = (await response.json()) as { data: AdminMembership[] };
    setMemberships(body.data);
    setLoadFailed(false);
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function addMember() {
    const response = await fetch("/api/admin/admin-memberships", {
      body: JSON.stringify({ pointsUserId, reason }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      method: "POST",
    });
    if (response.ok) {
      setMessage("ADMINを追加しました。");
      setPointsUserId("");
      await loadMembers();
      return;
    }
    setMessage(
      response.status === 401
        ? "Googleで再認証してから、もう一度追加してください。"
        : "ADMINを追加できませんでした。",
    );
  }

  async function deleteMember(targetPointsUserId: string) {
    const response = await fetch(
      `/api/admin/admin-memberships/${encodeURIComponent(targetPointsUserId)}`,
      {
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      },
    );
    if (response.ok) {
      setMessage("ADMINを削除しました。");
      await loadMembers();
      return;
    }
    setMessage(
      response.status === 401
        ? "Googleで再認証してから、もう一度削除してください。"
        : "ADMINを削除できませんでした。最後の1人は削除できません。",
    );
  }

  return (
    <OperationPage
      description="同格ADMINを追加・削除します。最後の1人は削除できません。"
      eyebrow="ADMIN"
      title="管理者"
    >
      <section className="form-card">
        <h2>ADMINを追加</h2>
        <label>
          Points user ID{" "}
          <input onChange={(event) => setPointsUserId(event.target.value)} value={pointsUserId} />
        </label>
        <label>
          追加理由 <textarea onChange={(event) => setReason(event.target.value)} value={reason} />
        </label>
        <GoogleReauthButton />
        <button
          disabled={!pointsUserId || !reason.trim()}
          onClick={() => void addMember()}
          type="button"
        >
          ADMINを追加
        </button>
        {message ? <p className="status-card">{message}</p> : null}
      </section>
      {loadFailed ? (
        <ProblemState message="ADMIN一覧を読み込めませんでした。" />
      ) : memberships.length === 0 ? (
        <EmptyState>ADMINはまだ登録されていません。</EmptyState>
      ) : (
        <section className="form-card">
          <h2>現在のADMIN</h2>
          <ul className="signed-list">
            {memberships.map((membership) => (
              <li key={membership.pointsUserId}>
                <strong>{membership.role}</strong>
                <span>{membership.pointsUserId}</span>
                <button
                  className="secondary-button"
                  disabled={!reason.trim() || memberships.length === 1}
                  onClick={() => void deleteMember(membership.pointsUserId)}
                  type="button"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </OperationPage>
  );
}
