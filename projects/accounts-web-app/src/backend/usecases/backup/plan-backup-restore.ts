import { urlIdentifierLimitPerUser } from "../../../shared/constants";
import type { Backup } from "../../../shared/schemas/backup-schema";
import type { ProblemIssue } from "../../../shared/schemas/problem-details-schema";
import { createRandomId } from "../../db/id";
import type {
  RestoredClientConsent,
  RestoredExternalAccount,
  RestoredIdentifier,
  RestoredVisibility,
} from "../../db/repositories/d1-backup-repository";
import type { IdentifierKey, IdentifierKind } from "../../domain/identity/identifier-key";
import { serializeIdentifierKey, toIdentifierKey } from "./backup-identifier";

/**
 * JSON復元の照合と書込内容の決定。
 * 形式（`backupSchema`）を満たすバックアップと本人の現在の識別子から、DBを変更する前に入力不備を全件集め、不備が無ければ書込内容を返す。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ./plan-backup-restore.test.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

type BackupAccount = Backup["externalAccounts"][number];

/**
 * 本人の現在の識別子行（候補を含む）。
 */
export type ExistingIdentifier = {
  accountId: string;
  kind: IdentifierKind;
  provider: string;
  issuer: string;
  value: string;
  isActive: boolean;
};

/**
 * 復元の書込内容。
 * `updatedAccounts`は識別子キーで対応付いた既存行、`createdAccounts`は登録候補として作る行。
 */
export type RestorePlan = {
  displayName: string;
  clientConsents: RestoredClientConsent[];
  createdAccounts: RestoredExternalAccount[];
  updatedAccounts: RestoredExternalAccount[];
  identifiers: RestoredIdentifier[];
  visibility: RestoredVisibility[];
};

export type RestorePlanResult = { ok: true; plan: RestorePlan } | { ok: false; issues: ProblemIssue[] };

/**
 * 同じ識別子を持つ、または同じ既存行に当たるJSONアカウントをまとめた1行分。
 */
type AccountGroup = {
  existingAccountId: string | undefined;
  keys: Map<string, IdentifierKey>;
  account: Omit<RestoredExternalAccount, "id" | "importedVerifications">;
  verifications: BackupAccount["metadata"]["verifications"];
  visibility: Map<string, boolean>;
};

// --------------------------------------------------
// 照合
// --------------------------------------------------

/**
 * バックアップを本人の現在の登録へ照合し、復元の書込内容を決める。
 * 同じ識別子を持つJSONアカウントと、同じ既存行に当たるJSONアカウントは1行にまとめ、一般公開・クライアント別の公開選択が食い違えば入力不備にする。
 * 1行にまとめたJSONアカウントが既存の複数行に当たる場合と、復元後の本人の`url`行が上限を超える場合も入力不備にする。
 */
