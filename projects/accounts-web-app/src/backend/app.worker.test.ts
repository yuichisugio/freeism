import { env, exports } from "cloudflare:workers";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { problemDetailsSchema } from "../shared/schemas/problem-details-schema";

const origin = env.ACCOUNTS_ORIGIN;

describe("未定義のパス", () => {
  it.each(["/api/unknown", "/api/backup/unknown", "/.well-known/unknown"])(
    "%sは画面へfallbackせず、404のProblem Detailsを返す",
    async (path) => {
      const response = await exports.default.fetch(`${origin}${path}`);

      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).toContain("application/problem+json");
      expect(v.parse(problemDetailsSchema, await response.json())).toMatchObject({
        code: "NOT_FOUND",
      });
    },
  );
});
