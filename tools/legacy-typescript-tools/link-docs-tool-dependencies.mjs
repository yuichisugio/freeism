import { lstat, mkdir, realpath, stat, symlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const toolRoot = path.dirname(fileURLToPath(import.meta.url));

async function pathStatus(target) {
  try {
    return await lstat(target);
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

function assertDestinationIsManaged(destination, managedRoot) {
  const relativeDestination = path.relative(managedRoot, destination);
  if (
    relativeDestination === "" ||
    relativeDestination === ".." ||
    relativeDestination.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeDestination)
  ) {
    throw new Error(
      `Docs tool dependency destination must be below its managed root: ${destination}`,
    );
  }
}

async function assertSafeManagedAncestors(destination, managedRoot) {
  const destinationParent = path.dirname(destination);
  const relativeParent = path.relative(managedRoot, destinationParent);
  const pathSegments = relativeParent === "" ? [] : relativeParent.split(path.sep);

  let ancestor = managedRoot;
  for (const segment of ["", ...pathSegments]) {
    if (segment) ancestor = path.join(ancestor, segment);

    const ancestorStatus = await pathStatus(ancestor);
    if (!ancestorStatus) continue;
    if (ancestorStatus.isSymbolicLink() || !ancestorStatus.isDirectory()) {
      throw new Error(
        `Refusing to create docs tool dependency through an unsafe managed ancestor: ${ancestor}`,
      );
    }
  }
}

export async function linkDocsToolDependency({
  source,
  destination,
  managedRoot,
}) {
  const absoluteSource = path.resolve(source);
  const absoluteDestination = path.resolve(destination);
  const absoluteManagedRoot = path.resolve(managedRoot);

  assertDestinationIsManaged(absoluteDestination, absoluteManagedRoot);

  let sourceStatus;
  try {
    sourceStatus = await stat(absoluteSource);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!sourceStatus?.isDirectory()) {
    throw new Error(
      `Docs tool dependency source is not installed: ${absoluteSource}`,
    );
  }

  await assertSafeManagedAncestors(absoluteDestination, absoluteManagedRoot);

  const destinationStatus = await pathStatus(absoluteDestination);
  if (destinationStatus) {
    if (!destinationStatus.isSymbolicLink()) {
      throw new Error(
        `Refusing to replace existing docs tool dependency path: ${absoluteDestination}`,
      );
    }

    let destinationTarget;
    try {
      destinationTarget = await realpath(absoluteDestination);
    } catch (error) {
      throw new Error(
        `Refusing to replace unresolved docs tool dependency symlink: ${absoluteDestination}`,
        { cause: error },
      );
    }

    const sourceTarget = await realpath(absoluteSource);
    if (destinationTarget !== sourceTarget) {
      throw new Error(
        `Refusing to replace docs tool dependency symlink with a different target: ${absoluteDestination}`,
      );
    }
    return;
  }

  const destinationParent = path.dirname(absoluteDestination);
  await mkdir(destinationParent, { recursive: true });
  const relativeSource = path.relative(destinationParent, absoluteSource);
  await symlink(relativeSource, absoluteDestination, "dir");
}

const source = path.join(toolRoot, "node_modules", "@shikijs", "twoslash");
const destination = path.resolve(
  toolRoot,
  "../../projects/docs-web-app/.blume/node_modules/@shikijs/twoslash",
);
const managedRoot = path.resolve(toolRoot, "../../projects/docs-web-app/.blume");

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await linkDocsToolDependency({ source, destination, managedRoot });
}
