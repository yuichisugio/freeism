import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * トップページで紹介する使い方の1手順。
 */
export type HomeStep = {
  title: string;
  note: string;
};

/**
 * トップページの文言。
 * @see ../../../../docs/specification/v0.1/design-system.ja.md
 */
export const homeMessages = defineMessages({
  ja: {
    title: "Freeism Accounts",
    lead: "アカウントが自分のものだと証明できるサービス",
    toAccountLinks: "アカウント連携へ",
    helpLink: "使い方",
    stepsTitle: "簡単な使い方",
    steps: [
      { title: "ログインする", note: "Google・GitHub・ORCID" },
      { title: "アカウント所有の証明", note: "ログインか URL で証明" },
      { title: "公開先を選ぶ", note: "プロフィールと連携先ごと" },
      { title: "連携先とつなぐ", note: "Points などから利用" },
    ] satisfies HomeStep[],
  },
  en: {
    title: "Freeism Accounts",
    lead: "Prove that your accounts are yours",
    toAccountLinks: "Go to account links",
    helpLink: "Guide",
    stepsTitle: "Getting started",
    steps: [
      { title: "Sign in", note: "Google, GitHub, or ORCID" },
      { title: "Prove ownership", note: "By signing in or with a URL" },
      { title: "Choose where to publish", note: "For your profile and each service" },
      { title: "Connect a service", note: "Use it from services such as Points" },
    ] satisfies HomeStep[],
  },
});
