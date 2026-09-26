import { urlIdentifierLimitPerUser } from "../../shared/constants";
import { createRandomId } from "../db/id";
import { runBatch, type Database } from "../db/database";
import {
  D1ExternalAccountRepository,
  type ExternalIdentifierRow,
} from "../db/repositories/d1-external-account-repository";
import { isSameIdentifierKey, type IdentifierKey } from "../domain/identity/identifier-key";
import {
  buildOAuthIdentifierKeys,
  type OAuthIdentity,
} from "../domain/identity/oauth-identifier-keys";

/**
 * OAuthのログイン・追加連携・再連携で得た、Providerの検証済みプロフィール。
 */
export type OAuthProfile = {
  identity: OAuthIdentity;
  displayName: string | null;
  email: string | null;
};

/**
 * 同期の入力。
 */
export type SyncOAuthAccountInput = {
  userId: string;
  authAccountId: string;
  profile: OAuthProfile;
};

/**
 * 同期の結果。
 * `affectedUserIds`は公開内容が変わりうるユーザー（本人と識別子の旧所有者）で、プロフィールのpurge対象にする。
 */
export type SyncOAuthAccountResult = {
  externalAccountId: string;
  affectedUserIds: string[];
};

/**
 * 標準`account`の作成・更新後に、外部アカウント行・識別子・`oauth`証明・表示名・メールアドレスを冪等に作成・更新する。
 * 対象の外部アカウント行は、同じ`oauth`証明の行、同じ固有IDを持つ本人の行、同じユーザー名・プロフィールURLを先に登録した本人の行、新規の順に決める。
 * 本人が固有IDを持たない別の行に候補として登録したユーザー名・プロフィールURLは、対象の行へ移す。
 * 同じ`oauth`証明が確認していたユーザー名・プロフィールURLのうち、今回の応答に無い値（改名前の値）は削除して新しい値へ置き換える。
 * 他ユーザーが有効に保持するユーザー名・プロフィールURLは、OAuthの検証済み応答を優先して今回の本人へ移動する。
 * 本人の`url`行が上限に達している場合は、URL識別子だけを追加しない。
 * 書込は1回のD1 batchで確定し、失敗した場合は次回のログインで同じ処理により再構成する。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./sync-oauth-account.worker.test.ts
 */
