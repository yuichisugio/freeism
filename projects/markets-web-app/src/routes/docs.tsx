import { createFileRoute } from "@tanstack/react-router";

import { FixedPage } from "../content/fixed-pages";

export const Route = createFileRoute("/docs")({
  component: () => <FixedPage route="docs" />,
  head: () => ({ meta: [{ title: "ドキュメント | Freeism Markets" }] }),
});
