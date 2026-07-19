# Changesets Version PR 導入設計

## 目的

pnpm workspace に含まれる5アプリをChangesetsでバージョン管理し、`main`に蓄積されたChangesetからVersion PRを自動作成・更新する。

対象パッケージは次の5件とする。

- `projects/main-web-app`
- `projects/docs-web-app`
- `projects/points-web-app`
- `projects/markets-web-app`
- `projects/web-app`

## 非目的

- npm Registryへの公開
- Gitタグの作成
- GitHub Releaseの作成
- アプリ間のバージョン同期
- すべてのPull Requestに対するChangeset追加の強制
- Changesets導入と無関係なCIやパッケージ構成の整理

## TypeScriptバージョン

TypeScript 7のネイティブCLIを導入しつつ、TypeScript compiler APIを使う既存toolにはMicrosoft公式のTypeScript 6互換packageを提供する。範囲指定は使わず、次のaliasを固定する。

- rootの`@typescript/native`: `npm:typescript@7.0.2`
- rootと5アプリの`typescript`: `npm:@typescript/typescript6@6.0.2`

`pnpm-workspace.yaml`に`resolvePeersFromWorkspaceRoot: false`を設定し、各アプリのAstro、Twoslash、OpenAPI型生成、Vite等がrootのTypeScript 7をpeer dependencyとして誤解決せず、各アプリのTypeScript 6互換APIを使うようにする。rootまたはworkspace packageを実行位置とする`pnpm exec tsc`は、rootのネイティブTypeScript 7 CLIを解決する。

TypeScript 7で削除されたcompiler optionに対しては、既存のmodule resolutionやpath aliasの意味を変えない最小限のtsconfig修正を行う。該当する`projects/web-app/tsconfig.scripts.json`の`baseUrl`は削除し、config file基準で解決される既存`paths`を維持する。TypeScript更新を理由とするアプリコードのrefactorや、TypeScript以外の依存packageの一括更新は行わない。

## 現状

- workspaceは`pnpm-workspace.yaml`の`projects/*`で構成される。
- 5アプリ間に`workspace:`、`link:`、`file:`による内部依存はない。
- `fixed`または`linked`として扱う必要があるパッケージ群はない。
- root packageは`private: true`であり、バージョン管理対象ではなくworkspaceの統括に使う。
- `main-web-app`、`points-web-app`、`markets-web-app`、`web-app`は`private: true`である。
- `docs-web-app`だけは`private`が未設定である。
- 現在のリリース相当処理は`main`へのpushを契機とするCloudflareデプロイであり、npm公開、Gitタグ、GitHub Release、Version PRの運用はない。

## Changesets設定

rootの`devDependencies`へ`@changesets/cli`を固定バージョンで追加し、`.changeset/config.json`を次の方針で構成する。

- `baseBranch`: `main`
- `changelog`: `@changesets/cli/changelog`
- `commit`: `false`
- `access`: `restricted`
- `updateInternalDependencies`: `patch`
- `fixed`: 空配列
- `linked`: 空配列
- `ignore`: 空配列
- `privatePackages.version`: `true`
- `privatePackages.tag`: `false`

`docs-web-app`には`private: true`を追加し、全5アプリを非公開パッケージとして揃える。これにより、将来誤って`changeset publish`が実行されてもnpm公開対象にならない状態を作る。

root scriptsには次の操作を追加する。

- `changeset`: Changesetを対話的に作成する。
- `changeset:status`: 未反映Changesetと予定バージョンを確認する。
- `version-packages`: Changesetを消費し、各packageのversionと`CHANGELOG.md`を更新する。

通常の機能・修正PRでは、バージョン変更の対象とsemver bump種別を記録したChangeset Markdownを`.changeset/`へ含める。文書整備、CI修正、Changesets自身の設定変更など、アプリのリリースを伴わないPRではChangesetを必須にしない。

## Version PR workflow

Changesets専用のGitHub Actions workflowを追加し、`main`へのpushで実行する。

workflowは次の順で動作する。

1. repositoryをcheckoutする。
2. repositoryで固定されているpnpmとNode.jsを設定する。
3. `pnpm install --frozen-lockfile`を実行する。
4. 安定版`changesets/action` v1.9.0の検証済みcommit SHAを実行する。
5. 未反映Changesetがある場合、actionの`version`へ指定した`pnpm version-packages`を使ってVersion PRを作成または更新する。
6. 未反映Changesetがない場合、packageのpublish、タグ作成、Release作成は行わず終了する。

`changesets/action`は次の入力を明示する。

- `github-token`: `${{ secrets.GITHUB_TOKEN }}`
- `version`: `pnpm version-packages`
- `commit`: Version PR専用の固定メッセージ
- `title`: Version PR専用の固定タイトル

`publish`入力は設定せず、公式のWithout Publishing構成を使う。`NPM_TOKEN`を含むnpm認証情報も渡さない。v2はpre-releaseしか公開されていないため使用しない。

workflow権限は専用jobにだけ次を付与する。

- `contents: write`
- `pull-requests: write`

