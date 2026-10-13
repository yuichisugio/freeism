import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { previewOrigin } from "./preview-generated";
import { smokeAt } from "./smoke";

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const origin = previewOrigin(Number(process.argv[2]), process.argv[3] ?? "");
  await smokeAt(origin, "staging");
}
