import { lstat, mkdir, realpath, stat, symlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(toolRoot, "node_modules", "@shikijs", "twoslash");
const destination = path.resolve(
  toolRoot,
  "../../projects/docs-web-app/.blume/node_modules/@shikijs/twoslash",
);

async function pathStatus(target) {
  try {
    return await lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

let sourceStatus;
try {
  sourceStatus = await stat(source);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!sourceStatus?.isDirectory()) {
  throw new Error(`Docs tool dependency source is not installed: ${source}`);
}

const destinationStatus = await pathStatus(destination);
if (destinationStatus) {
  if (!destinationStatus.isSymbolicLink()) {
    throw new Error(
      `Refusing to replace existing docs tool dependency path: ${destination}`,
    );
  }

  let destinationTarget;
  try {
    destinationTarget = await realpath(destination);
  } catch (error) {
    throw new Error(
      `Refusing to replace unresolved docs tool dependency symlink: ${destination}`,
      { cause: error },
    );
  }

  const sourceTarget = await realpath(source);
  if (destinationTarget !== sourceTarget) {
    throw new Error(
      `Refusing to replace docs tool dependency symlink with a different target: ${destination}`,
    );
  }
} else {
  await mkdir(path.dirname(destination), { recursive: true });
  const relativeSource = path.relative(path.dirname(destination), source);
  await symlink(relativeSource, destination, "dir");
}
