export interface TurnstileChallenge {
  action: string;
  siteKey: string;
}

export function AdaptiveTurnstile({
  challenge,
}: Readonly<{ challenge: TurnstileChallenge | null }>) {
  if (!challenge) return null;
  return (
    <div
      aria-label={`追加確認: ${challenge.action}`}
      className="turnstile-placeholder"
      data-action={challenge.action}
      data-sitekey={challenge.siteKey}
    >
      追加の本人確認が必要です。確認widgetを読み込んでいます。
    </div>
  );
}
