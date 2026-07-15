import { useState } from "react";

import { authClient, pointsSocialProviderIds } from "../../auth/auth-client";
import type { PointsSocialProviderId } from "../../../shared/auth/social-providers";

const providerLabels: Record<PointsSocialProviderId, string> = {
  github: "GitHub",
  google: "Google",
};

export function ProviderButtons({ mode }: Readonly<{ mode: "link" | "login" }>) {
  const [pending, setPending] = useState<PointsSocialProviderId | null>(null);

  async function start(provider: PointsSocialProviderId) {
    setPending(provider);
    try {
      if (mode === "login") {
        await authClient.signIn.social({ callbackURL: "/", provider });
      } else {
        await authClient.linkSocial({ callbackURL: "/settings/connections", provider });
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="provider-list">
      {pointsSocialProviderIds.map((provider) => (
        <button
          disabled={pending !== null}
          key={provider}
          onClick={() => void start(provider)}
          type="button"
        >
          {pending === provider
            ? "接続中…"
            : `${providerLabels[provider]}で${mode === "login" ? "続ける" : "連携する"}`}
        </button>
      ))}
    </div>
  );
}
