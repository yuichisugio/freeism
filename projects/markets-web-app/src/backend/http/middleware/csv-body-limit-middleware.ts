import { bodyLimit } from "hono/body-limit";

import { CSV_MAX_BYTES } from "../../csv/parse-csv";
import { problemDetails } from "../problem-details";

export const csvBodyLimitMiddleware = bodyLimit({
  maxSize: CSV_MAX_BYTES,
  onError: (context) =>
    problemDetails(
      context as Parameters<typeof problemDetails>[0],
      413,
      "REQUEST_BODY_TOO_LARGE",
      "CSV body too large",
    ),
});