既存のCloudflare deploy workflowへwrite権限は追加しない。`changesets/action`を含むActionsは既存workflowの規約に合わせ、リリースタグではなくv1.9.0の検証済みcommit SHAで固定する。

標準`GITHUB_TOKEN`で作成・更新されたVersion PRでは、GitHubの再帰的workflow実行防止やrepository policyにより、既存PR CIが自動完了することを前提にしない。workflow runがapproval待ちとして表示された場合は、write権限を持つ管理者が内容を確認して実行を承認する。専用workflow内のdependency installとversion処理もVersion PR生成時の機械検証とし、Version PRでは生成差分をレビューしてからマージする。GitHub AppやPersonal Access Tokenの追加は今回のscopeに含めない。将来bot作成PRのCI完全自動化が必要になった場合は、認証方式を別途設計する。

## Cloudflareデプロイとの関係

`.changeset/**`だけを追加・削除するpushはアプリ成果物を変えない。この変更でPoints/Marketsのstaging・productionデプロイが起動しないよう、paths-ignore方式を使う既存2 workflowへ`.changeset/**`を追加する。

portal/docsのworkflowはpaths許可リスト方式であり、`.changeset/**`は現在の対象に含まれないため追加変更を行わない。

Version PRには対象packageの`package.json`と`CHANGELOG.md`の変更が含まれる。Version PRを`main`へマージした場合の動作は既存workflowの単位を維持する。

- `main-web-app`または`docs-web-app`がbumpされた場合、portal/docs production workflowが両アプリを検証・デプロイする。
- `points-web-app`、`markets-web-app`またはlegacy `web-app`がbumpされた場合、Points/Markets production workflowがPointsとMarketsを検証・デプロイする。legacy `web-app`自身をデプロイするworkflowはない。

Changesets導入PR自体はroot `package.json`と`pnpm-lock.yaml`を変更する。この初回マージでは既存paths条件によりportal/docsとPoints/Marketsの両production workflowが起動する。各workflowはデプロイ前に既存のtest、checkまたはbuildを実行し、失敗した場合はデプロイへ進まない。この一度限りの既存workflow実行は許容し、Changesets導入のためだけにroot dependency変更をdeploy対象から除外しない。

## CHANGELOGとバージョン

導入時には既存バージョンを変更しない。各packageの`CHANGELOG.md`は、そのpackageを対象とする最初のChangesetがVersion PRへ反映された時点でChangesetsにより作成する。

package間に内部依存がないため、あるpackageのbumpによって別packageを連鎖bumpしない。Points/Marketsやportal/docsは同じCloudflare workflowでデプロイされるが、それを理由にversionを同期しない。

## README

英語root READMEと日本語の`docs/README.ja.md`へ、次の運用を簡潔に追加する。

1. リリース対象の変更では`pnpm changeset`を実行する。
2. 対象package、bump種別、利用者向け要約を入力する。
3. 生成された`.changeset/*.md`を通常PRへ含める。
4. `main`へのマージ後、Changesets ActionがVersion PRを作成または更新する。
5. Version PRのマージでversionと`CHANGELOG.md`を確定する。
6. このworkflowはnpm公開、Gitタグ、GitHub Releaseを作成しない。

## エラー時の扱い

- dependency installが失敗した場合はVersion PRを更新せず、workflowを失敗させる。
- Changeset設定やMarkdownが不正な場合はVersion PRを更新せず、workflowログにCLIのエラーを残す。
- GitHub権限不足でPRを作成できない場合、Cloudflare workflowの権限を広げず、専用workflowの権限またはrepositoryのActions設定を確認する。
- 標準`GITHUB_TOKEN`で作成されたVersion PRでは既存PR CIの自動完了を前提にせず、必要なworkflow approvalと生成差分レビューを終えずにマージしない。
- `docs-web-app`を含む全packageはprivateのため、npm認証情報をworkflowへ渡さない。

## 検証

実装後に次を確認する。

- `pnpm install --frozen-lockfile`が成功する。
- rootと5アプリを実行位置とする`pnpm exec tsc --version`がすべて`7.0.2`を報告する。
- 各アプリのcompiler API依存toolが`typescript` aliasの`@typescript/typescript6@6.0.2`を解決する。
- TypeScript 7 CLIとTypeScript 6互換APIの併用状態で、rootと5アプリのtypecheckまたはframework固有checkを実行する。
- Changesets CLIがrootから実行できる。
- `.changeset/config.json`が`main`とprivate package versioningを正しく参照する。
- 一時Changesetを使った`changeset status`で対象packageとbump種別を認識できる。
- `version-packages`がpackage versionと`CHANGELOG.md`を更新し、Changesetを消費することを隔離した検証環境で確認する。
- 全packageがprivateであり、npm publish用scriptやtoken参照が追加されていないことを確認する。
- GitHub Actions workflowのYAML構文、version-only actionの入力、権限、SHA固定、pnpm/Node設定を確認する。
- workflowにpublish action、publish script、npm token、タグ・Release作成処理が存在しないことを確認する。
- `.changeset/**`だけの変更が既存Cloudflare deploy workflowの対象外になることをpaths条件で確認する。
- 既存の関連するpackage test、check、buildを実行し、導入による回帰がないことを確認する。
