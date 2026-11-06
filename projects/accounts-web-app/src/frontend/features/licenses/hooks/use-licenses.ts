import { useEffect, useState } from "react";
import * as v from "valibot";

import { dependencyLicensesSchema } from "../license-schema";
import type { DependencyLicense } from "../license-schema";

/**
 * ビルド時に出力するライセンス一覧のパス。
 * `vite.config.ts`のclient環境の`build.license.fileName`と合わせる。
 */
export const dependencyLicensesPath = "/dependency-open-source-licenses.json";

/**
 * ライセンス一覧の読み込み状態。
 * 開発サーバーではファイルが無いため`notBuilt`になる。
 */
export type LicensesState =
  | { status: "loading" }
  | { status: "notBuilt" }
  | { status: "failed" }
  | { status: "loaded"; licenses: DependencyLicense[] };

/**
 * 依存パッケージのOSSライセンス一覧を読み込む。
 * @see ./use-licenses.test.ts
 */
export function useLicenses(): LicensesState {
  const [state, setState] = useState<LicensesState>({ status: "loading" });

  useEffect(() => {
    let isActive = true;
    void readLicenses().then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, []);

  return state;
}

/**
 * ライセンス一覧を取得し、形を検査する。
 */
async function readLicenses(): Promise<LicensesState> {
  try {
    const response = await fetch(dependencyLicensesPath);
    if (response.status === 404) return { status: "notBuilt" };
    if (!response.ok) return { status: "failed" };
    const result = v.safeParse(dependencyLicensesSchema, await response.json());
    return result.success ? { status: "loaded", licenses: result.output } : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}
