import { useEffect, useState } from "react";

import { GoogleReauthButton } from "../auth/google-reauth-button";

const visibilityLabels = ["残高", "評価累計", "FIX履歴", "譲渡履歴", "交換履歴"] as const;
type Visibility = "PRIVATE" | "PUBLIC";
type EvaluationVisibility = {
  evaluationCriterionId: string;
  balanceVisibility: Visibility;
  evaluationTotalVisibility: Visibility;
  fixHistoryVisibility: Visibility;
  transferHistoryVisibility: Visibility;
  exchangeHistoryVisibility: Visibility;
};
export type ProfileData = {
  description: string;
  displayName: string;
  evaluationVisibilities: EvaluationVisibility[];
  externalUrls: string[];
  pointPackages: Array<{ displayOrder: number; pointPackageId: string }>;
  visibility: Visibility;
};

export function ProfileSettingsForm({
  initialProfile,
}: Readonly<{ initialProfile?: ProfileData }>) {
  const [description, setDescription] = useState(initialProfile?.description ?? "");
  const [displayName, setDisplayName] = useState(initialProfile?.displayName ?? "");
  const [evaluationVisibilities, setEvaluationVisibilities] = useState<EvaluationVisibility[]>(
    initialProfile?.evaluationVisibilities ?? [],
  );
  const [externalUrls, setExternalUrls] = useState<string[]>(initialProfile?.externalUrls ?? []);
  const [packages, setPackages] = useState<string[]>(
    initialProfile?.pointPackages.map((item) => item.pointPackageId) ?? [],
  );
  const [profileVisibility, setProfileVisibility] = useState<Visibility>(
    initialProfile?.visibility ?? "PUBLIC",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(initialProfile !== undefined);

  useEffect(() => {
    if (initialProfile) return;
    let active = true;
    void fetch("/api/profile")
      .then(async (response) =>
        response.ok ? ((await response.json()) as { data: ProfileData }) : null,
      )
      .then((body) => {
        if (!active) return;
        if (!body) {
          setMessage("プロフィールを読み込めませんでした。再読み込みしてください。");
          return;
        }
        setDescription(body.data.description);
        setDisplayName(body.data.displayName);
        setEvaluationVisibilities(body.data.evaluationVisibilities);
        setExternalUrls(body.data.externalUrls);
        setPackages(body.data.pointPackages.map((item) => item.pointPackageId));
        setProfileVisibility(body.data.visibility);
        setReady(true);
      })
      .catch(() => {
        if (active) setMessage("プロフィールを読み込めませんでした。再読み込みしてください。");
      });
    return () => {
      active = false;
    };
  }, [initialProfile]);

  function move(index: number, offset: number) {
    const next = [...packages];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setPackages(next);
  }

  async function save() {
    setMessage(null);
    const headers = () => ({
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    });
    const profileResponse = await fetch("/api/profile", {
      body: JSON.stringify({
        description,
        displayName,
        externalUrls,
        visibility: profileVisibility,
      }),
      headers: headers(),
      method: "PUT",
    });
    if (!profileResponse.ok) {
      setMessage("プロフィールを保存できませんでした。");
      return;
    }
    const packageResponse = await fetch("/api/profile/point-packages", {
      body: JSON.stringify({ pointPackageIds: packages }),
      headers: headers(),
      method: "PUT",
    });
    if (!packageResponse.ok) {
      setMessage("プロフィールは保存しましたが、Packageの順序を保存できませんでした。");
      return;
    }
    for (const visibility of evaluationVisibilities) {
      const response = await fetch(
        `/api/profile/evaluation-visibilities/${encodeURIComponent(visibility.evaluationCriterionId)}`,
        {
          body: JSON.stringify({
            balanceVisibility: visibility.balanceVisibility,
            evaluationTotalVisibility: visibility.evaluationTotalVisibility,
            exchangeHistoryVisibility: visibility.exchangeHistoryVisibility,
            fixHistoryVisibility: visibility.fixHistoryVisibility,
            transferHistoryVisibility: visibility.transferHistoryVisibility,
          }),
          headers: headers(),
          method: "PUT",
        },
      );
      if (!response.ok) {
        setMessage(
          response.status === 401
            ? "公開範囲を広げるにはGoogleで再認証してください。"
            : "一部の評価軸の公開範囲を保存できませんでした。",
        );
        return;
      }
    }
    setMessage("保存しました。");
  }

  function toggleVisibility(
    index: number,
    field: keyof Omit<EvaluationVisibility, "evaluationCriterionId">,
  ) {
    setEvaluationVisibilities((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: item[field] === "PUBLIC" ? "PRIVATE" : "PUBLIC" }
          : item,
      ),
    );
  }

  return (
    <form
      className="form-card"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2>公開プロフィール</h2>
      <label>
        表示名
        <input
          name="displayName"
          onChange={(event) => setDisplayName(event.target.value)}
          required
          value={displayName}
        />
      </label>
      <label>
        紹介
        <textarea
          name="description"
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          value={description}
        />
      </label>
      <label>
        プロフィール公開
        <select
          onChange={(event) => setProfileVisibility(event.target.value as Visibility)}
          value={profileVisibility}
        >
          <option value="PUBLIC">公開</option>
          <option value="PRIVATE">非公開</option>
        </select>
      </label>
      <fieldset>
        <legend>表示する公式Packageと順序</legend>
        {packages.length === 0 ? (
          <p>表示するPackageはありません。</p>
        ) : (
          packages.map((pointPackage, index) => (
            <div className="ordered-row" key={pointPackage}>
              <span>{pointPackage}</span>
              <button disabled={index === 0} onClick={() => move(index, -1)} type="button">
                上へ
              </button>
              <button
                disabled={index === packages.length - 1}
                onClick={() => move(index, 1)}
                type="button"
              >
                下へ
              </button>
              <button
                onClick={() => setPackages(packages.filter((item) => item !== pointPackage))}
                type="button"
              >
                登録解除
              </button>
            </div>
          ))
        )}
      </fieldset>
      <fieldset>
        <legend>評価軸ごとの公開範囲</legend>
        <p>{visibilityLabels.join(" / ")}</p>
        {evaluationVisibilities.length === 0 ? (
          <p>個別設定のある評価軸はありません。</p>
        ) : (
          evaluationVisibilities.map((visibility, index) => (
            <section className="visibility-axis" key={visibility.evaluationCriterionId}>
              <h3>{visibility.evaluationCriterionId}</h3>
              {(
                [
                  ["残高", "balanceVisibility"],
                  ["評価累計", "evaluationTotalVisibility"],
                  ["FIX履歴", "fixHistoryVisibility"],
                  ["譲渡履歴", "transferHistoryVisibility"],
                  ["交換履歴", "exchangeHistoryVisibility"],
                ] as const
              ).map(([label, field]) => (
                <label className="check-row" key={field}>
                  <input
                    checked={visibility[field] === "PUBLIC"}
                    onChange={() => toggleVisibility(index, field)}
                    type="checkbox"
                  />{" "}
                  {label}
                </label>
              ))}
            </section>
          ))
        )}
      </fieldset>
      <GoogleReauthButton />
      <button disabled={!ready || displayName.length === 0} type="submit">
        {ready ? "変更を保存" : "読み込み中…"}
      </button>
      {message ? (
        <p aria-live="polite" className="status-card">
          {message}
        </p>
      ) : null}
    </form>
  );
}
