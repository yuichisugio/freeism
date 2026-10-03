import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";

import { resourceApiBodyMaxBytes } from "../../shared/constants";
import { requestError, resourceApiErrorResponse } from "../resource-api-response";

/**
 * 資源APIの要求bodyを、`Content-Type`・容量の順に検査する。
 * JSONの構文と形式は各ルートが`parseResourceApiBody`で検査する。
 * 容量は`Content-Length`、無い場合は読込中のbyte数で確認する。
 * @see ../../../docs/specification/v0.1/main.ja.md
 * @see ../routes/resource-api-routes.worker.test.ts
 */

/**
 * `application/json`（パラメーター付きを含む）か判定する。
 */
const jsonContentTypePattern = /^application\/json\s*(?:;|$)/i;

const limitBody = bodyLimit({
  maxSize: resourceApiBodyMaxBytes,
  onError: (c) =>
    resourceApiErrorResponse(
      c,
      requestError(
        413,
        "REQUEST_TOO_LARGE",
        `Request body must be at most ${resourceApiBodyMaxBytes} bytes.`,
      ),
    ),
});

export const requireJsonBody = createMiddleware(async (c, next) => {
  const contentType = c.req.header("Content-Type");
  if (contentType === undefined) {
    throw requestError(400, "MISSING_REQUIRED_FIELD", "Content-Type header is required.");
  }
  if (!jsonContentTypePattern.test(contentType)) {
    throw requestError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }

  return limitBody(c, next);
});
