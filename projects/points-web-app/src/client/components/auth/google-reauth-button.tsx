import { useState } from "react";

import { authClient } from "../../auth/auth-client";

export function GoogleReauthButton({ callbackURL }: Readonly<{ callbackURL?: string }>) {
  const [pending, setPending] = useState(false);

  async function reauthenticate() {
    setPending(true);
    try {
      await authClient.signIn.social({
        callbackURL: callbackURL ?? `${window.location.pathname}${window.location.search}`,
        provider: "google",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="secondary-button"
      disabled={pending}
      onClick={() => void reauthenticate()}
      type="button"
    >
      {pending ? "Googleへ移動中…" : "Googleで再認証"}
    </button>
  );
}
