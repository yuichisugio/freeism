import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { EmptyState, OperationPage, ProblemState } from "../client/components/operation-page";

type SearchResult = {
  evaluationCriteria: Array<{ evaluationCriterionId: string; name: string }>;
  pointPackages: Array<{ name: string; pointPackageId: string; pointPackageRevisionUrl: string }>;
  profiles: Array<{ canonicalUrl: string; displayName: string; pointsUserId: string }>;
};

export const Route = createFileRoute("/search")({
  component: SearchRoutePage,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
});

function SearchRoutePage() {
  return <SearchPage query={Route.useSearch().q} />;
}

export function SearchPage({ query = "" }: Readonly<{ query?: string }>) {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!query) {
      setResult(null);
      setFailed(false);
      return;
    }
    let active = true;
    void fetch(`/api/v1/search?q=${encodeURIComponent(query)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("SEARCH_FAILED");
        return (await response.json()) as { data: SearchResult };
      })
      .then((body) => {
        if (active) setResult(body.data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [query]);
  const count = result
    ? result.profiles.length + result.evaluationCriteria.length + result.pointPackages.length
    : 0;
  return (
    <OperationPage
      description="公開プロフィール、評価軸、公式Packageを名前またはIDで検索します。"
      eyebrow="Public directory"
      title="Pointsを検索"
    >
      <form action="/search" className="form-card" method="get">
        <label>
          名前またはID <input defaultValue={query} name="q" type="search" />
        </label>
        <button type="submit">検索</button>
      </form>
      {failed ? <ProblemState message="検索できませんでした。" /> : null}
      {result && count > 0 ? (
        <div className="card-grid">
          {result.profiles.map((profile) => (
            <a
              className="status-card"
              href={`/profiles/${encodeURIComponent(profile.pointsUserId)}`}
              key={profile.pointsUserId}
            >
              {profile.displayName}
            </a>
          ))}
          {result.evaluationCriteria.map((criterion) => (
            <a
              className="status-card"
              href={`/api/v1/evaluation-criteria/${encodeURIComponent(criterion.evaluationCriterionId)}`}
              key={criterion.evaluationCriterionId}
            >
              {criterion.name}
            </a>
          ))}
          {result.pointPackages.map((pointPackage) => (
            <a
              className="status-card"
              href={pointPackage.pointPackageRevisionUrl}
              key={pointPackage.pointPackageId}
            >
              {pointPackage.name}
            </a>
          ))}
        </div>
      ) : !failed ? (
        <EmptyState>
          {query ? `「${query}」の公開結果はありません。` : "検索語を入力してください。"}
        </EmptyState>
      ) : null}
    </OperationPage>
  );
}
