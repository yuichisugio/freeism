import { createFileRoute } from "@tanstack/react-router";

import { FixedPage } from "../content/fixed-pages";

export const Route = createFileRoute("/terms")({
  component: () => <FixedPage route="terms" />,
  head: () => ({ meta: [{ title: "利用規約 | Freeism Markets" }] }),
});
