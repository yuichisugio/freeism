# TypeScript 7 全面移行とVite Plus統一設計

## 目的

repositoryが直接管理するrootと5アプリのTypeScriptを`7.0.2`へ統一し、明示的なTypeScript 6互換aliasを撤去する。同時に、Points/MarketsのViteとVite Plusが別インスタンスとして解決される構成を解消し、Vite Plusのツールチェーンへ統一する。

## 「全面移行」の定義

今回の全面移行は、repositoryが所有する次の6 manifestで、`typescript`の直接依存をすべて`7.0.2`にすることと定義する。

- root `package.json`
- `projects/main-web-app/package.json`
- `projects/docs-web-app/package.json`
- `projects/points-web-app/package.json`
- `projects/markets-web-app/package.json`
- `projects/web-app/package.json`

rootの`@typescript/native: npm:typescript@7.0.2`と、root・5アプリの`typescript: npm:@typescript/typescript6@6.0.2`はすべて撤去する。rootと5アプリのscript・アプリコードが直接解決する`typescript`と`tsc`は、6 manifestのどこから実行しても`7.0.2`にする。後述する専用tool workspaceだけをこの直接依存規則の例外とする。

TypeScript 7は従来のJavaScript compiler APIをbare `typescript` exportから提供しない。このため、`@astrojs/check`、Blume、Twoslash、`openapi-typescript`、typescript-eslint、Knipなど、現行最新版でも旧compiler APIを必要とする外部ツールは、専用の`tools/legacy-typescript-tools` workspaceから実行し、その実行境界でTypeScript 5/6を解決する。ただし、次の制約を付ける。

- rootと5アプリのmanifestにTypeScript 5/6を直接依存として追加しない。
- `npm:@typescript/typescript6`のようなworkspace向け互換aliasを追加しない。
- 旧compiler APIを必要とするCLIと、そのCLIが直接importするplugin/configだけを専用workspaceへ移す。
- 専用workspaceの直接`typescript`は、`openapi-typescript@7.13.0`が対応する`5.9.3`へ固定する。Blumeが自身の通常依存として解決するTypeScript 6系は許容し、非対応のTypeScript 5へoverrideしない。
- 外部ツール用TypeScriptを、アプリの`tsc`、source import、またはrepositoryの汎用scriptから利用しない。
- rootと5アプリの既存public script名を維持し、専用workspaceのscriptを呼ぶ薄いwrapperへ置き換える。

実測でTS7 compiler API不足により失敗した境界は、`openapi-typescript@7.13.0`、`@astrojs/check@0.9.9`、`blume@1.0.3`経由のTwoslash、typescript-eslint、Knipである。これらのCLI実行依存とESLint設定が直接importするplugin/configを専用workspaceに置き、アプリのruntime/build/test依存は各アプリに残す。Blumeのcomponent/runtime importなど、アプリsourceから必要な依存はアプリにも維持する。`ts-prune`など未実証の候補は一括で移動しない。

専用workspaceは`private: true`とし、Changesetsの`ignore`へ追加する。version、CHANGELOG、Version PRの管理対象は従来どおり5アプリだけで、tool workspaceを第6のversion対象にしない。npm publish用script、publish設定、tag作成は追加しない。

これにより、rootと5アプリの直接TypeScriptは7に一本化しつつ、上流がTS7の新APIへ移行していない外部CLIの現行機能を明示的なtool境界で保つ。

## Vite Plus統一

root、Points、Marketsの`vite-plus`を`0.2.5`へ固定する。`0.2.5`の`@voidzero-dev/vite-plus-core`はTypeScript 7をpeer rangeに含む。

root、Points、MarketsではVite Plus公式のmigration ruleに合わせ、次の依存構成にする。source/config importの変更はPoints/Marketsにだけ適用する。

- `vite-plus`: `0.2.5`
- `vite`: `npm:@voidzero-dev/vite-plus-core@0.2.5`
- config entry fileの`defineConfig`: `vite-plus`からimportする。
- config entry file以外のVite type import: `vite`を維持する。このspecifierはVite Plus core aliasを解決する。
- `vitest` / `vitest/*` import: `vite-plus/test*`へ置き換える。
- Points/Marketsの`vitest` devDependencyは`4.1.10`で維持する。`@cloudflare/vitest-pool-workers@0.18.2`がVitest 4.1系をnon-optional peerとして要求し、Vite Plus 0.2.5が内包するVitestも`4.1.10`であるため、Vite Plus公式migration ruleの「直接必要な場合」に該当する。

pnpmでVite Plusだけを宣言して`vite`の直接edgeを持たないと、Vitestのpeer解決でupstream Viteが自動installされる。そのためroot、Points、Marketsの`vite` key自体は削除せず、Vite Plus core aliasとして明示する。既存の`resolvePeersFromWorkspaceRoot: false`は維持し、rootのaliasをmain/docs/legacy `web-app`のpeer解決へ波及させない。

main/docs/legacy `web-app`のVite・Vitest構成は、今回のVite Plus統一対象に含めない。これらにはPoints/Marketsで発生したVite Plus coreとupstream Viteの重複がなく、統一を広げると個別のframework migrationになるためである。

## release-age policy

`vite-plus@0.2.5`と`@voidzero-dev/vite-plus-core@0.2.5`は2026年7月17日公開で、実装開始時点でrepositoryの`minimumReleaseAge: 4320`分を満たさない。そのため、次の2固定versionだけを`minimumReleaseAgeExclude`に追加する。

- `"vite-plus@0.2.5"`
- `"@voidzero-dev/vite-plus-core@0.2.5"`

