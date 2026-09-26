import type { VerifyUrlResult } from "../../shared/schemas/external-url-schema";
import { isUniqueConstraintError, runBatch, type Database } from "../db/database";
import { createRandomId } from "../db/id";
import {
  D1ExternalAccountRepository,
  type ExternalIdentifierRow,
} from "../db/repositories/d1-external-account-repository";
import { decideIdentifierTransfer } from "../domain/identity/decide-identifier-transfer";
import { isSameIdentifierKey, type IdentifierKey } from "../domain/identity/identifier-key";
import { buildUrlRuleIdentifierKeys } from "../domain/identity/url-identifier-keys";
import { classifyServiceUrl } from "../domain/verification/classify-service-url";
import {
  failVerification,
  type VerificationOutcome,
} from "../domain/verification/verification-result";
import type { PageFetcher } from "../infrastructure/verification/safe-page-fetcher";
import {
  type DnsTxtLookupOptions,
  verifyDnsTxtEvidence,
} from "../infrastructure/verification/verify-dns-txt-evidence";
import { verifyLinkEvidence } from "../infrastructure/verification/verify-link-evidence";
import { auditLog } from "../logging/audit-log";
import { ProblemError } from "../problem-details";
import {
  assertUrlCapacity,
  buildRegistrationIdentifiers,
  readUrlRegistration,
  type UrlRegistration,
} from "./url-registration";

/**
 * 「保存して検証する」。
 * @see ../../../docs/specification/v0.1/verify-url.ja.md
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ./verify-url.worker.test.ts
 */

// --------------------------------------------------
// 型
// --------------------------------------------------

/**
 * `verifyUrl`の依存。
 * 外部ページの取得・DNS TXTの照会・レート制限は、テストで代替実装へ差し替える。
 */
export type VerifyUrlDeps = {
  db: Database;
  now: Date;
  /** 期待する公開プロフィールURLのorigin（環境設定の公開origin）。 */
  accountsOrigin: string;
  pageFetcher: PageFetcher;
  /** AccountsユーザーIDをキーにする、検証要求のレート制限。 */
  rateLimiter: RateLimit;
  dnsTxtLookup?: DnsTxtLookupOptions;
};

/**
 * `verifyUrl`の結果。
 * `affectedUserIds`は公開内容が変わりうるユーザー（本人と識別子の旧所有者）で、プロフィールのpurge対象にする。
 * 未登録URLの検証が成立せず何も保存しなかった場合、`externalAccountId`は`null`、`affectedUserIds`は空にする。
 */
export type VerifyUrlOutput = VerifyUrlResult & { affectedUserIds: string[] };

/**
 * 成功した証明を適用する識別子1件。
 * `identifierId`は本人の既存の識別子行のIDで、未登録なら`undefined`。
 */
type ProofTarget = { accountId: string; key: IdentifierKey; identifierId: string | undefined };

/**
 * 成功した証明の適用範囲。
 * `transferred`は、今回の本人へ移動するために旧所有者から外す有効な識別子行。
 */
type ProofPlan = { targets: ProofTarget[]; transferred: ExternalIdentifierRow[] };

// --------------------------------------------------
// ユースケース
// --------------------------------------------------

/**
 * 入力URLを検査し、公開ページのリンク証明、不成立なら同じ要求でDNS TXTを確かめて結果を保存する。
 * 期待する公開プロフィールURLは、セッション本人のIDと環境設定の公開originから決める。
 * ページ取得・DNS照会はDB書込の前に行い、書込は1回のD1 batchで確定する。
 * 成功時だけ入力URLを登録し、証明と今回確認した識別子の関連を置き換える。
 * 登録済みURLの失敗・判断不能では直近の試行結果だけを更新し、未登録URLでは何も保存せず方法別の結果を返す。
 * リンク証明単独では、旧所有者の`oauth`・`dns_txt`が支える識別子を移動せず`HELD_BY_STRONGER_PROOF`とする。
 * @throws {ProblemError} 入力URLの不備（400）、未登録URLでのURL登録数の上限到達（409、外部通信の前）、レート制限の超過（429）、所有者の更新の競合（409）。
 */
