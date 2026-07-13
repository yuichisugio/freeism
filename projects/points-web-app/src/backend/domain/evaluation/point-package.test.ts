import { describe, expect, it } from "vite-plus/test";

import { createPointPackageRevision } from "./point-package";

describe("Point Package canonical content", () => {
  it("rejects lone surrogate strings before hashing", async () => {
    await expect(
      createPointPackageRevision({
        pointPackageId: "pkg_invalid_unicode",
        pointPackageRevisionId: "ppr_invalid_unicode_1",
        status: "ACTIVE",
        name: String.fromCharCode(0xd800),
        description: null,
        relatedUrl: null,
        components: [
          {
            evaluationCriterionId: "crit_a",
            evaluationCriterionRevisionId: "ecr_a_1",
            evaluationCriterionName: "A",
            minimumUnitScaled: 1,
            buyNowEnabled: true,
            displayOrder: 0,
            weight: 1,
          },
        ],
      }),
    ).rejects.toThrow("INVALID_POINT_PACKAGE");
  });
});
