import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * トップページで紹介する使い方の1手順。
 */
export type HomeStep = {
  title: string;
  description: string;
};

/**
 * トップページ（簡単な使い方）の文言。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export const homeMessages = defineMessages({
  ja: {
    title: "Accounts",
    lead: "GitHub・Google・ORCIDなどの外部アカウントやWebページが自分のものであることを証明し、一般公開や連携先のサービスへ提供する範囲を自分で選べるサービスです。",
    stepsTitle: "簡単な使い方",
    steps: [
      {
        title: "ログインする",
        description:
          "Google・GitHub・ORCIDのいずれかのアカウントでログインします。初めての場合は、そのままAccountsユーザーを作成します。",
      },
      {
        title: "外部アカウントを追加する",
        description:
          "「アカウント連携」画面で、OAuthの追加連携や、WebページのURLの検証によって、外部アカウントが自分のものであることを証明します。",
      },
      {
        title: "公開する範囲を選ぶ",
        description:
          "一般公開と連携先のサービスごとに、公開する外部アカウントを選んで保存します。一般公開した外部アカウントは、あなたの公開プロフィールに掲載されます。",
      },
      {
        title: "連携先のサービスとつなぐ",
        description:
          "Pointsなどの連携先のサービスから連携を始めると、Accountsの画面で提供する外部アカウントを選んで同意できます。",
      },
    ] satisfies HomeStep[],
    helpLink: "詳しい使い方はヘルプへ",
  },
  en: {
    title: "Accounts",
    lead: "Accounts lets you prove that external accounts such as GitHub, Google and ORCID, and web pages, are yours, and choose what is shown publicly and what each connected service receives.",
    stepsTitle: "Getting started",
    steps: [
      {
        title: "Sign in",
        description:
          "Sign in with your Google, GitHub, or ORCID account. If this is your first time, an Accounts user is created for you.",
      },
      {
        title: "Add external accounts",
        description:
          "On the Account links page, prove that external accounts are yours by linking them with OAuth or by verifying the URL of a web page.",
      },
      {
        title: "Choose what to share",
        description:
          "Select the external accounts to show publicly and to share with each connected service, then save. Accounts you make public are listed on your public profile.",
      },
      {
        title: "Connect a service",
        description:
          "When you start connecting from a service such as Points, you choose the external accounts to share on an Accounts page and give your consent.",
      },
    ] satisfies HomeStep[],
    helpLink: "Read the help for details",
  },
});