export async function verifyUrl(
  deps: VerifyUrlDeps,
  input: { userId: string; url: string },
): Promise<VerifyUrlOutput> {
  const startedAt = Date.now();
  const { userId } = input;
  const repository = new D1ExternalAccountRepository(deps.db);
  const registration = await readUrlRegistration(repository, userId, input.url);
  // 上限に達した本人の未登録URLは、証明の成否によらず登録できないため、外部通信とレート制限の前に拒否する。
  if (registration.inputIdentifier === undefined) {
    assertUrlCapacity(registration);
  }

  const { success } = await deps.rateLimiter.limit({ key: userId });
  if (!success) {
    throw new ProblemError(429, "RATE_LIMITED");
  }
  auditLog({ event: "url_verification_started", outcome: "success" });

  // --------------------------------------------------
  // 公開ページとDNS TXTで証拠を確かめる
  // --------------------------------------------------

  const target = { accountsOrigin: deps.accountsOrigin, accountsUserId: userId };
  const linkEvidence = await verifyLinkEvidence(registration.url, target, deps.pageFetcher);
  const finalUrl = linkEvidence.finalUrl ?? registration.url;
  const linkPlan =
    linkEvidence.result === "verified"
      ? await planLinkProof(repository, userId, registration, finalUrl)
      : null;
  const linkOutcome: VerificationOutcome =
    linkEvidence.result === "verified" && linkPlan === null
      ? failVerification("HELD_BY_STRONGER_PROOF")
      : linkEvidence;

  const dnsOutcome =
    linkPlan === null
      ? await verifyDnsTxtEvidence(registration.host, target, deps.dnsTxtLookup)
      : null;
  const dnsPlan =
    dnsOutcome?.result === "verified"
      ? await planDnsProof(repository, userId, registration)
      : null;
  const proofPlan = linkPlan ?? dnsPlan;
  const attempts: Pick<VerifyUrlResult, "link" | "dns"> = {
    // 証拠を確認したページは、リンク証明が成功した場合だけ示す（DBも成功時だけ保存する）。
    link: {
      result: linkOutcome.result,
      failureCode: linkOutcome.failureCode,
      evidenceUrl: linkOutcome.result === "verified" ? linkEvidence.finalUrl : null,
    },
    dns: dnsOutcome === null ? null : { result: dnsOutcome.result, failureCode: dnsOutcome.failureCode },
  };

  // --------------------------------------------------
  // 未登録URLは証明が成立した場合だけ登録する
  // --------------------------------------------------

  if (registration.inputIdentifier === undefined && proofPlan === null) {
    logVerificationAttempts(linkOutcome, dnsOutcome, Date.now() - startedAt);
    return { externalAccountId: null, status: "unverified", ...attempts, affectedUserIds: [] };
  }

  // --------------------------------------------------
  // 書込文を組み立てる
  // --------------------------------------------------

  const accountId = registration.externalAccountId;
  const newIdentifiers = buildRegistrationIdentifiers(registration, userId);
  const resolveIdentifierId = (proofTarget: ProofTarget): string => {
    const identifierId =
      proofTarget.identifierId ??
      newIdentifiers.find((identifier) => isSameIdentifierKey(identifier, proofTarget.key))?.id;
    if (identifierId !== undefined) {
      return identifierId;
    }

    const identifier = {
      ...proofTarget.key,
      id: createRandomId("eid_"),
      accountId: proofTarget.accountId,
      userId,
    };
    newIdentifiers.push(identifier);
    return identifier.id;
  };
  const linkCoveredIds = linkPlan?.targets.map(resolveIdentifierId) ?? [];
  const dnsCoveredIds = groupByAccount(dnsPlan?.targets ?? [], resolveIdentifierId);
  // DNS TXTの失敗は入力URLの外部アカウント行へ記録し、成功は対象URLを含む各外部アカウント行へ記録する。
  const dnsAccountIds = dnsPlan === null ? [accountId] : [...dnsCoveredIds.keys()];

  const [linkVerifications, dnsVerifications] = await Promise.all([
    repository.findVerifications([accountId], "bidirectional_link", registration.url),
    dnsOutcome === null
      ? []
      : repository.findVerifications(dnsAccountIds, "dns_txt", registration.host),
  ]);
  const linkVerificationId = linkVerifications[0]?.id ?? createRandomId("evf_");
  const provenService = linkPlan === null ? null : readProfileProvider(finalUrl);
  // 成功した証明で有効にする行ごとの、URLから判定したサービス種別。
  const judgedServices = new Map<string, string | null>(
    linkPlan === null
      ? (dnsPlan?.targets ?? []).map((proofTarget) => [
          proofTarget.accountId,
          readProfileProvider(proofTarget.key.value),
        ])
      : [[accountId, provenService ?? registration.service]],
  );
  const affectedUserIds = [
    ...new Set([userId, ...(proofPlan?.transferred ?? []).map((identifier) => identifier.userId)]),
  ];

  // --------------------------------------------------
  // 1回のbatchで確定する
  // --------------------------------------------------

  const statements = [
    ...(registration.inputIdentifier === undefined || provenService !== null
      ? [
          repository.upsertExternalAccount({
            id: accountId,
            userId,
            service: provenService ?? registration.service,
            displayName: null,
            email: null,
          }),
        ]
      : []),
    // 候補から有効にする行は、復元したJSONのサービス種別・表示名を採用せず判定し直す。
    ...[...judgedServices].map(([judgedAccountId, service]) =>
      repository.resetUnlinkedAccountProfile(judgedAccountId, service),
    ),
    ...repository.transferIdentifiers(proofPlan?.transferred ?? []),
    ...repository.insertIdentifiers(newIdentifiers),
    repository.upsertVerificationAttempt({
      id: linkVerificationId,
      accountId,
      method: "bidirectional_link",
      evidenceKey: registration.url,
      outcome: linkOutcome,
      evidenceUrl: linkEvidence.finalUrl,
      now: deps.now,
    }),
    ...(linkPlan === null
      ? []
      : repository.replaceVerificationIdentifiers(linkVerificationId, linkCoveredIds)),
    ...(dnsOutcome === null
      ? []
      : dnsAccountIds.flatMap((dnsAccountId) => {
          const verificationId =
            dnsVerifications.find((verification) => verification.accountId === dnsAccountId)
              ?.id ?? createRandomId("evf_");
          return [
            repository.upsertVerificationAttempt({
              id: verificationId,
              accountId: dnsAccountId,
              method: "dns_txt",
              evidenceKey: registration.host,
              outcome: dnsOutcome,
              evidenceUrl: null,
              now: deps.now,
            }),
            ...(dnsPlan === null
              ? []
              : repository.replaceVerificationIdentifiers(
                  verificationId,
                  dnsCoveredIds.get(dnsAccountId) ?? [],
                )),
          ];
        })),
    ...repository.reconcileIdentifierActivity(affectedUserIds, deps.now),
  ];
  await runBatch(deps.db, statements).catch((error: unknown) => {
    if (isUniqueConstraintError(error)) {
      throw new ProblemError(409, "OWNERSHIP_CONFLICT");
    }
    throw error;
  });

  logVerificationAttempts(linkOutcome, dnsOutcome, Date.now() - startedAt);
  const transferredCount = proofPlan?.transferred.length ?? 0;
  if (transferredCount > 0) {
    auditLog({
      event: "identifier_transfer",
      outcome: "success",
      method: linkPlan === null ? "dns_txt" : "bidirectional_link",
      count: transferredCount,
    });
  }

  return {
    externalAccountId: accountId,
    status:
      proofPlan !== null || registration.inputIdentifier?.isActive === true
        ? "verified"
        : "unverified",
    ...attempts,
    affectedUserIds,
  };
}

