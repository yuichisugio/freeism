import { and, count, eq, inArray, isNotNull, isNull, not, or, sql } from "drizzle-orm";

import type { IdentifierKey } from "../../domain/identity/identifier-key";
import type { VerificationMethod } from "../../domain/identity/verification-method";
import type { VerificationOutcome } from "../../domain/verification/verification-result";
import type { Database, DatabaseBatchItem } from "../database";
import {
  externalAccounts,
  externalAccountVerifications,
  externalIdentifiers,
  verificationIdentifiers,
} from "../schema";

/**
 * `external_identifiers`の1行。
 */
export type ExternalIdentifierRow = typeof externalIdentifiers.$inferSelect;

/**
 * 値の配列を1つのバインド値にし、`json_each`で展開する副問合せ。
 * @see https://developers.cloudflare.com/d1/sql-api/query-json/#expand-arrays-for-in-queries
 */
function jsonEachValues(values: readonly string[]) {
  return sql`(select value from json_each(${JSON.stringify(values)}))`;
}

/**
 * 外部アカウント・識別子・証明の読取と、D1 batchへ渡す書込文を組み立てる。
 * 書込は文（BatchItem）を返し、ユースケースが1回の`batch()`へ並べて確定する。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export class D1ExternalAccountRepository {
  constructor(private readonly db: Database) {}

  // --------------------------------------------------
  // 読取
  // --------------------------------------------------

  /**
   * 識別子キーに一致する、本人の識別子行（候補を含む）と他ユーザーの有効な識別子行を読む。
   * `is_active = 1`はリテラルで書き、部分UNIQUE索引で検索する。
   */
  async findIdentifiersByKeys(
    userId: string,
    keys: readonly IdentifierKey[],
  ): Promise<ExternalIdentifierRow[]> {
    if (keys.length === 0) {
      return [];
    }

    const keyMatches = keys.map((key) =>
      and(
        eq(externalIdentifiers.kind, key.kind),
        eq(externalIdentifiers.provider, key.provider),
        eq(externalIdentifiers.issuer, key.issuer),
        eq(externalIdentifiers.value, key.value),
      ),
    );
    return this.db
      .select()
      .from(externalIdentifiers)
      .where(
        or(
          ...keyMatches.map((keyMatch) => and(eq(externalIdentifiers.userId, userId), keyMatch)),
          ...keyMatches.map((keyMatch) => and(keyMatch, sql`${externalIdentifiers.isActive} = 1`)),
        ),
      );
  }

  /**
   * 外部アカウント行のうち、`provider_account`の識別子を持つ行のIDを読む。
   */
  async findAccountIdsWithProviderAccount(
    userId: string,
    accountIds: readonly string[],
  ): Promise<string[]> {
    if (accountIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .selectDistinct({ accountId: externalIdentifiers.accountId })
      .from(externalIdentifiers)
      .where(
        and(
          eq(externalIdentifiers.userId, userId),
          eq(externalIdentifiers.kind, "provider_account"),
          inArray(externalIdentifiers.accountId, jsonEachValues(accountIds)),
        ),
      );
    return rows.map((row) => row.accountId);
  }

  /**
   * 標準`account`の行IDに対応する`oauth`証明を読む。
   */
  async findOAuthVerification(
    authAccountId: string,
  ): Promise<{ id: string; accountId: string } | undefined> {
    const [verification] = await this.db
      .select({
        id: externalAccountVerifications.id,
        accountId: externalAccountVerifications.accountId,
      })
      .from(externalAccountVerifications)
      .where(
        and(
          eq(externalAccountVerifications.method, "oauth"),
          eq(externalAccountVerifications.authAccountId, authAccountId),
        ),
      )
      .limit(1);
    return verification;
  }

  /**
   * 本人の`kind='url'`の識別子行数を数える。
   */
  async countUrlIdentifiers(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(externalIdentifiers)
      .where(and(eq(externalIdentifiers.userId, userId), eq(externalIdentifiers.kind, "url")));
    return row?.value ?? 0;
  }

  /**
   * 本人の`kind='url'`の識別子行のうち、正規化hostが一致する行を読む。
   * DNS TXTの証明対象（同じhostで本人が登録済みのURL）に使う。
   */
  async findUrlIdentifiersByHost(userId: string, host: string): Promise<ExternalIdentifierRow[]> {
    return this.db
      .select()
      .from(externalIdentifiers)
      .where(
        and(
          eq(externalIdentifiers.userId, userId),
          eq(externalIdentifiers.host, host),
          eq(externalIdentifiers.kind, "url"),
        ),
      );
  }

  /**
   * 正規化URLのうち、他ユーザーが有効に保持しているURL識別子行を読む。
   * URLの配列は1つのバインド値で渡し、件数によらず1文で読む。
   */
  async findOtherActiveUrlIdentifiers(
    userId: string,
    urls: readonly string[],
  ): Promise<ExternalIdentifierRow[]> {
    if (urls.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(externalIdentifiers)
      .where(
        and(
          eq(externalIdentifiers.kind, "url"),
          eq(externalIdentifiers.provider, ""),
          eq(externalIdentifiers.issuer, ""),
          inArray(externalIdentifiers.value, jsonEachValues(urls)),
          sql`${externalIdentifiers.isActive} = 1`,
          not(eq(externalIdentifiers.userId, userId)),
        ),
      );
  }

  /**
   * 識別子ごとに、その識別子を支える成功証明（`verified_at`あり）の方法を読む。
   */
  async findSupportingMethods(
    identifierIds: readonly string[],
  ): Promise<{ identifierId: string; method: VerificationMethod }[]> {
    if (identifierIds.length === 0) {
      return [];
    }

    return this.db
      .select({
        identifierId: verificationIdentifiers.identifierId,
        method: externalAccountVerifications.method,
      })
      .from(verificationIdentifiers)
      .innerJoin(
        externalAccountVerifications,
        eq(externalAccountVerifications.id, verificationIdentifiers.verificationId),
      )
      .where(
        and(
          inArray(verificationIdentifiers.identifierId, jsonEachValues(identifierIds)),
          isNotNull(externalAccountVerifications.verifiedAt),
        ),
      );
  }

  /**
   * 外部アカウント行ごとに、同じ方法・証拠キーの証明行を読む。
   */
  async findVerifications(
    accountIds: readonly string[],
    method: VerificationMethod,
    evidenceKey: string,
  ): Promise<{ id: string; accountId: string }[]> {
    if (accountIds.length === 0) {
      return [];
    }

    return this.db
      .select({
        id: externalAccountVerifications.id,
        accountId: externalAccountVerifications.accountId,
      })
      .from(externalAccountVerifications)
      .where(
        and(
          inArray(externalAccountVerifications.accountId, jsonEachValues(accountIds)),
          eq(externalAccountVerifications.method, method),
          eq(externalAccountVerifications.evidenceKey, evidenceKey),
        ),
      );
  }

  /**
   * 証明が現在確認している識別子行を読む。
   */
  async findCoveredIdentifiers(verificationId: string): Promise<ExternalIdentifierRow[]> {
    const rows = await this.db
      .select({ identifier: externalIdentifiers })
      .from(verificationIdentifiers)
      .innerJoin(
        externalIdentifiers,
        eq(externalIdentifiers.id, verificationIdentifiers.identifierId),
      )
      .where(eq(verificationIdentifiers.verificationId, verificationId));
    return rows.map((row) => row.identifier);
  }

  /**
   * 本人の外部アカウント行を、`oauth`証明の標準`account.id`とともに読む。
   * 本人の行でなければ`undefined`を返す。
   */
  async findOwnExternalAccount(
    userId: string,
    externalAccountId: string,
  ): Promise<{ id: string; authAccountIds: string[] } | undefined> {
    const externalAccount = await this.db.query.externalAccounts.findFirst({
      columns: { id: true },
      where: and(eq(externalAccounts.id, externalAccountId), eq(externalAccounts.userId, userId)),
      with: {
        externalAccountVerifications: {
          columns: { authAccountId: true },
          where: eq(externalAccountVerifications.method, "oauth"),
        },
      },
    });
    if (externalAccount === undefined) {
      return undefined;
    }

    return {
      id: externalAccount.id,
      authAccountIds: externalAccount.externalAccountVerifications.flatMap((verification) =>
        verification.authAccountId === null ? [] : [verification.authAccountId],
      ),
    };
  }

  /**
   * 本人向け一覧に使う、本人の全外部アカウント行と識別子・証明・公開選択を読む。
   */
  async findOwnExternalAccountDetails(userId: string) {
    return this.db.query.externalAccounts.findMany({
      where: eq(externalAccounts.userId, userId),
      orderBy: [sql`${externalAccounts.linkedAt} is null`, externalAccounts.linkedAt],
      with: {
        externalIdentifiers: true,
        externalAccountVerifications: {
          with: { verificationIdentifiers: { columns: { identifierId: true } } },
        },
        externalAccountVisibility: true,
      },
    });
  }

  // --------------------------------------------------
  // 書込文
  // --------------------------------------------------

  /**
   * 外部アカウント行を作成し、既存行なら取得した表示名・メールアドレスで更新する。
   * 取得できなかった値は既存の値を維持し、公開選択は新規作成時の既定（OFF）から変更しない。
   */
  upsertExternalAccount(input: {
    id: string;
    userId: string;
    service: string | null;
    displayName: string | null;
    email: string | null;
  }): DatabaseBatchItem {
    return this.db
      .insert(externalAccounts)
      .values(input)
      .onConflictDoUpdate({
        target: externalAccounts.id,
        set: {
          service: sql`excluded.service`,
          displayName: sql`coalesce(excluded.display_name, ${externalAccounts.displayName})`,
          email: sql`coalesce(excluded.email, ${externalAccounts.email})`,
        },
      });
  }

  /**
   * 候補（`is_active=0`）として識別子行を追加する。
   * 有効化は証明との関連を作った後の`reconcileIdentifierActivity`で行う。
   */
  insertIdentifiers(
    identifiers: readonly (IdentifierKey & { id: string; accountId: string; userId: string })[],
  ): DatabaseBatchItem[] {
    if (identifiers.length === 0) {
      return [];
    }

    return [this.db.insert(externalIdentifiers).values([...identifiers])];
  }

  /**
   * 成功した`oauth`証明行を作成・更新する。
   * `evidence_key`と`auth_account_id`には標準`account`の行IDを保存する。
   */
  upsertOAuthVerification(input: {
    id: string;
    accountId: string;
    authAccountId: string;
    now: Date;
  }): DatabaseBatchItem {
    return this.db
      .insert(externalAccountVerifications)
      .values({
        id: input.id,
        accountId: input.accountId,
        method: "oauth",
        evidenceKey: input.authAccountId,
        authAccountId: input.authAccountId,
        verifiedAt: input.now,
        checkedAt: input.now,
        result: "verified",
      })
      .onConflictDoUpdate({
        target: [
          externalAccountVerifications.accountId,
          externalAccountVerifications.method,
          externalAccountVerifications.evidenceKey,
        ],
        set: {
          authAccountId: input.authAccountId,
          verifiedAt: input.now,
          checkedAt: input.now,
          result: "verified",
          failureCode: null,
        },
      });
  }

  /**
   * リンク証明・DNS TXTの試行結果を、`(account_id, method, evidence_key)`の証明行へ記録する。
   * 常に`checked_at`・`result`・`failure_code`を今回の試行で更新し、成功時だけ`verified_at`・`evidence_url`を更新する。
   * 失敗・判断不能の試行では、過去に成功した`verified_at`と対象の関連を変更しない。
   */
  upsertVerificationAttempt(input: {
    id: string;
    accountId: string;
    method: Exclude<VerificationMethod, "oauth">;
    evidenceKey: string;
    outcome: VerificationOutcome;
    evidenceUrl: string | null;
    now: Date;
  }): DatabaseBatchItem {
    const attempt = {
      checkedAt: input.now,
      result: input.outcome.result,
      failureCode: input.outcome.failureCode,
    };
    const success =
      input.outcome.result === "verified"
        ? { verifiedAt: input.now, evidenceUrl: input.evidenceUrl }
        : {};

    return this.db
      .insert(externalAccountVerifications)
      .values({
        id: input.id,
        accountId: input.accountId,
        method: input.method,
        evidenceKey: input.evidenceKey,
        ...attempt,
        ...success,
      })
      .onConflictDoUpdate({
        target: [
          externalAccountVerifications.accountId,
          externalAccountVerifications.method,
          externalAccountVerifications.evidenceKey,
        ],
        set: { ...attempt, ...success },
      });
  }

  /**
   * 外部アカウント行を削除する。
   * 識別子・証明・対象関連・公開設定はCASCADEで削除される。
   */
  deleteExternalAccount(userId: string, externalAccountId: string): DatabaseBatchItem {
    return this.db
      .delete(externalAccounts)
      .where(and(eq(externalAccounts.id, externalAccountId), eq(externalAccounts.userId, userId)));
  }

  /**
   * 証明が確認した識別子の関連を、今回の集合で置き換える。
   */
  replaceVerificationIdentifiers(
    verificationId: string,
    identifierIds: readonly string[],
  ): DatabaseBatchItem[] {
    return [
      this.db
        .delete(verificationIdentifiers)
        .where(eq(verificationIdentifiers.verificationId, verificationId)),
      this.db
        .insert(verificationIdentifiers)
        .select(
          sql`select ${verificationId}, value from json_each(${JSON.stringify(identifierIds)})`,
        ),
    ];
  }

  /**
   * 識別子行を削除し、その識別子だけを対象としていた証明と、識別子が無くなった外部アカウント行（公開設定はCASCADE）も削除する。
   * Web識別子の移動で旧所有者から外す識別子と、OAuthで置き換えた旧ユーザー名・旧プロフィールURLに使う。
   * 行の他の識別子と、それを支える証明は残す。
   */
  transferIdentifiers(
    identifiers: readonly Pick<ExternalIdentifierRow, "id" | "accountId">[],
  ): DatabaseBatchItem[] {
    if (identifiers.length === 0) {
      return [];
    }

    const identifierIds = identifiers.map((identifier) => identifier.id);
    const accountIds = [...new Set(identifiers.map((identifier) => identifier.accountId))];

    return [
      this.db
        .delete(externalAccountVerifications)
        .where(
          and(
            sql`exists (select 1 from ${verificationIdentifiers} where ${verificationIdentifiers.verificationId} = ${externalAccountVerifications.id} and ${verificationIdentifiers.identifierId} in ${jsonEachValues(identifierIds)})`,
            sql`not exists (select 1 from ${verificationIdentifiers} where ${verificationIdentifiers.verificationId} = ${externalAccountVerifications.id} and ${verificationIdentifiers.identifierId} not in ${jsonEachValues(identifierIds)})`,
          ),
        ),
      this.db
        .delete(externalIdentifiers)
        .where(inArray(externalIdentifiers.id, jsonEachValues(identifierIds))),
      this.db
        .delete(externalAccounts)
        .where(
          and(
            inArray(externalAccounts.id, jsonEachValues(accountIds)),
            sql`not exists (select 1 from ${externalIdentifiers} where ${externalIdentifiers.accountId} = ${externalAccounts.id} and ${externalIdentifiers.userId} = ${externalAccounts.userId})`,
          ),
        ),
    ];
  }

  /**
   * 識別子の有効性を、成功証明との関連に合わせる。
   * 支えを失った有効識別子を候補にし、支えのある候補を有効にしてから、初めて有効になった外部アカウントの`linked_at`を設定する。
   * 部分UNIQUEに違反する場合はbatch全体が失敗する。
   */
  reconcileIdentifierActivity(userIds: readonly string[], now: Date): DatabaseBatchItem[] {
    // 索引で検索できるよう、関連と成功証明の有無を相関副問合せで確認する。
    const hasSuccessfulProof = sql`exists (select 1 from ${verificationIdentifiers} inner join ${externalAccountVerifications} on ${externalAccountVerifications.id} = ${verificationIdentifiers.verificationId} where ${verificationIdentifiers.identifierId} = ${externalIdentifiers.id} and ${externalAccountVerifications.verifiedAt} is not null)`;
    const targetUsers = inArray(externalIdentifiers.userId, jsonEachValues(userIds));

    return [
      this.db
        .update(externalIdentifiers)
        .set({ isActive: false })
        .where(and(targetUsers, eq(externalIdentifiers.isActive, true), not(hasSuccessfulProof))),
      this.db
        .update(externalIdentifiers)
        .set({ isActive: true })
        .where(and(targetUsers, eq(externalIdentifiers.isActive, false), hasSuccessfulProof)),
      this.db
        .update(externalAccounts)
        .set({ linkedAt: now })
        .where(
          and(
            isNull(externalAccounts.linkedAt),
            inArray(externalAccounts.userId, jsonEachValues(userIds)),
            sql`exists (select 1 from ${externalIdentifiers} where ${externalIdentifiers.userId} = ${externalAccounts.userId} and ${externalIdentifiers.accountId} = ${externalAccounts.id} and ${externalIdentifiers.isActive} = 1)`,
          ),
        ),
    ];
  }
}
