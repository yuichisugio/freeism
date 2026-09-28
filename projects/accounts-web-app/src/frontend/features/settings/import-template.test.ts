import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { backupSchema } from "../../../shared/schemas/backup-schema";
import { importTemplateText } from "./import-template";

describe("importTemplateText", () => {
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
});
