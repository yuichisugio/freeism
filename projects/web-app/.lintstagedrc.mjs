import { existsSync, lstatSync } from "node:fs";

const quote = (file) => JSON.stringify(file);

const formatWithPrettier = (files) => {
  const realFiles = files.filter((file) => existsSync(file) && !lstatSync(file).isSymbolicLink());

  return realFiles.length > 0 ? `prettier --write ${realFiles.map(quote).join(" ")}` : [];
};

export default {
  "*.{ts,tsx}": ["next lint --fix --file"],
  "*.{js,jsx,ts,tsx,cjs,mjs,md,json,lintstagedrc,yml,yaml}": formatWithPrettier,
  "**/*.prisma": ["prisma format"],
};
