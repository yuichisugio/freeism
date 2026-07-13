import { useEffect, useId, useRef } from "react";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  remove(widgetId: string): void;
  render(container: string, options: Record<string, unknown>): string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileChallenge(props: {
  action: string;
  onError: () => void;
  onToken: (token: string) => void;
  siteKey: string;
}) {
  const reactId = useId();
  const containerId = `turnstile-${reactId.replaceAll(":", "")}`;
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(`#${containerId}`, {
        action: props.action,
        callback: props.onToken,
        "error-callback": props.onError,
        sitekey: props.siteKey,
      });
    };
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_URL}"]`,
    );
    if (existing) {
      if (window.turnstile) render();
      else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.defer = true;
      script.src = TURNSTILE_SCRIPT_URL;
      script.addEventListener("load", render, { once: true });
      script.addEventListener("error", props.onError, { once: true });
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      existing?.removeEventListener("load", render);
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
    };
  }, [containerId, props.action, props.onError, props.onToken, props.siteKey]);

  return (
    <div aria-label="Bot確認" className="status-card">
      <p>続行するにはBot確認を完了してください。</p>
      <div id={containerId} />
    </div>
  );
}
