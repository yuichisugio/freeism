import { createFileRoute } from "@tanstack/react-router";

import { HelpPage } from "../features/help/components/help-page";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});
