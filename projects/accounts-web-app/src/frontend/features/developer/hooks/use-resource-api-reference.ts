import { useEffect, useState } from "react";
import * as v from "valibot";

import {
  resourceApiDocumentPath,
  resourceApiDocumentSchema,
  summarizeResourceApiDocument,
} from "../resource-api-document";
import type { ResourceApiReference } from "../resource-api-document";

/**
 * 資源APIのOpenAPI文書の読み込み状態。
 */
export type ResourceApiReferenceState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "loaded"; reference: ResourceApiReference };

/**
 * 資源APIのOpenAPI文書を読み込み、画面で表示する要約にする。
 * @see ./use-resource-api-reference.test.ts
 */
export function useResourceApiReference(): ResourceApiReferenceState {
  const [state, setState] = useState<ResourceApiReferenceState>({ status: "loading" });

  useEffect(() => {
    let isActive = true;
    void readResourceApiReference().then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, []);

  return state;
}

/**
 * OpenAPI文書を取得し、形を検査して要約する。
 */
async function readResourceApiReference(): Promise<ResourceApiReferenceState> {
  try {
    const response = await fetch(resourceApiDocumentPath);
    if (!response.ok) return { status: "failed" };
    const result = v.safeParse(resourceApiDocumentSchema, await response.json());
    return result.success
      ? { status: "loaded", reference: summarizeResourceApiDocument(result.output) }
      : { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}