範囲指定、package全体の例外、または他の新規依存への例外は追加しない。72時間経過後の別changeで例外を削除できるよう、理由と対象を契約テストで固定する。

## 既存機能への影響

本設計は、`docs/superpowers/specs/2026-07-19-changesets-version-pr-design.md`のうちTypeScript versionとTS6互換aliasに関する設計だけを置き換える。Changesets、Version PR、npm非公開、5アプリversion/CHANGELOG管理の設計はそのまま維持する。

- Changesetsの5アプリversion管理、CHANGELOG生成、Version PR workflowは変更しない。
- 5アプリの現在のpackage versionは変更しない。
- npm publish、Git tag、GitHub Releaseは引き続き作成しない。
- アプリの業務sourceをTypeScript migrationのためにrefactorしない。TS7が新たに検出する局所がある場合は、検出された局所だけを最小修正する。
- Points/Marketsのbuild、test、worker test、Cloudflare deploy commandの意味は変更しない。
- Astro/Blume/OpenAPI生成/legacy lint/Knipは、専用tool workspaceでの旧compiler解決を許容し、既存のpublic script名、検査範囲、生成出力を維持する。

## エラー時の扱い

- Vite Plus core alias後もupstream `vite@8.x`がPoints/Marketsの解決graphに残る場合は、一部統一として完了扱いにしない。
- Points/Marketsの`vite.config.ts`または`vitest.worker.config.ts`に`PluginOption` / `UserConfig`の二重型が残る場合は、lockfileとplugin peerの解決先を先に修正し、型castで隠蔽しない。
- 外部compiler API toolがTS7を解決して失敗する場合は、対象CLIと必要なplugin/configだけを専用tool workspaceへ移す。rootまたはアプリの`typescript`を5/6へ戻さない。
- 専用workspace内の全依存を単一TypeScript版へoverrideしない。特にBlumeが対応を宣言するTypeScript 6系を維持し、未対応の5.9.3へ強制しない。
- 既存のbaseline failureは、更新前後の同一commandと診断差分で分離する。弱い根拠でmigration regressionと断定しない。

## テスト設計

### 契約テスト

`tests/web-app/toolchain.test.mjs`を更新し、次を固定する。

- rootに`@typescript/native`が存在しない。
- rootと5アプリの`typescript`がすべて`7.0.2`である。
- 6 manifestに`@typescript/typescript6`、`npm:typescript`のalias、TypeScript 5/6の直接依存がない。
- root、Points、Marketsの`vite-plus`が`0.2.5`である。
- root、Points、Marketsの`vite`が`npm:@voidzero-dev/vite-plus-core@0.2.5`である。
- Points/Marketsの直接`vitest`がVite Plus 0.2.5内包版と同じ`4.1.10`である。
- Points/Marketsのsource/configに`vitest` module importが残っていない。
- Points/Marketsの`build/fixed-pages-plugin.ts`が`Plugin` typeを`vite` aliasからimportし、config entry以外でVite typeを`vite-plus`から直接importしない。
- `minimumReleaseAgeExclude`が上記2固定versionだけを含む。
- `tools/legacy-typescript-tools`だけが例外としてTypeScript 5.9.3を直接持ち、rootと5アプリには旧版・互換aliasがない。
- 専用workspaceがprivateでChangesetsの`ignore`に含まれ、5アプリだけがversion対象である。
- rootと各アプリの既存public scriptが専用workspaceを経由し、旧CLI依存がroot/アプリmanifestに残らない。

### RED/GREEN検証

1. 契約テストを先に書き、現在のTS6 alias、Vite Plus 0.2.4、upstream Vite、未移行のVitest importに対して失敗することを確認する。
2. manifest、import、workspace policyを最小更新する。
3. lockfileを更新し、frozen installで整合を確認する。
4. rootと5アプリの`pnpm exec tsc --version`に加え、各packageからbare `typescript`をimportした`version`がすべて`7.0.2`であることを確認する。
5. package resolverとlockfile検査で、root・5アプリの直接TypeScriptが7だけであり、旧versionが専用tool workspaceとその外部ツール依存に限定されることを確認する。

### package別回帰検証

- root: Changesets契約テスト、`contract:web-app:check`
- main: `test`、`check`、`build`
- docs: `test`、`check`、`build`
- Points: `check`、`test`、`test:worker`、`build`
- Markets: `check`、`test`、`test:worker`、`build`
- legacy web: 既存typecheck/lint/testの更新前後診断比較、Prisma `validate` / `generate`

Points/MarketsのTS7直接`tsc --noEmit`で、Vite Plus統一前に確認した`PluginOption` / `UserConfig`の二重型が消えることを完了条件にする。Pointsの既存`Request` generic診断など、Vite型統一と無関係なbaselineは別記録とする。

## 完了条件

- rootと5アプリの直接TypeScriptが`7.0.2`だけである。
- `@typescript/native`と`@typescript/typescript6`のworkspace aliasが存在しない。
- rootと5アプリの`tsc --version`がすべて`7.0.2`である。
- rootと5アプリのbare `typescript` importがすべてTypeScript 7.0.2を解決する。
- root、Points、MarketsがVite Plus 0.2.5と対応するVite Plus core aliasを使い、Points/Marketsの直接VitestがVite Plus内包版と同じ`4.1.10`へ解決される。
- Points/MarketsのVite型重複診断が消え、既存のbuild/test/worker testが維持される。
- Astro/Blume/OpenAPI生成/legacy lintの現行機能が維持され、旧compilerはそれら外部ツールの境界だけに限定される。
- `tools/legacy-typescript-tools`がprivateかつChangesets対象外で、5アプリだけがversion/CHANGELOG管理される。
- Changesets/Version PR/npm非公開の既存契約に回帰がない。
