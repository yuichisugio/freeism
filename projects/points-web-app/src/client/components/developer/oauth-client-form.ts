import * as v from "valibot";

import {
  oauthClientSchema,
  type OAuthClientDetail,
} from "../../../shared/schemas/oauth-client-schema";

/** OAuth クライアントの編集欄。公開鍵は JSON として入力する。 */
export type OAuthClientForm = {
  name: string;
  uri: string;
  description: string;
  redirectUris: string[];
  jwksText: string;
};

export type OAuthClientFormErrors = {
  name?: string;
  uri?: string;
  redirectUris: (string | undefined)[];
  jwks?: string;
};

export const emptyOAuthClientForm: OAuthClientForm = {
  name: "",
  uri: "",
  description: "",
  redirectUris: [""],
  jwksText: "",
};

export function toOAuthClientForm(client: OAuthClientDetail): OAuthClientForm {
  return {
    name: client.name,
    uri: client.uri ?? "",
    description: client.description ?? "",
    redirectUris: [...client.redirectUris],
    jwksText: JSON.stringify(client.jwks, null, 2),
  };
}

/** Accounts v0.1 と同じ共有 schema で送信前の入力を確認する。 */
export function parseOAuthClientForm(form: OAuthClientForm): {
  input: v.InferOutput<typeof oauthClientSchema> | null;
  errors: OAuthClientFormErrors;
} {
  const errors: OAuthClientFormErrors = {
    redirectUris: form.redirectUris.map(() => undefined),
  };
  let jwks: unknown;
  if (form.jwksText.trim() === "") {
    errors.jwks = "公開鍵を入力してください。";
  } else {
    try {
      jwks = JSON.parse(form.jwksText);
    } catch {
      errors.jwks = "公開鍵は JWKS 形式の JSON で入力してください。";
    }
  }

  const result = v.safeParse(oauthClientSchema, {
    name: form.name,
    uri: form.uri.trim() === "" ? null : form.uri,
    description: form.description.trim() === "" ? null : form.description,
    redirectUris: form.redirectUris,
    jwks,
  });
  if (result.success) return { input: result.output, errors };

  for (const issue of result.issues) {
    const [field, index] = issue.path?.map((item) => item.key) ?? [];
    if (field === "name") errors.name = "アプリ名を入力してください。";
    if (field === "uri") errors.uri = "紹介 URL は HTTPS で入力してください。";
    if (field === "jwks") errors.jwks ??= "公開鍵を JWKS 形式で入力してください。";
    if (field === "redirectUris" && typeof index === "number") {
      errors.redirectUris[index] =
        form.redirectUris[index]?.trim() === ""
          ? "リダイレクト URL を入力してください。"
          : "HTTPS またはローカル開発用 HTTP の URL を入力してください。";
    }
  }
  if (form.redirectUris.length === 0) {
    errors.redirectUris = ["リダイレクト URL を 1 件以上入力してください。"];
  }
  return { input: null, errors };
}
