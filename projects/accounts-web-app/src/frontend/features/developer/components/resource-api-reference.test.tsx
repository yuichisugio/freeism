// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { createResourceApiOpenApiDocument } from "../../../../backend/openapi/resource-api-openapi-document";
import { renderWithProviders } from "../../../test/render-with-providers";
import { resourceApiDocumentSchema, summarizeResourceApiDocument } from "../resource-api-document";
import { resourceApiReferenceMessages } from "../resource-api-reference-messages";
import { ResourceApiReferenceView } from "./resource-api-reference";

const reference = summarizeResourceApiDocument(
  v.parse(resourceApiDocumentSchema, createResourceApiOpenApiDocument("https://accounts.example")),
);

describe("resourceApiReferenceMessages", () => {
  it("OpenAPI文書のすべての操作・応答に、日本語の文言を持つ", () => {
    for (const operation of reference.operations) {
      const text = resourceApiReferenceMessages.ja.operations[operation.operationId];
      expect(text).toBeDefined();
      expect(Object.keys(text?.responses ?? {}).sort()).toEqual(operation.responses.map(({ status }) => status).sort());
    }
  });
});

describe("ResourceApiReferenceView", () => {
  it("日本語では、QUERY操作の見出し・説明・応答を画面側の日本語で表示する", async () => {
    renderWithProviders(<ResourceApiReferenceView state={{ status: "loaded", reference }} />);

    expect(await screen.findByRole("heading", { name: "識別子をAccountsユーザーへ照合する" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "連携先へ提供する外部アカウントを一覧で取得する" })).toBeDefined();
    expect(screen.getByText("QUERY /api/v1/identities/resolve")).toBeDefined();
    expect(screen.getByText("QUERY /api/v1/external-accounts")).toBeDefined();
    expect(screen.getAllByRole("heading", { name: "要求の本文" })).toHaveLength(2);
    expect(screen.getByText(/このクライアントへの情報提供に同意していません/)).toBeDefined();
    expect(screen.getByText("ResolveResponse")).toBeDefined();
    expect(screen.queryByText(/Resolve identifiers|the server failed/)).toBeNull();
  });

  it("英語では、OpenAPI文書の見出しと説明をそのまま表示する", async () => {
    renderWithProviders(<ResourceApiReferenceView state={{ status: "loaded", reference }} />, { language: "en" });

    expect(await screen.findByRole("heading", { name: "Resolve identifiers to Accounts users" })).toBeDefined();
    expect(screen.getAllByRole("heading", { name: "Request body" })).toHaveLength(2);
  });

  it("読み込みの失敗はalertで示す", async () => {
    renderWithProviders(<ResourceApiReferenceView state={{ status: "failed" }} />, {
      language: "en",
    });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not load the Accounts API reference",
    );
  });
});
