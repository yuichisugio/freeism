import { pathToFileURL } from "node:url";

const BUCKET_NAME = "freeism-terraform-state";
const API_BASE = "https://api.cloudflare.com/client/v4";

function requireEnv(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function readJson(response, operation) {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) {
    throw new Error(`Cloudflare ${operation} failed with HTTP ${response.status}`);
  }
  return body.result;
}

export async function runBootstrap({
  mode,
  env = process.env,
  fetchImpl = fetch,
  log = console.log,
}) {
  if (mode !== "check" && mode !== "apply") {
    throw new Error("usage: bootstrap-terraform-state.mjs --check|--apply");
  }

  const accountId = requireEnv(env, "CLOUDFLARE_ACCOUNT_ID");
  const token = requireEnv(env, "CLOUDFLARE_API_TOKEN");
  const bucketsUrl = `${API_BASE}/accounts/${encodeURIComponent(accountId)}/r2/buckets`;
  const bucketUrl = `${bucketsUrl}/${encodeURIComponent(BUCKET_NAME)}`;
  const request = (url, init = {}) =>
    fetchImpl(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: init.body,
    });

  const inspect = async () => {
    const [getResponse, listResponse] = await Promise.all([
      request(bucketUrl),
      request(`${bucketsUrl}?name_contains=${encodeURIComponent(BUCKET_NAME)}&per_page=1000`),
    ]);

    const listResult = await readJson(listResponse, "R2 bucket list");
    const listed = (listResult?.buckets ?? []).filter(
      (bucket) => bucket?.name === BUCKET_NAME,
    );

    if (getResponse.status === 404) {
      if (listed.length !== 0) {
        throw new Error("R2 bucket get/list ownership check disagreed");
      }
      return false;
    }

    const bucket = await readJson(getResponse, "R2 bucket get");
    if (bucket?.name !== BUCKET_NAME || listed.length !== 1) {
      throw new Error("R2 bucket account/name ownership check failed");
    }
    return true;
  };

  const existed = await inspect();
  if (mode === "check") {
    log(`terraform state bucket: ${existed ? "present" : "absent"}`);
    return existed ? "present" : "absent";
  }

  if (existed) {
    log("terraform state bucket: already present; no change");
    return "present";
  }

  const createResponse = await request(bucketsUrl, {
    method: "POST",
    body: JSON.stringify({ name: BUCKET_NAME }),
  });
  const created = await readJson(createResponse, "R2 bucket create");
  if (created?.name !== BUCKET_NAME) {
    throw new Error("R2 bucket create returned an unexpected name");
  }
  if (!(await inspect())) {
    throw new Error("R2 bucket was not visible after create");
  }

  log("terraform state bucket: created and verified");
  return "created";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] === "--check" ? "check" : process.argv[2] === "--apply" ? "apply" : null;
  runBootstrap({ mode }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
