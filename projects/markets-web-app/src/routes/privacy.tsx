import { createFileRoute } from "@tanstack/react-router";

import { FixedPage } from "../content/fixed-pages";

export const Route = createFileRoute("/privacy")({
  component: () => <FixedPage route="privacy" />,
  head: () => ({ meta: [{ title: "プライバシー | Freeism Markets" }] }),
});
