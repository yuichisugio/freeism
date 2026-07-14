import { createFileRoute } from "@tanstack/react-router";

import { FixedPage } from "../content/fixed-pages";

export const Route = createFileRoute("/help")({
  component: () => <FixedPage route="help" />,
  head: () => ({ meta: [{ title: "ヘルプ | Freeism Markets" }] }),
});
