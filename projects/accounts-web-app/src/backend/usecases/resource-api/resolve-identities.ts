import * as v from "valibot";

import { toProblemIssue } from "../../../shared/schemas/problem-details-schema";
import {
  resolveIdentifierSchema,
  type ResolveResult,
} from "../../../shared/schemas/resource-api-schema";
import type { Database } from "../../db/database";
import {
  D1ResourceApiRepository,
  type ResolveKey,
  type ResolvedRow,
} from "../../db/repositories/d1-resource-api-repository";
import { buildResolveTarget, type ResolveTarget } from "../../domain/identity/resolve-target";

/**
 * 照合（`QUERY /api/v1/identities/resolve`）。
 * 各入力を個別に検査して照合し、入力順の結果を返す。
 * 不正な入力は`invalid_input`として不備をまとめ、正しい入力の照合を続ける。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../routes/resource-api-routes.worker.test.ts
 */

/**
 * `json_each`の1つのバインド値で読む入力件数。
 * URLの上限（2,048 bytes）の入力でも、D1の1値の上限（2,000,000 bytes）に収まる。
 */
const resolveChunkSize = 500;

/**
 * 照合できる入力1件（入力配列での位置と照合対象）。
 */
type ValidInput = { index: number; target: ResolveTarget };

/**
 * 要求全体の形式を検査済みの識別子の配列を照合する。
 * @returns 入力順の結果と、`invalid_input`を1件以上含むか。
 */
export async function resolveIdentities(
  deps: { db: Database },
  input: { clientId: string; identifiers: readonly unknown[] },
): Promise<{ results: ResolveResult[]; hasInvalidInput: boolean }> {
  const results: ResolveResult[] = [];
  const validInputs: ValidInput[] = [];
  input.identifiers.forEach((identifier, index) => {
    const base = { index, identifier, accountsUserId: null };
    const parsed = v.safeParse(resolveIdentifierSchema, identifier);
    if (!parsed.success) {
      const errors = parsed.issues.map((issue) => {
        const problemIssue = toProblemIssue(issue);
        return { ...problemIssue, path: ["identifiers", index, ...(problemIssue.path ?? [])] };
      });
      results.push({ ...base, status: "invalid_input", errors });
      return;
    }

    const converted = buildResolveTarget(parsed.output);
    if (!converted.ok) {
      const { code, message, path } = converted.error;
      results.push({
        ...base,
        status: "invalid_input",
        errors: [{ code, message, path: ["identifiers", index, ...path] }],
      });
      return;
    }

    validInputs.push({ index, target: converted.target });
    results.push({ ...base, status: "no_match", errors: [] });
  });

  const repository = new D1ResourceApiRepository(deps.db);
  const matchedUserIds = await resolveInChunks(repository, input.clientId, validInputs);
  for (const [index, userId] of matchedUserIds) {
    const result = results[index];
    if (result !== undefined) {
      results[index] = { ...result, status: "matched", accountsUserId: userId };
    }
  }

  return { results, hasInvalidInput: results.some((result) => result.status === "invalid_input") };
}

/**
 * 有効な入力を500件ずつ照合し、入力配列での位置→該当ユーザーIDを返す。
 * 各バインド値の中の位置（`json_each`の`key`）から入力配列の位置へ戻す。
 */
async function resolveInChunks(
  repository: D1ResourceApiRepository,
  clientId: string,
  validInputs: readonly ValidInput[],
): Promise<Map<number, string>> {
  const queries: Promise<{ inputIndexes: number[]; rows: ResolvedRow[] }>[] = [];
  for (let start = 0; start < validInputs.length; start += resolveChunkSize) {
    const chunk = validInputs.slice(start, start + resolveChunkSize);
    const identifierInputs = chunk.flatMap(({ index, target }) =>
      target.kind === "identifier" ? [{ index, key: target.key }] : [],
    );
    const accountsUserInputs = chunk.flatMap(({ index, target }) =>
      target.kind === "accounts_user" ? [{ index, accountsUserId: target.accountsUserId }] : [],
    );
    queries.push(
      repository
        .resolveIdentifierKeys(
          clientId,
          identifierInputs.map((item): ResolveKey => item.key),
        )
        .then((rows) => ({ inputIndexes: identifierInputs.map((item) => item.index), rows })),
      repository
        .resolveAccountsUsers(
          clientId,
          accountsUserInputs.map((item) => item.accountsUserId),
        )
        .then((rows) => ({ inputIndexes: accountsUserInputs.map((item) => item.index), rows })),
    );
  }

  const matched = new Map<number, string>();
  for (const { inputIndexes, rows } of await Promise.all(queries)) {
    for (const row of rows) {
      const index = inputIndexes[row.inputIndex];
      if (index !== undefined) matched.set(index, row.userId);
    }
  }
  return matched;
}
