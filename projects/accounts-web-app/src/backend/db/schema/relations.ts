import { relations } from "drizzle-orm";

import {
  clientConsents,
  externalAccounts,
  externalAccountVerifications,
  externalAccountVisibility,
  externalIdentifiers,
  verificationIdentifiers,
} from "./accounts";
import { account, user } from "./auth";

/**
 * 独自6表のDrizzle relations。
 * 生成された標準表のrelationsと合わせてDrizzleへ渡し、Better Authの`advanced.database.joins`と独自の結合取得で使う。
 * 同じ表間の関連はそれぞれ1つのため、`relationName`は付けない。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */

// --------------------------------------------------
// 標準表から独自表への関連
// --------------------------------------------------

export const userAccountsRelations = relations(user, ({ many }) => ({
  externalAccounts: many(externalAccounts),
  clientConsents: many(clientConsents),
}));

export const accountVerificationsRelations = relations(account, ({ many }) => ({
  externalAccountVerifications: many(externalAccountVerifications),
}));

// --------------------------------------------------
// 独自表の関連
// --------------------------------------------------

export const externalAccountsRelations = relations(externalAccounts, ({ one, many }) => ({
  user: one(user, { fields: [externalAccounts.userId], references: [user.id] }),
  externalIdentifiers: many(externalIdentifiers),
  externalAccountVerifications: many(externalAccountVerifications),
  externalAccountVisibility: many(externalAccountVisibility),
}));

export const externalIdentifiersRelations = relations(externalIdentifiers, ({ one, many }) => ({
  externalAccount: one(externalAccounts, {
    fields: [externalIdentifiers.accountId],
    references: [externalAccounts.id],
  }),
  verificationIdentifiers: many(verificationIdentifiers),
}));

export const externalAccountVerificationsRelations = relations(
  externalAccountVerifications,
  ({ one, many }) => ({
    externalAccount: one(externalAccounts, {
      fields: [externalAccountVerifications.accountId],
      references: [externalAccounts.id],
    }),
    authAccount: one(account, {
      fields: [externalAccountVerifications.authAccountId],
      references: [account.id],
    }),
    verificationIdentifiers: many(verificationIdentifiers),
  }),
);

export const verificationIdentifiersRelations = relations(verificationIdentifiers, ({ one }) => ({
  verification: one(externalAccountVerifications, {
    fields: [verificationIdentifiers.verificationId],
    references: [externalAccountVerifications.id],
  }),
  identifier: one(externalIdentifiers, {
    fields: [verificationIdentifiers.identifierId],
    references: [externalIdentifiers.id],
  }),
}));

export const clientConsentsRelations = relations(clientConsents, ({ one }) => ({
  user: one(user, { fields: [clientConsents.userId], references: [user.id] }),
}));

export const externalAccountVisibilityRelations = relations(
  externalAccountVisibility,
  ({ one }) => ({
    externalAccount: one(externalAccounts, {
      fields: [externalAccountVisibility.accountId],
      references: [externalAccounts.id],
    }),
  }),
);
