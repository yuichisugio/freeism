import { describe, expect, it } from "vitest";

import { classifyServiceUrl } from "./classify-service-url";

describe("classifyServiceUrl", () => {
  it.each([
    ["https://github.com/Alice", "github", "alice"],
    ["https://github.com/Alice/", "github", "alice"],
    ["https://github.com/freeism-org", "github", "freeism-org"],
    ["https://gitlab.com/YorickPeterse", "gitlab", "yorickpeterse"],
    ["https://stackoverflow.com/users/22656/jon-skeet", "stackoverflow", "22656"],
    ["https://stackoverflow.com/users/22656", "stackoverflow", "22656"],
    ["https://qiita.com/Qiita", "qiita", "qiita"],
    ["https://note.com/Info", "note", "info"],
    ["https://zenn.dev/Zenn", "zenn", "zenn"],
    ["https://codeberg.org/Forgejo", "codeberg", "forgejo"],
    ["https://x.com/OpenAI", "x", "openai"],
    ["https://huggingface.co/Karpathy", "huggingface", "karpathy"],
  ])("%sをプロフィールURLとして判定し、ユーザー名を得る", (url, provider, username) => {
    expect(classifyServiceUrl(url)).toEqual({ urlType: "profile", provider, username });
  });

  it.each([
    ["サービスのトップ", "https://github.com/", "github"],
    ["リポジトリ", "https://github.com/alice/repo", "github"],
    ["機能パス", "https://github.com/settings", "github"],
    ["queryを持つプロフィール", "https://github.com/alice?tab=repositories", "github"],
    ["ユーザー名に使えない文字", "https://github.com/%E3%81%82", "github"],
    ["GitLabの機能パス", "https://gitlab.com/-", "gitlab"],
    ["GitLabのサブグループ", "https://gitlab.com/group/subgroup", "gitlab"],
    ["Stack Overflowの質問", "https://stackoverflow.com/questions/1/title", "stackoverflow"],
    [
      "Stack Overflowの数値でないユーザーID",
      "https://stackoverflow.com/users/alice",
      "stackoverflow",
    ],
    [
      "Stack Overflowのプロフィール配下",
      "https://stackoverflow.com/users/22656/jon-skeet/extra",
      "stackoverflow",
    ],
    ["Qiitaの記事", "https://qiita.com/Qiita/items/abc", "qiita"],
    ["noteの記事", "https://note.com/info/n/n1234", "note"],
    ["ZennのPublication", "https://zenn.dev/p/team", "zenn"],
    ["Zennの記事", "https://zenn.dev/zenn/articles/intro", "zenn"],
    ["Codebergの機能パス", "https://codeberg.org/explore", "codeberg"],
    ["Xの投稿", "https://x.com/openai/status/1", "x"],
    ["Xの機能パス", "https://x.com/home", "x"],
    ["Hugging Faceのモデル一覧", "https://huggingface.co/models", "huggingface"],
    ["Hugging Faceのモデル", "https://huggingface.co/karpathy/nanoGPT", "huggingface"],
  ])("%sをコンテンツURLとして判定する", (_, url, provider) => {
    expect(classifyServiceUrl(url)).toEqual({ urlType: "content", provider, username: null });
  });

  it.each([
    ["別host（www）", "https://www.github.com/alice"],
    ["既知hostを含む別host", "https://github.com.example.net/alice"],
    ["既知サービスのsubdomain", "https://gist.github.com/alice"],
    ["Reddit", "https://www.reddit.com/user/spez"],
    ["Kaggle", "https://www.kaggle.com/ash316"],
    ["Mastodon", "https://mastodon.social/@alice"],
    ["個人サイト", "https://example.com/about"],
  ])("%sを汎用Webページとして判定する", (_, url) => {
    expect(classifyServiceUrl(url)).toEqual({ urlType: "generic", provider: null, username: null });
  });
});