export function planBackupRestore(
  backup: Backup,
  existingIdentifiers: readonly ExistingIdentifier[],
): RestorePlanResult {
  const issues: ProblemIssue[] = [];
  const clientConsents = collectClientConsents(backup, issues);
  const accountKeys = collectAccountKeys(backup, clientConsents, issues);

  const existingAccountIdByKey = new Map(
    existingIdentifiers.map((identifier) => [serializeIdentifierKey(identifier), identifier.accountId]),
  );
  const groups = groupAccounts(backup, accountKeys, existingAccountIdByKey, issues);

  const urlKeys = new Set(
    existingIdentifiers
      .filter((identifier) => identifier.kind === "url")
      .map((identifier) => serializeIdentifierKey(identifier)),
  );
  for (const keys of accountKeys) {
    for (const [serializedKey, key] of keys) {
      if (key.kind === "url") urlKeys.add(serializedKey);
    }
  }
  if (urlKeys.size > urlIdentifierLimitPerUser) {
    issues.push({
      code: "URL_LIMIT_REACHED",
      message: `The number of web URLs after restoring exceeds ${urlIdentifierLimitPerUser}.`,
      path: null,
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  const activeAccountIds = new Set(
    existingIdentifiers.filter((identifier) => identifier.isActive).map((identifier) => identifier.accountId),
  );
  return {
    ok: true,
    plan: buildPlan(backup, [...clientConsents.values()], groups, existingAccountIdByKey, activeAccountIds),
  };
}

/**
 * 情報提供同意をClient IDごとにまとめ、同じClient IDの値の食い違いを入力不備にする。
 */
function collectClientConsents(
  backup: Backup,
  issues: ProblemIssue[],
): Map<string, RestoredClientConsent> {
  const consents = new Map<string, RestoredClientConsent>();
  backup.clientConsents.forEach((consent, index) => {
    const first = consents.get(consent.clientId);
    if (first === undefined) {
      consents.set(consent.clientId, consent);
      return;
    }
    if (first.consented !== consent.consented) {
      issues.push(conflictIssue(["clientConsents", index, "consented"], "client ID"));
    }
    if (first.displayName !== consent.displayName) {
      issues.push(conflictIssue(["clientConsents", index, "displayName"], "client ID"));
    }
  });
  return consents;
}

/**
 * 各JSONアカウントの識別子を、重複を除いた識別子キーにする。
 * 登録できないURLと、`clientConsents`に無いClient IDの公開選択を入力不備にする。
 */
function collectAccountKeys(
  backup: Backup,
  clientConsents: Map<string, RestoredClientConsent>,
  issues: ProblemIssue[],
): Map<string, IdentifierKey>[] {
  return backup.externalAccounts.map((account, accountIndex) => {
    account.clientVisibility.forEach((visibility, visibilityIndex) => {
      if (!clientConsents.has(visibility.clientId)) {
        issues.push({
          code: "INVALID_VALUE",
          message: "The client ID is not included in clientConsents.",
          path: ["externalAccounts", accountIndex, "clientVisibility", visibilityIndex, "clientId"],
        });
      }
    });

    const keys = new Map<string, IdentifierKey>();
    account.metadata.identifiers.forEach((identifier, identifierIndex) => {
      const key = toIdentifierKey(identifier);
      if (key === null) {
        issues.push({
          code: "INVALID_VALUE",
          message: "The URL cannot be registered.",
          path: ["externalAccounts", accountIndex, "metadata", "identifiers", identifierIndex, "url"],
        });
        return;
      }
      keys.set(serializeIdentifierKey(key), key);
    });
    return keys;
  });
}

/**
 * 同じ識別子を持つJSONアカウントと、同じ既存行に当たるJSONアカウントを1行分にまとめる。
 * まとめた行の一般公開・公開選択の食い違いと、既存の複数行への対応を入力不備にする。
 */
function groupAccounts(
  backup: Backup,
  accountKeys: readonly Map<string, IdentifierKey>[],
  existingAccountIdByKey: ReadonlyMap<string, string>,
  issues: ProblemIssue[],
): AccountGroup[] {
  const rootIndexes = findConnectedAccounts(accountKeys, existingAccountIdByKey);
  const groups = new Map<number, AccountGroup>();

  backup.externalAccounts.forEach((account, accountIndex) => {
    const rootIndex = rootIndexes[accountIndex] ?? accountIndex;
    let group = groups.get(rootIndex);
    if (group === undefined) {
      group = {
        existingAccountId: undefined,
        keys: new Map(),
        account: {
          service: account.metadata.service,
          displayName: account.metadata.displayName,
          isPublic: account.isPublic,
        },
        verifications: [],
        visibility: new Map(),
      };
      groups.set(rootIndex, group);
    }

    let matchesMultipleAccounts = false;
    for (const [serializedKey, key] of accountKeys[accountIndex] ?? []) {
      group.keys.set(serializedKey, key);
      const existingAccountId = existingAccountIdByKey.get(serializedKey);
      if (existingAccountId === undefined) continue;
      if (group.existingAccountId !== undefined && group.existingAccountId !== existingAccountId) {
        matchesMultipleAccounts = true;
      }
      group.existingAccountId ??= existingAccountId;
    }
    if (matchesMultipleAccounts) {
      issues.push({
        code: "INVALID_VALUE",
        message: "The identifiers match multiple existing external accounts.",
        path: ["externalAccounts", accountIndex, "metadata", "identifiers"],
      });
    }

    if (account.isPublic !== group.account.isPublic) {
      issues.push(conflictIssue(["externalAccounts", accountIndex, "isPublic"], "external account"));
    }
    account.clientVisibility.forEach((visibility, visibilityIndex) => {
      const current = group.visibility.get(visibility.clientId);
      if (current === undefined) {
        group.visibility.set(visibility.clientId, visibility.isPublic);
      } else if (current !== visibility.isPublic) {
        issues.push(
          conflictIssue(
            ["externalAccounts", accountIndex, "clientVisibility", visibilityIndex, "isPublic"],
            "external account",
          ),
        );
      }
    });

    group.account.service ??= account.metadata.service;
    group.account.displayName ??= account.metadata.displayName;
    group.verifications.push(...account.metadata.verifications);
  });

  return [...groups.values()];
}

/**
 * 識別子キーまたは既存行を共有するJSONアカウントを連結し、各アカウントの代表（連結した中で最小の添字）を返す。
 */
function findConnectedAccounts(
  accountKeys: readonly Map<string, IdentifierKey>[],
  existingAccountIdByKey: ReadonlyMap<string, string>,
): number[] {
  const parents = accountKeys.map((_, index) => index);
  const findRoot = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root] ?? root;
    parents[index] = root;
    return root;
  };

  const firstIndexByLink = new Map<string, number>();
  accountKeys.forEach((keys, accountIndex) => {
    for (const serializedKey of keys.keys()) {
      const existingAccountId = existingAccountIdByKey.get(serializedKey);
      const links = [`key:${serializedKey}`];
      if (existingAccountId !== undefined) links.push(`account:${existingAccountId}`);

      for (const link of links) {
        const firstIndex = firstIndexByLink.get(link);
        if (firstIndex === undefined) {
          firstIndexByLink.set(link, accountIndex);
          continue;
        }
        const [left, right] = [findRoot(firstIndex), findRoot(accountIndex)];
        parents[Math.max(left, right)] = Math.min(left, right);
      }
    }
  });
  return accountKeys.map((_, index) => findRoot(index));
}

/**
 * 同じClient ID・識別子の値の食い違いを表す入力不備。
 */
function conflictIssue(path: (string | number)[], target: "client ID" | "external account"): ProblemIssue {
  return {
    code: "INVALID_VALUE",
    message: `The value conflicts with another entry for the same ${target}.`,
    path,
  };
}

// --------------------------------------------------
// 書込内容
// --------------------------------------------------

/**
 * まとめた行ごとに、既存行の更新か登録候補の作成かを決め、追加する識別子と公開選択を並べる。
 * 本人に有効な証明を持つ既存行は証明・連携日時を維持し、過去の証明情報を保存しない。
 */
function buildPlan(
  backup: Backup,
  clientConsents: RestoredClientConsent[],
  groups: readonly AccountGroup[],
  existingAccountIdByKey: ReadonlyMap<string, string>,
  activeAccountIds: ReadonlySet<string>,
): RestorePlan {
  const plan: RestorePlan = {
    displayName: backup.profile.displayName,
    clientConsents,
    createdAccounts: [],
    updatedAccounts: [],
    identifiers: [],
    visibility: [],
  };

  for (const group of groups) {
    const accountId = group.existingAccountId ?? createRandomId("eac_");
    const keepsCurrentProof =
      group.existingAccountId !== undefined && activeAccountIds.has(group.existingAccountId);
    const account: RestoredExternalAccount = {
      id: accountId,
      ...group.account,
      importedVerifications:
        keepsCurrentProof || group.verifications.length === 0 ? null : group.verifications,
    };
    (group.existingAccountId === undefined ? plan.createdAccounts : plan.updatedAccounts).push(account);

    for (const [serializedKey, key] of group.keys) {
      if (existingAccountIdByKey.has(serializedKey)) continue;
      plan.identifiers.push({ ...key, id: createRandomId("eid_"), accountId });
    }
    for (const [clientId, isPublic] of group.visibility) {
      plan.visibility.push({ accountId, clientId, isPublic });
    }
  }
  return plan;
}
