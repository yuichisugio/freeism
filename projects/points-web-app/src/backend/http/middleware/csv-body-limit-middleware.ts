import { bodyLimit } from "hono/body-limit";

import { CSV_MAX_BYTES } from "../../csv/csv-input";
import { problem } from "../problem";

export const csvBodyLimitMiddleware = bodyLimit({
  maxSize: CSV_MAX_BYTES,
  onError: (context) =>
    problem(
      context as Parameters<typeof problem>[0],
      413,
      "CSV_FILE_TOO_LARGE",
      "CSV file too large",
    ),
});
