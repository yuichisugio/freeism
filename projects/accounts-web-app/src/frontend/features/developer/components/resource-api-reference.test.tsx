// @vitest-environment happy-dom
import { screen } from "@testing-library/react";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { createResourceApiOpenApiDocument } from "../../../../backend/openapi/resource-api-openapi-document";
import { renderWithProviders } from "../../../test/render-with-providers";
import { resourceApiDocumentSchema, summarizeResourceApiDocument } from "../resource-api-document";
import { ResourceApiReferenceView } from "./resource-api-reference";

const reference = summarizeResourceApiDocument(
  v.parse(resourceApiDocumentSchema, createResourceApiOpenApiDocument("https://accounts.example")),
);

describe("ResourceApiReferenceView", () => {
  it("QUERY操作の見出しと経路、要求と応答を表示する", async () => {
    renderWithProviders(<ResourceApiReferenceView state={{ status: "loaded", reference }} />);

    expect(
      await screen.findByRole("heading", { name: "Resolve identifiers to Accounts users" }),
    ).toBeDefined();
    expect(screen.getByText("QUERY /api/v1/identities/resolve")).toBeDefined();
    expect(screen.getByText("QUERY /api/v1/external-accounts")).toBeDefined();
    expect(screen.getAllByRole("heading", { name: "要求body" })).toHaveLength(2);
    expect(screen.getByText("ResolveResponse")).toBeDefined();
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