/**
 * 試行した方法ごとの結果を監査ログへ記録する。
 */
function logVerificationAttempts(
  linkOutcome: VerificationOutcome,
  dnsOutcome: VerificationOutcome | null,
  durationMs: number,
): void {
  for (const [method, outcome] of [
    ["bidirectional_link", linkOutcome],
    ["dns_txt", dnsOutcome],
  ] as const) {
    if (outcome !== null) {
      auditLog({
        event: "url_verification",
        outcome: outcome.result === "verified" ? "success" : "failure",
        errorCategory: outcome.failureCode ?? undefined,
        method,
        durationMs,
      });
    }
  }
}

// --------------------------------------------------
// 証明の適用範囲
// --------------------------------------------------

/**
 * リンク証明の適用範囲を決める。
 * 対象は入力URLと、最終取得URLが個別対応サービスのプロフィールURLならURL規則で得たユーザー名・プロフィールURLとする。
 * 本人の別の外部アカウント行にある識別子は、その行の証明と分けるため対象にしない。
 * 旧所有者の`oauth`・`dns_txt`が支える識別子が1件でもあれば、所有変更をせず`null`を返す。
 */
async function planLinkProof(
  repository: D1ExternalAccountRepository,
  userId: string,
  registration: UrlRegistration,
  finalUrl: string,
): Promise<ProofPlan | null> {
  const keys = [registration.urlKey, ...buildUrlRuleIdentifierKeys(finalUrl)].filter(
    (key, index, allKeys) =>
      allKeys.findIndex((other) => isSameIdentifierKey(other, key)) === index,
  );
  const identifiers = await repository.findIdentifiersByKeys(userId, keys);

  // 入力URL以外のURLは、本人の`url`行の上限に空きがある範囲で追加する。
  let remainingUrlCapacity = registration.remainingUrlCapacity;
  const targets = keys.flatMap((key): ProofTarget[] => {
    const own = identifiers.find(
      (identifier) => identifier.userId === userId && isSameIdentifierKey(identifier, key),
    );
    if (own !== undefined) {
      return own.accountId === registration.externalAccountId
        ? [{ accountId: own.accountId, key, identifierId: own.id }]
        : [];
    }
    if (key.kind === "url" && !isSameIdentifierKey(key, registration.urlKey)) {
      if (remainingUrlCapacity <= 0) {
        return [];
      }
      remainingUrlCapacity -= 1;
    }
    return [{ accountId: registration.externalAccountId, key, identifierId: undefined }];
  });

  const transferred = identifiers.filter(
    (identifier) =>
      identifier.userId !== userId &&
      targets.some((proofTarget) => isSameIdentifierKey(identifier, proofTarget.key)),
  );
  const supports = await repository.findSupportingMethods(
    transferred.map((identifier) => identifier.id),
  );
  const isBlocked = transferred.some(
    (identifier) =>
      decideIdentifierTransfer(
        "bidirectional_link",
        supports
          .filter((support) => support.identifierId === identifier.id)
          .map((support) => support.method),
      ) === "blocked",
  );

  return isBlocked ? null : { targets, transferred };
}

