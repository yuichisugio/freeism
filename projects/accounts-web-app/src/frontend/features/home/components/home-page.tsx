import { buttonVariants } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { PageMain } from "../../app-shell/components/page-main";
import { useLoginDialog } from "../../auth/hooks/use-login-dialog";
import { homeMessages } from "../messages";

/**
 * 利用側サービスから開いたログイン画面、またはログイン失敗で戻された場合のログインの要求。
 */
export type LoginRequest = { errorCode: string | undefined };

/**
 * トップページ（`/`）。
 * サービス名と説明、「アカウント連携へ」と「使い方」、簡単な使い方の4つの手順を置く静的な内容で、ビルド時に事前生成する。
 * ログインは「アカウント連携」を開いたときのログイン用のダイアログから行う。
 * OAuth Providerのログイン画面を兼ね、`loginRequest`があればログイン用のダイアログを自動で開く。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./home-page.test.tsx
 */
export function HomePage({ loginRequest }: { loginRequest: LoginRequest | null }) {
  const messages = useMessages(homeMessages);
  const loginDialog = useLoginDialog();
  const requestedErrorCode = loginRequest?.errorCode;
  const isLoginRequested = loginRequest !== null;

  useEffect(() => {
    if (isLoginRequested) loginDialog.open({ errorCode: requestedErrorCode });
  }, [isLoginRequested, requestedErrorCode, loginDialog]);

  return (
    <PageMain>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-accent-soft p-8 max-sm:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl max-sm:text-2xl">{messages.title}</h1>
          <p className="max-w-[40ch]">{messages.lead}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/{-$accountsUserId}/account-links" className={buttonVariants({ variant: "primary" })}>
            {messages.toAccountLinks}
          </Link>
          <Link to="/{-$accountsUserId}/help">{messages.helpLink}</Link>
        </div>
      </section>
      <section
        aria-labelledby="home-steps"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface px-6 py-5 shadow-surface max-sm:p-4"
      >
        <h2 id="home-steps" className="text-lg">
          {messages.stepsTitle}
        </h2>
        <ol className="grid grid-cols-4 gap-3 max-[820px]:grid-cols-2 max-[480px]:grid-cols-1">
          {messages.steps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-0.5 rounded-lg bg-surface-secondary px-4 py-3">
              <span
                aria-hidden="true"
                className="mb-1 grid size-(--checkbox) place-items-center rounded-full border border-border bg-surface font-display text-xs font-bold text-accent"
              >
                {index + 1}
              </span>
              <b className="font-medium">{step.title}</b>
              <span className="text-xs text-muted">{step.note}</span>
            </li>
          ))}
        </ol>
      </section>
    </PageMain>
  );
}
