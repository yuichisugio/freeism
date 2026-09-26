import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  AccountsExternalAccountList,
  type AccountsExternalAccount,
} from "../client/components/accounts/accounts-external-account-list";
import { EmptyState, OperationPage, ProblemState } from "../client/components/operation-page";

type PublicProfile = {
  accountsLinks: Array<{
    accountsOrigin: string;
    accountsProfileUrl: string;
    accountsUserId: string;
    externalAccounts: AccountsExternalAccount[];
  }>;
  description: string;
  displayName: string;
  evaluationAccounts: Array<{
    balance?: string;
    evaluationCriterionId: string;
    evaluationTotal?: string;
    name: string;
  }>;
  pointPackages: Array<{ name: string; pointPackageId: string }>;
  pointsUserId: string;
};

export const Route = createFileRoute("/profiles/$pointsUserId")({ component: ProfileRoutePage });

function ProfileRoutePage() {
  return <ProfilePage pointsUserId={Route.useParams().pointsUserId} />;
}

export function ProfilePage({ pointsUserId }: Readonly<{ pointsUserId: string }>) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/profiles/${encodeURIComponent(pointsUserId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("PROFILE_NOT_FOUND");
        return (await response.json()) as { data: PublicProfile };
      })
      .then((body) => {
        if (active) setProfile(body.data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [pointsUserId]);
  return (
    <OperationPage
      description="公開設定された評価結果・公式Packageと、Accountsで公開された外部アカウントを表示します。"
      eyebrow="Public profile"
      title={profile?.displayName ?? "Pointsプロフィール"}
    >
      {failed ? <ProblemState message="プロフィールが見つからないか、非公開です。" /> : null}
      {profile ? (
        <div className="card-grid">
          <section className="form-card">
            <h2>{profile.pointsUserId}</h2>
            <p>{profile.description || "紹介はまだありません。"}</p>
          </section>
          <section className="form-card">
            <h2>外部アカウント</h2>
            {profile.accountsLinks.length === 0 ? (
              <EmptyState />
            ) : (
              profile.accountsLinks.map((link) => (
                <div key={`${link.accountsOrigin} ${link.accountsUserId}`}>
                  <p>
                    <a href={link.accountsProfileUrl} rel="me nofollow noopener noreferrer ugc">
                      {link.accountsProfileUrl}
                    </a>
                  </p>
                  <AccountsExternalAccountList externalAccounts={link.externalAccounts} />
                </div>
              ))
            )}
          </section>
          <section className="form-card">
            <h2>評価結果</h2>
            {profile.evaluationAccounts.length === 0 ? (
              <EmptyState />
            ) : (
              <ul className="signed-list">
                {profile.evaluationAccounts.map((account) => (
                  <li key={account.evaluationCriterionId}>
                    <strong>{account.balance ?? account.evaluationTotal ?? "—"}</strong>
                    <span>{account.name}</span>
                    <small>
                      {account.evaluationTotal === undefined
                        ? ""
                        : `評価累計 ${account.evaluationTotal}`}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="form-card">
            <h2>公式Package</h2>
            {profile.pointPackages.length === 0 ? (
              <EmptyState />
            ) : (
              <ul>
                {profile.pointPackages.map((item) => (
                  <li key={item.pointPackageId}>{item.name}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : !failed ? (
        <EmptyState>プロフィールを読み込んでいます。</EmptyState>
      ) : null}
    </OperationPage>
  );
}
