import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { backupSchema } from "../../../shared/schemas/backup-schema";
import { buildImportTemplateText } from "./import-template";

describe("buildImportTemplateText", () => {
  const importTemplateText = buildImportTemplateText("仮ユーザー");

  it("出力JSONと同じ形式（schemaVersion: 1）として取り込める", () => {
    expect(v.safeParse(backupSchema, JSON.parse(importTemplateText)).success).toBe(true);
  });

  it("URL識別子だけを持つ未検証の外部アカウント1件の最小例にする", () => {
    const template = v.parse(backupSchema, JSON.parse(importTemplateText));

    expect(template.clientConsents).toEqual([]);
    expect(template.externalAccounts).toHaveLength(1);
    expect(template.externalAccounts[0]?.metadata).toMatchObject({
      identifiers: [{ type: "url", url: expect.stringMatching(/^https:\/\//) as string }],
      verificationStatus: "unverified",
      verifications: [],
    });
  });

  it("profile.displayName に渡した表示名を入れる", () => {
    const template = v.parse(backupSchema, JSON.parse(buildImportTemplateText("山田 花子")));

    expect(template.profile.displayName).toBe("山田 花子");
  });
});
