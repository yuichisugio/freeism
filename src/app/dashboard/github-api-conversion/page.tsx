"use cache";

import type { Metadata } from "next";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { MainTemplate } from "@/components/layout/maintemplate";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export const metadata: Metadata = {
  title: "GitHub API 変換 - Freeism App",
  description: "GitHub API を変換します",
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export default async function GitHubApiConversionPage() {
  cacheLife("max");
  return (
    <MainTemplate title="GitHub API 変換" description="GitHub API を変換します">
      <div>準備中</div>
    </MainTemplate>
  );
}