export async function syncOAuthAccount(
  deps: { db: Database; now: Date },
  input: SyncOAuthAccountInput,
): Promise<SyncOAuthAccountResult> {
  const repository = new D1ExternalAccountRepository(deps.db);
  const keys = buildOAuthIdentifierKeys(input.profile.identity);

  // --------------------------------------------------
  // 現在の保存状態を読む
  // --------------------------------------------------

  const [existingVerification, existingIdentifiers, urlIdentifierCount] = await Promise.all([
    repository.findOAuthVerification(input.authAccountId),
    repository.findIdentifiersByKeys(input.userId, keys),
    repository.countUrlIdentifiers(input.userId),
  ]);
  const previouslyCoveredIdentifiers = existingVerification
    ? await repository.findCoveredIdentifiers(existingVerification.id)
    : [];
  const ownIdentifiers = existingIdentifiers.filter(
    (identifier) => identifier.userId === input.userId,
  );
  const otherActiveIdentifiers = existingIdentifiers.filter(
    (identifier) => identifier.userId !== input.userId && identifier.isActive,
  );

  // 本人がURL登録・リンク証明で先に保存した行は、固有IDを持たない行として区別する。
  const ownAccountIds = [...new Set(ownIdentifiers.map((identifier) => identifier.accountId))];
  const oauthAccountIds = await repository.findAccountIdsWithProviderAccount(
    input.userId,
    ownAccountIds,
  );
  const isRegisteredAccount = (accountId: string) => !oauthAccountIds.includes(accountId);

  // 別のOAuthアカウントの行へ統合しないよう、先に登録した行への合流は固有IDを持たない行に限る。
  const externalAccountId =
    existingVerification?.accountId ??
    ownIdentifiers.find((identifier) => identifier.kind === "provider_account")?.accountId ??
    ownAccountIds.find(isRegisteredAccount) ??
    createRandomId("eac_");
  const verificationId = existingVerification?.id ?? createRandomId("evf_");

  // --------------------------------------------------
  // 識別子ごとの扱いを決める
  // --------------------------------------------------

  // 改名前のユーザー名・プロフィールURLは今回の値で置き換えるため削除し、空いたURLの枠を今回の値に使う。
  const replacedIdentifiers = previouslyCoveredIdentifiers.filter(
    (identifier) =>
      identifier.kind !== "provider_account" &&
      !keys.some((key) => isSameIdentifierKey(identifier, key)),
  );
  const movedOwnIdentifiers: ExternalIdentifierRow[] = [];
  const coveredKeys: (IdentifierKey & { id: string })[] = [];
  const newIdentifiers: (IdentifierKey & { id: string; accountId: string; userId: string })[] = [];
  let urlIdentifierCapacity =
    urlIdentifierLimitPerUser -
    urlIdentifierCount +
    replacedIdentifiers.filter((identifier) => identifier.kind === "url").length;

  for (const key of keys) {
    const ownIdentifier = ownIdentifiers.find((identifier) => isSameIdentifierKey(identifier, key));
    if (ownIdentifier?.accountId === externalAccountId) {
      coveredKeys.push({ ...key, id: ownIdentifier.id });
      continue;
    }

    if (ownIdentifier) {
      // 本人の別の外部アカウント行で有効な識別子と、別のOAuthアカウントの行の識別子は、その行の証明と分けるため今回の証明に含めない。
      if (ownIdentifier.isActive || !isRegisteredAccount(ownIdentifier.accountId)) {
        continue;
      }

      // URL登録の候補は、OAuthの検証済み応答を優先して今回の行へ移す（改名後の値を先に登録した場合）。
      // 移すURLは削除してから追加するため、上限の枠を消費しない。
      movedOwnIdentifiers.push(ownIdentifier);
      if (key.kind === "url") {
        urlIdentifierCapacity += 1;
      }
    }

    if (key.kind === "url") {
      if (urlIdentifierCapacity <= 0) {
        continue;
      }
      urlIdentifierCapacity -= 1;
    }

    const id = createRandomId("eid_");
    newIdentifiers.push({ ...key, id, accountId: externalAccountId, userId: input.userId });
    coveredKeys.push({ ...key, id });
  }

  // OAuth固有IDは移動せず、旧所有者の整合だけを取り直す（標準`account`が全体で一意のため、支えのある保持者は残らない）。
  const transferredIdentifiers = otherActiveIdentifiers.filter(
    (identifier) =>
      identifier.kind !== "provider_account" &&
      coveredKeys.some((coveredKey) => isSameIdentifierKey(identifier, coveredKey)),
  );
  const affectedUserIds = [
    ...new Set([input.userId, ...otherActiveIdentifiers.map((identifier) => identifier.userId)]),
  ];

  // --------------------------------------------------
  // 1回のbatchで確定する
  // --------------------------------------------------

  await runBatch(deps.db, [
    // 候補から有効にする行は、復元したJSONのサービス種別・表示名を採用せず、Providerの応答で置き換える。
    repository.resetUnlinkedAccountProfile(externalAccountId, input.profile.identity.providerId),
    repository.upsertExternalAccount({
      id: externalAccountId,
      userId: input.userId,
      service: input.profile.identity.providerId,
      displayName: input.profile.displayName,
      email: input.profile.email,
    }),
    ...repository.transferIdentifiers([
      ...transferredIdentifiers,
      ...replacedIdentifiers,
      ...movedOwnIdentifiers,
    ]),
    ...repository.insertIdentifiers(newIdentifiers),
    repository.upsertOAuthVerification({
      id: verificationId,
      accountId: externalAccountId,
      authAccountId: input.authAccountId,
      now: deps.now,
    }),
    ...repository.replaceVerificationIdentifiers(
      verificationId,
      coveredKeys.map((coveredKey) => coveredKey.id),
    ),
    ...repository.reconcileIdentifierActivity(affectedUserIds, deps.now),
  ]);

  return { externalAccountId, affectedUserIds };
}