/**
 * DNS TXTの適用範囲を決める。
 * 対象は入力URLと、同じhostで本人が登録済みのURLとし、各URLは登録済みの外部アカウント行のまま証明する。
 * DNS TXTの成功は、他ユーザーが有効に保持する対象URLを証明方法によらず移動する。
 */
async function planDnsProof(
  repository: D1ExternalAccountRepository,
  userId: string,
  registration: UrlRegistration,
): Promise<ProofPlan> {
  const registeredIdentifiers = await repository.findUrlIdentifiersByHost(
    userId,
    registration.host,
  );
  const targets: ProofTarget[] = registeredIdentifiers.map((identifier) => ({
    accountId: identifier.accountId,
    key: {
      kind: identifier.kind,
      provider: identifier.provider,
      issuer: "",
      value: identifier.value,
      host: identifier.host,
    },
    identifierId: identifier.id,
  }));
  if (registration.inputIdentifier === undefined) {
    targets.push({
      accountId: registration.externalAccountId,
      key: registration.urlKey,
      identifierId: undefined,
    });
  }

  const transferred = await repository.findOtherActiveUrlIdentifiers(
    userId,
    targets.map((proofTarget) => proofTarget.key.value),
  );
  return { targets, transferred };
}

/**
 * 証明の対象を外部アカウント行ごとの識別子IDへまとめる。
 */
function groupByAccount(
  targets: readonly ProofTarget[],
  resolveIdentifierId: (proofTarget: ProofTarget) => string,
): Map<string, string[]> {
  const identifierIdsByAccount = new Map<string, string[]>();
  for (const proofTarget of targets) {
    const identifierIds = identifierIdsByAccount.get(proofTarget.accountId) ?? [];
    identifierIds.push(resolveIdentifierId(proofTarget));
    identifierIdsByAccount.set(proofTarget.accountId, identifierIds);
  }
  return identifierIdsByAccount;
}

/**
 * URLが個別対応サービスのプロフィールURLなら、そのProvider識別子を返す。
 */
function readProfileProvider(normalizedUrl: string): string | null {
  const classification = classifyServiceUrl(normalizedUrl);
  return classification.urlType === "profile" ? classification.provider : null;
}
