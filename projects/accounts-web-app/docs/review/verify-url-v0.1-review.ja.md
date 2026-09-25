# 外部URLの登録と検証 v0.1 仕様レビュー

- [外部URLの登録と検証 v0.1 仕様レビュー](#外部urlの登録と検証-v01-仕様レビュー)
  - [1. 概要](#1-概要)
  - [2. レビューの進め方](#2-レビューの進め方)
  - [3. 要修正](#3-要修正)
    - [R01 第三者コメントの証拠で作者の識別子を取得できる](#r01-第三者コメントの証拠で作者の識別子を取得できる)
    - [R02 リンク証明1回で他の有効な証明が支える識別子が移動する](#r02-リンク証明1回で他の有効な証明が支える識別子が移動する)
    - [R03 URL規則を適用するURLが共通規則に無い](#r03-url規則を適用するurlが共通規則に無い)
    - [R05 頻度制限の参照先アンカーの誤り](#r05-頻度制限の参照先アンカーの誤り)
    - [R07 主仕様の証明方法の列挙にDNS TXTが無い](#r07-主仕様の証明方法の列挙にdns-txtが無い)
    - [R08 Provider識別子の値とユーザー名の正規化が未定義](#r08-provider識別子の値とユーザー名の正規化が未定義)
    - [R16 DNS成功時の外部アカウント行への対応付けが未定義](#r16-dns成功時の外部アカウント行への対応付けが未定義)
    - [R17 TXTをhostそのものに置く設計はCNAMEのhostで設定できない](#r17-txtをhostそのものに置く設計はcnameのhostで設定できない)
    - [R20 action\_required の発生条件が未定義](#r20-action_required-の発生条件が未定義)
    - [R30 実装計画の互換性フラグに global\_fetch\_strictly\_public が無い](#r30-実装計画の互換性フラグに-global_fetch_strictly_public-が無い)
    - [R37 HTMLRewriterが文字参照を復号しない前提が構成に無い](#r37-htmlrewriterが文字参照を復号しない前提が構成に無い)
  - [4. 記載追加が望ましい](#4-記載追加が望ましい)
  - [5. 懸念のみ](#5-懸念のみ)
  - [6. 付記](#6-付記)
  - [7. 統合指摘の全一覧](#7-統合指摘の全一覧)
  - [8. トリアージで区分を変えた指摘と理由](#8-トリアージで区分を変えた指摘と理由)

## 1. 概要

| 項目 | 内容 |
| --- | --- |
| 対象文書 | [verify-url.ja.md](../specification/v0.1/verify-url.ja.md)（外部URLの登録と検証、227行） |
| 関連文書 | [main.ja.md](../specification/v0.1/main.ja.md)（Accounts v0.1主仕様、944行）、[v0.1.md](../implementation-plan/v0.1.md)（v0.1実装計画、182行）、[上位目標のmain.ja.md](../specification/main.ja.md) |
| レビュー日 | 2026-09-24 |
| 対象の状態 | accounts-web-app の `src` は空で、実装は未着手である。本レビューは仕様（計画）のレビューである |

結論の要約:

- **要修正 11件**（R01、R02、R03、R05、R07、R08、R16、R17、R20、R30、R37）。
  - 仕様・計画を変えないと実装に進めないもの、または現実の利用フローで実害が出るものである。
  - 最も重いのは R01 で、第三者コメント1件の証拠で他人のユーザー名・プロフィールURLを取得できる。
  - R02 は R01 と独立に必要で、DNS TXT や OAuth が支える識別子がリンク証明1回で移動する。
  - R01・R16・R17・R20 には仕様作成者の判断事項がある。
- **記載追加が望ましい 32件**（統合ID単位）。
  - 実装者が妥当に判断できるが、仕様に1行あると実装・案内がぶれないもの。
- **懸念のみ 17件**（統合ID単位）と、確認のみで懸念なし 1件（R63）。
  - ほかに、記載追加・要修正の統合指摘に含まれる懸念のみの副論点が4件ある（B2-08、B2-09、C2-09、C2-11）。
- **付記 1件**（R50）と、Points 側文書のリンク切れ・文言の不一致。
  - どちらも本レビューの対象外の文書である。

凡例:

- 行番号は 2026-09-24 時点の各ファイルの行である。
- `verify-url.ja.md` は [specification/v0.1/verify-url.ja.md](../specification/v0.1/verify-url.ja.md)、`main.ja.md` は [specification/v0.1/main.ja.md](../specification/v0.1/main.ja.md)、`v0.1.md` は [implementation-plan/v0.1.md](../implementation-plan/v0.1.md) を指す。
- 上位目標の [specification/main.ja.md](../specification/main.ja.md) は「上位目標のmain.ja.md」と書く。
- 「観察された事実」は文書を開くか、コマンドを実行して確かめた内容である。
- 「疑われる問題」は、そこから導いた推測である。
- 「元ID」は8本の調査報告の指摘ID、「統合ID」（R01〜R63）はレビュー担当が重複を統合して付けたIDである。

## 2. レビューの進め方

### 2.1 体制と役割

| 役割 | 人数 | 担当 | モデル |
| --- | --- | --- | --- |
| 調査 | 観点A〜Dに各2名（計8名） | 観点ごとに独立して仕様を読み、指摘を報告した（元ID A1〜D2） | Opus 5.5 |
| レビュー | 1名 | 8本の報告の全指摘を統合し（R01〜R63）、行単位で引用と成立を検証した | Opus 5.5 |
| 検証 | 1名 | レビューの網羅性、引用、外部事実、区分の判断を再確認した | Opus 5.5 |
| 管理 | 1名 | 敵対的レビューを行い、最終区分をトリアージで確定した | Fable 5.1 |
| 執筆 | 1名 | 本書を作成し、行番号参照を実ファイルと突き合わせた | Opus 5.5 |

### 2.2 手順

1. 観点A〜Dの調査担当が、それぞれ2名ずつ独立に仕様を読み、指摘を報告した。
   - 各指摘には、観察された事実、疑われる問題、発生条件と影響、他の箇所で扱われていないかの確認結果、根拠の強さ、修正要否の提案を書いた。
2. レビュー担当が、8本の報告の指摘108件を63件の統合指摘（R01〜R63、R35は欠番）へまとめた。
   - 報告者が要修正とした指摘は、全件を行単位で確認した。
   - それ以外は、引用の正確性と明らかな誤りを確認した。
3. 検証担当が、レビューを独立に再確認した。
   - 108件の元IDがすべて統合指摘に対応付いていることを機械照合で確認した。
   - レビューの引用の誤りを2件見つけた（下記）。
   - レビューが未確認とした挙動の一部を、自分で実行して補った。
4. 管理エージェントが敵対的レビューとトリアージを行い、最終区分を確定した。
   - 本書の区分はこのトリアージを正とする。
   - レビュー担当の区分から変えた指摘は、[8章](#8-トリアージで区分を変えた指摘と理由)にまとめた。

検証担当の指摘により、本書では次の2点を訂正した内容で書いている。

- 「読者コメントの投稿者を作者・所有者として扱わない」趣旨の文は、[main.ja.md:889](../specification/v0.1/main.ja.md) には無い。
  - 同じ趣旨の文は [verify-url.ja.md:89・106・213](../specification/v0.1/verify-url.ja.md) と [v0.1.md:135](../implementation-plan/v0.1.md)（「作者・所有者・識別子の判定をコメント内容から広げず」）にある。
  - [main.ja.md](../specification/v0.1/main.ja.md) で「読者コメント」の語が出るのは142行だけである。
- Cloudflare の互換性フラグのページに、「No default date specified」という文字列は無い。
  - 実際は、`global_fetch_strictly_public` の項目に「Default as of」の行が無いだけである。
  - 他のフラグにはこの行がある。

### 2.3 証拠の所在（実行した外部確認）

各担当が実行した外部確認の要点を示す。
作業ファイルは、セッションの作業用ディレクトリ（scratchpad の verify/、review-hr/、hrtest/）に置いた。

| 手段 | 確認した内容 | 結果（観察） |
| --- | --- | --- |
| curl | `gist.github.com/jboner/2841832` | 200。`js-comment-body` が31件あり、コメント本文に外部リンクが約16件あった。コメント投稿者には Gist の作者以外が含まれた。サイズはレビュー時 356,235B、検証時 356,272B で、取得時刻による差と推測する |
| curl | `gist.github.com/karpathy/d4dee566867f8291f086` | 200。`js-comment-body` が31件あった |
| curl | 作者名を変えたコンテンツURL | `qiita.com/foo/items/c686…` は 302 で `/Qiita/items/…` へ、`x.com/OpenAI/status/1882544526033924438` は 307 で `/karpathy/status/…` へ、`zenn.dev/foo/articles/markdown-guide` は 301 で `/zenn/articles/…` へ遷移した。`gist.github.com/torvalds/2841832` は 404 |
| curl | Stack Overflow | 質問URLは 403・5,480B で、`cf-mitigated: challenge` が付いた。プロフィール `/users/22656/jon-skeet` は 200 |
| curl | Reddit | 検証時はプロフィールが 200・0B、投稿が 200・8,456B で、投稿の本文に challenge を含んだ。[verify-url.ja.md:182](../specification/v0.1/verify-url.ja.md) の「403」とは状態が変わっていたが、証拠を確認できない点は同じ |
| curl | `x.com/OpenAI` の `a[href]` | ウェブサイト欄は `https://t.co/3bPlZZkvdL`（表示は `openai.com`）、自己紹介文のリンクは `http://openai.com/jobs` |
| curl | `zenn.dev/zenn/articles/markdown-guide` | `<code>&lt;https://zenn.dev/__example__&gt;</code>` がある |
| curl・dig | 1.1.1.1 の DoH、`dig +short CNAME www.github.com` | DoH は `www.github.com` の CNAME に続けて `github.com` の TXT を返した（調査担当の記録）。dig は `github.com.` を返した |
| GitHub API・raw | 参考実装のライセンス | `orta/keytrace` と `divinevideo/divine-identify-verification-service` はライセンス未設定。`markdown-it/linkify-it` は MIT。`keyoxide/doipjs` は Apache-2.0。`futo-org/Harbor` は API 上 `NOASSERTION` で、LICENSE 本文は apps/ 以外を MIT とする |
| workerd | miniflare 4.20260710.0（workerd 1.20260710.1）で `HTMLRewriter` を実行 | テキストと `getAttribute("href")` は、`&lt;`・`&gt;`・`&amp;`・`&#x26;` などの文字参照を復号せずに返した |
| workerd | 同じ環境で `nodejs_compat` を有効にし、`node:dns/promises` の `resolveTxt` を実行 | `github.com` は24件。`www.github.com` は先頭に CNAME の行 `["github.com."]` を含む25件。存在しない名前は `ENOTFOUND`。`github.com` の TXT に Accounts の値は無かった |
| ローカル実行 | linkify-it 5.0.0（ローカルに既にあった marp-cli 同梱のもの） | `A &lt;https://accounts.freeism.app/profiles/ausr_abc&gt; &amp;` から `https://accounts.freeism.app/profiles/ausr_abc&gt` を抽出した。`プロフィールはhttps://accounts.freeism.app/profiles/ausr_abcです` からは0件だった |
| node | WHATWG URL | `new URL("https://github.com./alice").hostname` は `github.com.` を保持した |
| WebFetch | [Cloudflare 互換性フラグ](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) | `global_fetch_strictly_public` が無効なとき、同一zoneへの要求は zone の origin へ送られ、Cloudflare のセキュリティ設定を迂回する（原文では bypassing Cloudflare security settings）。この項目には「Default as of」の行が無い。private IP に関する記述は無い |
| WebFetch | [Cloudflare Workers の node:dns](https://developers.cloudflare.com/workers/runtime-apis/nodejs/dns/) | `lookup`・`lookupService`・`resolve` は未実装。1.1.1.1 の DNS over HTTPS を使い、subrequest に数える。`resolveTxt` の名前はページに無く、workerd での実行で補った |
| WebFetch | [RFC 2181 §10.1](https://www.rfc-editor.org/rfc/rfc2181#section-10.1) | CNAME のラベルは DNSSEC 関連以外の data を持てない（原文 may have no other data） |
| grep・ls | 仕様・計画・Points 側文書 | [v0.1.md](../implementation-plan/v0.1.md) に `global_fetch`・`linkify`・DNS の取得手段の記述は無い。Provider 値のバッククォート表記は `github`・`google`・`orcid` だけ。v0.3 文書の3リンクと Points 側文書の11リンクは実在しないファイルを指す |
| コード確認 | 移行元 points-web-app | `wrangler.jsonc` に `"global_fetch_strictly_public"` がある。`verify-web-ownership.ts:9-10` は `REOWNERSHIP_INTERVAL = 5 * DAY`・`REOWNERSHIP_WINDOW = 14 * DAY`、221-223行は有効な他人所有を `WEB_OWNERSHIP_ALREADY_ACTIVE` で拒否する |

### 2.4 未確認の事項

次の事項は、レビュー担当・検証担当とも再確認していない。
本書では、これらに依拠する記述に「未確認」または「報告者の記録に依拠」と書く。

- Workers 本番環境（データセンターのIP）からの各サービスの応答。
  - X・Stack Overflow・Reddit などが Workers からの取得にどう応答するかは未確認である。
- 1.1.1.1 の TTL と否定キャッシュの具体的な値。
- HTMLRewriter で1MiB級のHTMLを解析したときの CPU 時間（調査担当のローカル実測 約194ms に依拠）。
- テキストノードの分割の実測（調査担当の記録に依拠）。
- Mastodon のリンク検証の条件（調査担当の確認に依拠）。
- X・Hugging Face・GitLab のプロフィールページの静的HTMLに、第三者の投稿が入るか。
- linkify-it 6.0 の CHANGELOG の内容（調査担当の確認に依拠）。

## 3. 要修正

要修正は11件である。
各項目は、観察された事実、疑われる問題、発生する操作、影響、他の箇所の確認結果、外部確認の結果、最小修正案の順に書く。

### R01 第三者コメントの証拠で作者の識別子を取得できる

- 元ID: A1-02、B1-01、B2-01、C2-01（4名とも要修正）
- 根拠の強さ: 強
- 仕様作成者の判断事項: **あり**（修正方針の採否）

**観察された事実**

- 第三者のコメントを証拠に含める規定がある。
  - [verify-url.ja.md:99](../specification/v0.1/verify-url.ja.md) は、本文テキストの候補に「第三者投稿の読者コメントと`code`・`pre`内のコード例も含む」とする。
  - [verify-url.ja.md:109](../specification/v0.1/verify-url.ja.md) は「第三者投稿の読者コメントやコード例だけに本人のAccountsプロフィールURLがある場合も一致として扱う」とする。
  - [verify-url.ja.md:208](../specification/v0.1/verify-url.ja.md) と [main.ja.md:142](../specification/v0.1/main.ja.md) も同じ趣旨である。
- 入力URLの証明を、URL規則で決まる作者の識別子へ広げる規定がある。
  - [verify-url.ja.md:89](../specification/v0.1/verify-url.ja.md) は「対応サービスのURL規則で対象アカウントのユーザー名・プロフィールURLを確定できれば、検証したURLとともに同じ外部アカウントへ保存し、この証明を適用する」とする。
  - [verify-url.ja.md:166](../specification/v0.1/verify-url.ja.md) は「入力URLから判定した作者のGitHubプロフィールURL・ユーザー名とGist URLを一つの外部アカウントに紐付ける」とする。
  - [main.ja.md:873・889](../specification/v0.1/main.ja.md)、[v0.1.md:135](../implementation-plan/v0.1.md) も同じ拡張を定める。
- コメントに関する制限は、コメント投稿者を作者と推定することの禁止だけである。
  - [verify-url.ja.md:89・106・213](../specification/v0.1/verify-url.ja.md) は「読者コメントの投稿者を作者・所有者として扱わない」趣旨を定める。
  - [v0.1.md:135](../implementation-plan/v0.1.md) は「作者・所有者・識別子の判定をコメント内容から広げず」とする。
  - どちらも、URL規則で決まる作者へ証明を適用することは禁じていない。
- 他ユーザーに有効な識別子も移動する。
  - [main.ja.md:136](../specification/v0.1/main.ja.md) は、別のユーザーに紐付くWeb URLも再証明できれば現在の所有者を申請者へ更新するとする。
  - [main.ja.md:875](../specification/v0.1/main.ja.md) で移動しないのは「OAuth固有IDとOAuth認証行」だけである。
  - [main.ja.md:338-361](../specification/v0.1/main.ja.md) の OAuth 例では、`provider_username`（`alice`）と `url`（`https://github.com/alice`）も OAuth の証明の対象に入っている。
- 防御は [verify-url.ja.md:107](../specification/v0.1/verify-url.ja.md) の判断不能規則だけである。
  - これは、異なるAccountsユーザーのURLが同じ証拠候補の範囲に複数ある場合にしか働かない。

**疑われる問題（推測）**

- 仕様の文面を組み合わせると、次の経路が成立すると考える。
  1. 攻撃者が、被害者の Gist のコメント欄に自分のAccountsプロフィールURLを書く。
  2. 攻撃者がその Gist URL を登録し、「保存して検証する」を押す。
  3. コメント中のURLが一致し、リンク証明が成立する。
  4. URL規則から作者 `alice` が決まり、`github`/`alice` のユーザー名とプロフィールURLにも証明が適用される。
  5. Alice に有効な紐付けがあっても、[main.ja.md:136・875](../specification/v0.1/main.ja.md) により攻撃者へ移る。
- 同じ経路は、コメント欄のある記事・投稿・Merge Request・Issue・成果物のURLにも当てはまると推測する。

**発生する操作**: 攻撃者が被害者のコンテンツにコメントを投稿し、そのコンテンツURLを「アカウント連携」画面に入力して「保存して検証する」を押す操作で発生する。被害者の操作は要らない。

**影響（推測）**

- 照合API（サービス名とユーザー名、プロフィールURL）が攻撃者のAccountsユーザーを返す。
- Points の貢献の帰属が攻撃者へ移る。
- 被害者の公開プロフィールと照合結果から、その識別子が外れる。

**他の箇所で扱われていないことの確認結果**

- [verify-url.ja.md](../specification/v0.1/verify-url.ja.md) 全文、[main.ja.md:129-151・338-361・403・551・873-889](../specification/v0.1/main.ja.md)、[v0.1.md:133-135](../implementation-plan/v0.1.md) を確認した。
- 作者識別子への適用を、コメント以外の証拠に限る規定は見当たらない。

**外部確認の結果**

- `gist.github.com/jboner/2841832` は 200 で、`js-comment-body` が31件あった。
- コメント本文に外部リンクが約16件あり、投稿者には Gist の作者以外が含まれた。
- 第三者のコメントが静的HTMLに含まれることを再現できた。

**最小修正案**

- 推奨案: 「作者・所有者の識別子への証明適用は、プロフィールページ（作者だけが編集できるページ）の証拠と OAuth に限る。記事・投稿・Gist・成果物などのコンテンツURLの証明は、入力URL単独とする」。
  - サービスごとに「証拠がページのどの領域から出たか」を判定する処理が要らない。
  - 変更は主に文の削除と簡素化で、新しい仕組みは要らない。
  - Gist から GitHub アカウントへの紐付けは失うが、GitHub OAuth で代替できる。
  - Qiita・Zenn・note・X などは、プロフィールページの証明で代替できる。
- 比較した案: 「作者の編集領域の証拠に限る」。
  - サービスごとに、コメント欄と本文を見分ける DOM 領域の規則とテストが要る。推奨案より実装が大きい。
- 推奨案を採る場合の修正箇所（連動箇所を含む）:
  - [verify-url.ja.md:89](../specification/v0.1/verify-url.ja.md): 大半の文を、「プロフィールURLの証明はそのプロフィールのユーザー名・URLへ適用し、コンテンツURLの証明は入力URL単独とする」の2〜3文に置き換える。「読者コメントの投稿者を作者として扱わない」文と固有IDの文は残せる。
  - [verify-url.ja.md:106](../specification/v0.1/verify-url.ja.md): 後段の「作者と入力URLの対応は、登録対象と識別子の判定に使う」を合わせる。
  - [verify-url.ja.md:165-168](../specification/v0.1/verify-url.ja.md): Gist URL は単独の証明とし、作者の GitHub 識別子はプロフィールまたは OAuth で証明すると書き換える。作者名は登録情報（未検証）として扱う（[verify-url.ja.md:85](../specification/v0.1/verify-url.ja.md) と整合する）。
  - [verify-url.ja.md:172](../specification/v0.1/verify-url.ja.md): コンテンツURLを個別対応する目的が「サービス名の判定と登録情報」になるように合わせる。
  - [verify-url.ja.md:176-185](../specification/v0.1/verify-url.ja.md) の「制約と対応境界」列: MR のコメント者と作者、Qiita の redirect の照合、Hugging Face の所有者などの記述を合わせる。
  - [verify-url.ja.md:187](../specification/v0.1/verify-url.ja.md): 作者プロフィールへの証明適用の2文を削る。「別のプロフィール取得、外部API通信、JavaScriptの実行は追加しない」は残す。
  - [verify-url.ja.md:197](../specification/v0.1/verify-url.ja.md): サービス別の処理の説明を合わせる。
  - [verify-url.ja.md:213](../specification/v0.1/verify-url.ja.md): 受け入れ条件を「コンテンツURLは入力URL単独、プロフィールURLはそのアカウントへ適用」の1〜2文に書き換える。
  - [main.ja.md:873](../specification/v0.1/main.ja.md): URL規則による対象の確定、同一HTML、Codeberg・Hugging Face の所有アカウントの3文を1文に置き換える。
  - [main.ja.md:887](../specification/v0.1/main.ja.md): 個別対応の範囲の説明を合わせる。
  - [main.ja.md:889](../specification/v0.1/main.ja.md): コンテンツURLからのユーザー名・プロフィールURLの保存を削る。この行はトリアージの列挙に無いが、同じ拡張を定めているため対象に含めた。
  - [v0.1.md:135](../implementation-plan/v0.1.md): 実装・検証の項目を合わせる。
  - Points 側文書の表現も合わせる（[6章](#6-付記)）。
- [verify-url.ja.md:99・109・208](../specification/v0.1/verify-url.ja.md) の「コメントを証拠に含める」規定は、推奨案では変えない。

**仕様作成者の判断事項**

- 推奨案は機能の縮小である。[verify-url.ja.md:165](../specification/v0.1/verify-url.ja.md) は仕様作成者自身の Gist を例にして、Gist から GitHub アカウントへの紐付けを求めている。採否は仕様作成者が決める。
- 推奨案は、プロフィールページに第三者が書ける領域が無いことを前提にしている。
  - GitHub・Qiita などのプロフィールでは、その可能性は低いと推測する。
  - X・Hugging Face・GitLab のプロフィールの静的HTMLに第三者の投稿が入るかは**未確認**である。実装時のサービス別テスト観点に加えるのがよい。
- R01 を直しても、入力URLそのものの移動は残る。これは R02 で扱う。

### R02 リンク証明1回で他の有効な証明が支える識別子が移動する

- 元ID: B1-02（要修正）。B2-01 の末尾と C2-01 の一部も同じ論点
- 根拠の強さ: 中
- 区分の経緯: レビュー担当は記載追加としたが、管理者判断で要修正とした（[8章](#8-トリアージで区分を変えた指摘と理由)）

**観察された事実**

- [main.ja.md:136](../specification/v0.1/main.ja.md) は、別のユーザーに紐付くWeb URLも、申請者の証拠を再証明できれば現在の所有者を申請者へ更新するとする。
- [main.ja.md:875](../specification/v0.1/main.ja.md) は「今回確認したキーごとに旧所有者の識別子行とその全証明との関連を削除し」とする。移動しないのは「OAuth固有IDとOAuth認証行」だけである。
- [main.ja.md:142](../specification/v0.1/main.ja.md) と [main.ja.md:551](../specification/v0.1/main.ja.md) は、リンク検証の `verified` がページの編集権限を保証しないという**意味**を述べている。
  - DNS TXT で証明済みのURLを、コメント1件のリンク証明で移動してよいとは、どこにも書かれていない。
- 移行元の `verify-web-ownership.ts:221-223` は、有効な他人所有を `WEB_OWNERSHIP_ALREADY_ACTIVE` で拒否していた。
  - 再検証に失敗した所有だけを、5日以上の間隔で3回成功したときに移管していた（9-10行、313-383行）。

**疑われる問題（推測）**

- R01 の推奨案は「証明を作者識別子へ広げる範囲」だけを狭める。入力URL自体は、引き続き「確認した識別子」になる。
- このため、コメント欄のあるページ（本人のブログ記事、Gist URL、記事URLなど）では、攻撃者のコメント1件でそのURLの所有者が攻撃者へ移る。
- これを止めるのは [verify-url.ja.md:107](../specification/v0.1/verify-url.ja.md) の判断不能規則だけで、元の所有者のURLが同じページにある場合しか働かない。
- 実際に残る経路は主に次の2つと推測する。
  - DNS TXT で host を証明し、各ページにはリンクを置いていない場合。
  - 所有者が証明後にリンクを外した場合。
- [main.ja.md:875](../specification/v0.1/main.ja.md) は、移動時に旧所有者の識別子行と「全証明との関連」を削除する。このため DNS 証明の関連まで失われる。
- DNS で証明した所有者は再検証で取り戻せるが、再び奪われる往復が起こりうる。

**発生する操作**: WordPress など、コメントが静的HTMLに載るブログを DNS TXT で証明した本人がいる状態で、攻撃者がそのページにコメントを投稿し、同じURLを入力して「保存して検証する」を押す操作で発生する。

**影響（推測）**

- DNS TXT という強い証明が、コメント1件のリンク証明で上書きされる。
- Points の帰属が攻撃者へ移る。コメントを承認制にしているブログでは起きにくい。

**他の箇所で扱われていないことの確認結果**

- [main.ja.md:135・138-140・874](../specification/v0.1/main.ja.md): 再検証の失敗では現在の紐付けを変えない。OAuth の紐付け先の変更には解除と再連携を使う。
- [verify-url.ja.md:60・66・138](../specification/v0.1/verify-url.ja.md): 直近結果と現在の紐付けを分けることだけを定める。
- DNS TXT や OAuth が支えるURL・ユーザー名の識別子を、Web再証明による移動から守る規定は無い。

**外部確認の結果**: 外部サービスへの実行は無い。移行元コードの行番号と内容を確認した。

**最小修正案**

- 次の文を [main.ja.md:136](../specification/v0.1/main.ja.md)・[main.ja.md:875](../specification/v0.1/main.ja.md) と、[verify-url.ja.md:107-109](../specification/v0.1/verify-url.ja.md) 付近に加える。
  - 「リンク証明単独では、`dns_txt`または`oauth`の有効な証明が支える識別子を移動しない。該当時は`indeterminate`として本人に案内する」
- 待機期間や複数回成功の要件を戻すことは求めない。
- R01 と独立に必要である。

### R03 URL規則を適用するURLが共通規則に無い

- 元ID: B1-03、C2-02、C2-09 の一部
- 根拠の強さ: 中

**観察された事実**

- [verify-url.ja.md:89](../specification/v0.1/verify-url.ja.md) と [main.ja.md:873](../specification/v0.1/main.ja.md) は、URL規則を入力URLと最終取得URLのどちらへ適用するかを書いていない。
- [verify-url.ja.md:165-166](../specification/v0.1/verify-url.ja.md) は Gist について「入力URLから判定した作者」と明記している。
- [verify-url.ja.md:116](../specification/v0.1/verify-url.ja.md) は「登録URL、最終取得URL、実際の証拠を区別して扱う」とし、redirect を最大3回まで追跡する。
- redirect する3サービスには、表の行に照合の記述がある。
  - [verify-url.ja.md:178](../specification/v0.1/verify-url.ja.md)（Qiita）「ユーザー名変更時のredirect後URLと記事の作者リンクを照合する」
  - [verify-url.ja.md:180](../specification/v0.1/verify-url.ja.md)（Zenn）「ユーザー名はURL・作者リンクから照合」
  - [verify-url.ja.md:183](../specification/v0.1/verify-url.ja.md)（X）「ユーザー名はURL・投稿の作者情報から照合」
  - ただし、不一致のときの扱いは書かれていない。

**疑われる問題（推測）**

- 攻撃者が自分の Qiita 記事に自分のAccountsプロフィールURLを書き、`qiita.com/alice/items/{攻撃者の記事ID}` を登録する。
- 302 で攻撃者の記事へ遷移して証拠が一致し、入力URLの規則だけで作者を `alice` と判定すると、`qiita`/`alice` が攻撃者に付く。
- 表の行の照合を実装すれば防げるため、「仕様どおりに実装すれば必ず乗っ取れる」とは言えない。
- ただし、共通規則だけで実装すると、この防御が抜けうる。

**発生する操作**: 攻撃者が自分の記事・投稿を用意し、URLのユーザー名部分を他人に変えて「保存して検証する」を押す操作で発生する。

**影響（推測）**: R01 と同じく、他人のユーザー名が攻撃者に付く。

**他の箇所で扱われていないことの確認結果**: [verify-url.ja.md:116・178・180・183](../specification/v0.1/verify-url.ja.md)、[v0.1.md:135](../implementation-plan/v0.1.md) を確認した。「作者は最終取得URLで確定する」という共通規則は無い。

**外部確認の結果**

- `qiita.com/foo/items/c686397e4a0f4f11683d` は 302 で `qiita.com/Qiita/items/…` へ遷移した。
- `x.com/OpenAI/status/1882544526033924438` は 307 で `/karpathy/status/…` へ遷移した。
- `zenn.dev/foo/articles/markdown-guide` は 301 で `/zenn/articles/…` へ遷移した。
- `gist.github.com/torvalds/2841832` は 404 だった。

**最小修正案**

- [verify-url.ja.md:89](../specification/v0.1/verify-url.ja.md) に1文を加える。
  - 「URL規則は最終取得URLに適用し、入力URLと作者が異なれば作者識別子へ適用しない」
- [verify-url.ja.md:165-166](../specification/v0.1/verify-url.ja.md) の Gist の記述も、この規則に揃える。
- 表の各行の照合の記述は、この一般規則に吸収できる。
- R01 の推奨案を採ると、コンテンツURLの部分は不要になる。
  - ただし、プロフィールURLもユーザー名の変更で redirect しうる（[verify-url.ja.md:178](../specification/v0.1/verify-url.ja.md) の文脈）。このため1文はどちらの案でも必要と考える。

### R05 頻度制限の参照先アンカーの誤り

- 元ID: A1-01、A2-06
- 根拠の強さ: 強

**観察された事実**

- [verify-url.ja.md:37](../specification/v0.1/verify-url.ja.md) は「検証リクエストの頻度制限は[Accountsの提供・技術要件](main.ja.md#提供技術要件)に従う」とする。
- [main.ja.md:903-944](../specification/v0.1/main.ja.md)（提供・技術要件）には、Web検証の頻度制限が無い。
  - [main.ja.md:922](../specification/v0.1/main.ja.md) は Better Auth の `rateLimit.storage` である。
- 実体は [main.ja.md:553-557](../specification/v0.1/main.ja.md)（検証要求の制御）にある。
- アンカー自体は実在するので、リンク切れではない。参照先の内容が違うという誤りである。

**疑われる問題（推測）**: 読み手が頻度制限の規定を見つけられず、提供・技術要件の Better Auth の設定と取り違えうる。

**発生する操作**: 仕様の読み手・実装者がリンクをたどる操作で発生する。

**影響**: 実装の誤りに直結はしないが、頻度制限の実装先を誤読しうる。

**他の箇所で扱われていないことの確認結果**

- [verify-url.ja.md:144](../specification/v0.1/verify-url.ja.md) にも同じアンカー `main.ja.md#提供技術要件` がある。
  - こちらは生成応答のキャッシュと更新後の purge の参照である。
  - [main.ja.md:909・942](../specification/v0.1/main.ja.md) は提供・技術要件の節にあり、Workers Cache と purge を定めている。このため 144行の参照先は正しい。

**外部確認の結果**: 不要（文書内の確認のみ）。

**最小修正案**: [verify-url.ja.md:37](../specification/v0.1/verify-url.ja.md) のリンク先を `main.ja.md#検証要求の制御` に変える。[verify-url.ja.md:144](../specification/v0.1/verify-url.ja.md) は変更不要である。

### R07 主仕様の証明方法の列挙にDNS TXTが無い

- 元ID: A1-03、A2-07（どちらも要修正）、A2-12（記載追加）
- 根拠の強さ: 強

**観察された事実**

- 次の箇所は、証明方法として OAuth とWebページのリンク検証だけを挙げ、DNS TXT を挙げていない。
  - [main.ja.md:182](../specification/v0.1/main.ja.md)「OAuth・OIDC認証と、Webページのリンク検証のいずれで証明した外部アカウントにも」
  - [main.ja.md:183](../specification/v0.1/main.ja.md)「Webページのリンクによる所有権証明と…」
  - [main.ja.md:216](../specification/v0.1/main.ja.md)「外部ページの取得とリンク検証は」
  - [main.ja.md:477-483](../specification/v0.1/main.ja.md) のシーケンス図は、Webページの証明としてリンクの設置と取得だけを描いている。
  - [main.ja.md:622](../specification/v0.1/main.ja.md)「OAuth・公開ページのリンク確認をそれぞれのバッジで示す」
  - [main.ja.md:651](../specification/v0.1/main.ja.md)「登録候補は、本人がOAuth認証またはWebページのリンク検証で所有権を改めて証明し…有効にする」
- 一方、[main.ja.md:151-152・399・551・593・854・873](../specification/v0.1/main.ja.md) と [v0.1.md:133-134](../implementation-plan/v0.1.md) は DNS TXT を含む。
- [verify-url.ja.md:66](../specification/v0.1/verify-url.ja.md) は、DNS の対象を「同じhostで本人が登録済みのURL」とする。
- [main.ja.md:878](../specification/v0.1/main.ja.md) により、復元候補は本人の `is_active=0` 行になる。
- [main.ja.md:899](../specification/v0.1/main.ja.md) は、シーケンス図を「仕様の変更時に更新する」と定める。

**疑われる問題（推測）**

- [verify-url.ja.md:66](../specification/v0.1/verify-url.ja.md) では、復元候補のURLを DNS TXT で有効にできると読める。
- [main.ja.md:651](../specification/v0.1/main.ja.md) では、復元候補を有効にする手段に DNS が無い。両者は文面上で食い違う。

**発生する操作**: JSONバックアップから復元した後、`is_active=0` の候補URLを DNS TXT で改めて証明する操作で、どちらの規定に従うかが決まらない。

**影響（推測）**: 復元候補の有効化の実装が分かれる。公開画面のバッジ（[main.ja.md:622](../specification/v0.1/main.ja.md)、[verify-url.ja.md:140](../specification/v0.1/verify-url.ja.md)）にも DNS の方法が表れない。

**他の箇所で扱われていないことの確認結果**: 上記の DNS を含む箇所を確認した。[main.ja.md:651](../specification/v0.1/main.ja.md) の例外として DNS を認める記述は無い。

**外部確認の結果**: 不要（文書内の確認のみ）。

**最小修正案**

- 必須: [main.ja.md:651](../specification/v0.1/main.ja.md) の証明手段に「DNS TXT」を加える。[main.ja.md:477-483](../specification/v0.1/main.ja.md) のシーケンス図に、リンク不成立時の DNS TXT の確認を加える。
- 同時に揃える: [main.ja.md:182・183・216・622](../specification/v0.1/main.ja.md) に DNS TXT を加える。バッジ名（[main.ja.md:622](../specification/v0.1/main.ja.md)、[verify-url.ja.md:140](../specification/v0.1/verify-url.ja.md)）にも DNS の方法を加える。

### R08 Provider識別子の値とユーザー名の正規化が未定義

- 元ID: A1-04、A2-05（どちらも要修正）。B1-06・C2-09（懸念のみ）も関連する
- 根拠の強さ: 強

**観察された事実**

- [main.ja.md:419](../specification/v0.1/main.ja.md) は「許可するProviderは`google`・`github`・`orcid`と、採用済みの個別対応サービスとする」「未対応のProviderは`INVALID_VALUE`を返す」とする。
  - 同じ行で「受け付けるProvider・入力形式・正規化は[サービス別の識別](verify-url.ja.md#サービス別の識別)に従う」と委ねている。
- [main.ja.md:211](../specification/v0.1/main.ja.md) は「サービスで明示された正規化だけを適用する」、[main.ja.md:850](../specification/v0.1/main.ja.md) は Provider 識別子行のユーザー名の保存を定める。
- [verify-url.ja.md:68-89・170-191](../specification/v0.1/verify-url.ja.md) に Provider の文字列は `github`（[verify-url.ja.md:162](../specification/v0.1/verify-url.ja.md)）しかない。
- docs 全体を grep しても、バッククォート付きの Provider 値は `github`・`google`・`orcid` だけだった。
- 大文字小文字の規則は [verify-url.ja.md:43](../specification/v0.1/verify-url.ja.md)（scheme・host）だけである。

**疑われる問題（推測）**

- GitLab・Stack Overflow・Qiita・note・Zenn・Codeberg・X・Hugging Face の Provider 識別子の値が決まらない。
- ユーザー名の正規化（大文字小文字など）が決まらない。
- 照合APIが受け付ける値と `INVALID_VALUE` を返す条件が決まらない。

**発生する操作**: Points などの利用側が、照合APIへ `provider_username` を送る操作で発生する。

**影響（推測）**

- API の許可値は Points との契約であり、実装者と利用側で値が食い違いうる。
- 例えば `github.com/Alice` と `github.com/alice` が別のユーザー名として保存され、照合の表記しだいで該当なしになりうる（C2-09）。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:395・419](../specification/v0.1/main.ja.md) と [verify-url.ja.md:72](../specification/v0.1/verify-url.ja.md) を確認した。型は [main.ja.md:395](../specification/v0.1/main.ja.md) にあり、厳密には循環参照ではない。Provider 値と正規化だけが、どちらの文書にも無い。

**外部確認の結果**: grep による文書内の確認のみ。GitHub がユーザー名の大文字小文字を区別しないと公式に明示しているかは未確認である（C2-09）。

**最小修正案**

- [verify-url.ja.md](../specification/v0.1/verify-url.ja.md) の「サービス別の識別」節に表を加える。
  - 列: サービス、Provider 識別子の値、ユーザー名の正規化（大文字小文字など）。
  - 対象: `gitlab`・`stackoverflow`・`qiita`・`note`・`zenn`・`codeberg`・`x`・`huggingface`（値の綴りは仕様作成者が決める）と、既存の `github`。
- 個別対応サービスのプロフィールURLを正規形で保存するか（B1-06）も、同じ表で決めるとよい。

### R16 DNS成功時の外部アカウント行への対応付けが未定義

- 元ID: A2-04（要修正）、A1-06 の(1)（記載追加）
- 根拠の強さ: 中
- 仕様作成者の判断事項: **あり**（統合するか、行ごとに証明行を作るか）

**観察された事実**

- [verify-url.ja.md:64・66](../specification/v0.1/verify-url.ja.md) は、DNS 成功時に同じ host で本人が登録済みのURLすべてを対象にする。
- [verify-url.ja.md:50](../specification/v0.1/verify-url.ja.md) は、同じ host の別 path を別URLとして登録する例である。
- [main.ja.md:873](../specification/v0.1/main.ja.md) は「成功時だけ今回確認した識別子を同じ外部アカウントへまとめ」とする。
- [main.ja.md:852](../specification/v0.1/main.ja.md) は「証明と識別子は同じ`account_id`に属することを保存処理で確認する」とする。
- [main.ja.md:845](../specification/v0.1/main.ja.md) で、証明行の `account_id` は単一で、UNIQUE `(account_id, method, evidence_key)` である。
- [main.ja.md:180](../specification/v0.1/main.ja.md) で、公開対象の選択単位は外部アカウントである。

**疑われる問題（推測）**

- 同じ host のURLが別々の `external_accounts` 行にある場合、次のどちらを取るかが文書から決まらない。
  - (a) 1行へ統合する。行ごとの公開設定が変わる。
  - (b) 行ごとに `dns_txt` の証明行（`evidence_key` は host）を作る。

**発生する操作**: 本人が `https://example.com/` と `https://example.com/about` を別々に登録し、どちらかで「保存して検証する」を押して DNS TXT が成功する操作で発生する。[verify-url.ja.md:50](../specification/v0.1/verify-url.ja.md) の例示どおりの流れである。

**影響（推測）**: 統合するかどうかで、公開設定と表示行が変わる。統合は元に戻しにくい。

**他の箇所で扱われていないことの確認結果**

- [main.ja.md:843-854・873・875](../specification/v0.1/main.ja.md)、[verify-url.ja.md:64-66・89](../specification/v0.1/verify-url.ja.md) を確認した。
- Gist など同じ識別子を共有する場合は、[main.ja.md:844](../specification/v0.1/main.ja.md) の UNIQUE `(user_id, kind, provider, issuer, value)` で事実上統合が決まる。
- URL が異なる同じ host の場合は識別子が重ならないため、決まらない。
- [v0.1.md:7](../implementation-plan/v0.1.md) は「未決事項は対応する実装に着手する前に確定し、テーブル構造を更新してからmigrationを作成する」とする。

**外部確認の結果**: 不要（文書内の確認のみ）。

**最小修正案**

- [verify-url.ja.md:66](../specification/v0.1/verify-url.ja.md) または [main.ja.md:873](../specification/v0.1/main.ja.md) に、どちらを取るかを1文で書く。
- 調査担当（A2-04）は、公開設定を保てて影響が小さい (b) を推している。
  - 例: 「DNSの成功は、対象URLを含む各外部アカウントにhostをキーとする`dns_txt`証明を作り、外部アカウントを統合しない」
- migration の作成前に決める必要がある。

### R17 TXTをhostそのものに置く設計はCNAMEのhostで設定できない

- 元ID: B2-05、C-1-02（どちらも要修正）。D2-02 の CNAME 部分（懸念のみ）
- 根拠の強さ: 強（DNSの規格による制約）
- 仕様作成者の判断事項: **あり**（TXT の名前という外部契約）

**観察された事実**

- [verify-url.ja.md:62](../specification/v0.1/verify-url.ja.md) は「TXTレコードは、証明するhostそのものに追加する」「`blog.example.com`を証明する場合は`blog.example.com`をレコードの名前とする」とする。
- [verify-url.ja.md](../specification/v0.1/verify-url.ja.md)・[main.ja.md](../specification/v0.1/main.ja.md)・[v0.1.md](../implementation-plan/v0.1.md) に CNAME への言及は無い。

**疑われる問題（推測）**

- サブドメインを GitHub Pages・Netlify・Vercel などへ CNAME で向けている場合、同じ名前に TXT を置けない。
- CNAME の host の TXT を照会すると、転送先（ホスティング事業者）の TXT が返る。
  - 転送先を制御できるのは事業者なので、リンク証明と比べて新しい攻撃能力は生まれない（B2-05・D2-02 の評価）。
  - 問題は使い勝手と、利用者が設定する外部契約を後から変えにくい点である。
- DNS の否定キャッシュにより、TXT を追加した直後の再検証が失敗しうる（R18）。

**発生する操作**: サブドメインのブログを外部ホスティングで運用する本人が、案内に従って TXT を追加しようとする操作で発生する。

**影響（推測）**

- リンクを置けないページのための DNS 証明が、使いたい場面で使えない。
- 利用者が TXT を設定した後に名前の規則を変えると、全員に再設定を求めることになる。

**他の箇所で扱われていないことの確認結果**: [verify-url.ja.md:56-66・215](../specification/v0.1/verify-url.ja.md)、[main.ja.md:151-152・854](../specification/v0.1/main.ja.md)（DNS の `evidence_key` は正規化host）、[v0.1.md:133-134](../implementation-plan/v0.1.md) を確認した。CNAME への言及は無い。

**外部確認の結果**

- RFC 2181 §10.1 で、CNAME のラベルは DNSSEC 関連以外の data を持てないことを確認した（WebFetch）。
- workerd で `resolveTxt("www.github.com")` を実行すると、先頭に CNAME の行 `["github.com."]` を含み、続けて `github.com` の TXT を返した（計25件）。
- 1.1.1.1 の DoH も、CNAME に続けて転送先の TXT を返した（調査担当の記録）。

**最小修正案**

- [verify-url.ja.md:62](../specification/v0.1/verify-url.ja.md) を次のどちらかにする。
  - 案1: 照会名を `_accounts.{host}` のような専用ラベルにし、証明対象の host は従来どおり `{host}` とする。CNAME と共存でき、apex の既存 TXT とも分けられる。
  - 案2: host そのものに置く方式を維持し、CNAME の host では使えないことと、CNAME 先の TXT を受け付けるかを明記する。
- 同じ箇所に、DNS の反映・否定キャッシュにより直後の再検証が失敗しうる旨の案内を併記する（R18）。
- どちらの案を採るかは、実装前に仕様作成者が決める。

### R20 action_required の発生条件が未定義

- 元ID: C-1-01（要修正）、A1-07・A2-11（記載追加）
- 根拠の強さ: 中
- 区分の経緯: レビュー担当は記載追加としたが、管理者判断で要修正（軽微）とした（[8章](#8-トリアージで区分を変えた指摘と理由)）

**観察された事実**

- [verify-url.ja.md:132](../specification/v0.1/verify-url.ja.md): `not_verified` は「対象を取得・解釈できたが、期待する証拠が確認できなかった」。
- [verify-url.ja.md:133](../specification/v0.1/verify-url.ja.md): `indeterminate` は「timeout、外部のアクセス制限、…異なるAccountsユーザーへのURLの併存などにより判断できなかった」。
- [verify-url.ja.md:134](../specification/v0.1/verify-url.ja.md): `action_required` は「リンク設置や公開状態の変更など、証明のための本人操作が必要になった」。
- [main.ja.md:401](../specification/v0.1/main.ja.md) は `result` の値として `action_required` を API 契約に含め、[main.ja.md:874](../specification/v0.1/main.ja.md) も値を列挙する。発生条件はどちらにも無い。

**疑われる問題（推測）**

- 「リンク未設置」は `not_verified` にも `action_required` にも当てはまる。
- 「403」は `indeterminate`（外部のアクセス制限）にも `action_required`（公開状態の変更）にも当てはまる。
- 実装者ごとに結果値が変わる。

**発生する操作**: 初回登録でリンクを置き忘れて「保存して検証する」を押すという、最も頻繁な失敗で発生する。

**影響（推測）**

- `result` は API（[main.ja.md:401](../specification/v0.1/main.ja.md)）と JSON バックアップに現れる値である。UI・API・バックアップで値が食い違いうる。
- 照合APIの `status`（[main.ja.md:263-267](../specification/v0.1/main.ja.md)）は `result` を使わないので、Points の帰属判定には影響しない。
- `result` は一般公開と OAuth クライアントにも提供される（[main.ja.md:620](../specification/v0.1/main.ja.md)）。

**他の箇所で扱われていないことの確認結果**: [verify-url.ja.md:122・128-138・205-217](../specification/v0.1/verify-url.ja.md)、[main.ja.md:401・615-622・845・854・874](../specification/v0.1/main.ja.md)、[v0.1.md:133-135](../implementation-plan/v0.1.md) を確認した。発生条件の定義は無い。

**外部確認の結果**: 不要（文書内の確認のみ）。

**最小修正案**

- 次のどちらかを1行で書く。
  - 案1: `action_required` を `result` の値から外す。次の操作の案内は `failure_code` から導く（C-1-01 の提案）。修正箇所は [verify-url.ja.md:134](../specification/v0.1/verify-url.ja.md)、[main.ja.md:401・874](../specification/v0.1/main.ja.md)。
  - 案2: 値を残し、発生条件（どの失敗のときに `action_required` にするか）を [verify-url.ja.md:134](../specification/v0.1/verify-url.ja.md) に1行で定義する。
- どちらを採るかは仕様作成者が決める。

### R30 実装計画の互換性フラグに global_fetch_strictly_public が無い

- 元ID: B2-02、D2-05（どちらも要修正）
- 根拠の強さ: 強

**観察された事実**

- [verify-url.ja.md:115](../specification/v0.1/verify-url.ja.md) は `global_fetch_strictly_public` を使うと定める。
- [v0.1.md:66](../implementation-plan/v0.1.md) は「`compatibility_flags: ["nodejs_compat"]`を指定する」とする。
- [v0.1.md:167](../implementation-plan/v0.1.md) の確認対象も `nodejs_compat` だけである。
- [v0.1.md](../implementation-plan/v0.1.md) 全体を grep しても `global_fetch` は0件だった。
- 移行元 points-web-app の `wrangler.jsonc` には `"global_fetch_strictly_public"` がある。

**疑われる問題（推測）**: 実装計画どおりに設定すると、このフラグが抜ける。

**発生する操作**: Workers の設定ファイルを実装計画どおりに作り、同一zoneのURLを検証する操作で発生する。

**影響（推測）**: 同一zone宛ての取得が zone の origin へ送られ、Cloudflare のセキュリティ設定を迂回しうる。仕様の取得条件（[verify-url.ja.md:115](../specification/v0.1/verify-url.ja.md)）を満たさない。

**他の箇所で扱われていないことの確認結果**: [v0.1.md](../implementation-plan/v0.1.md) の全文を grep した。フラグの記述は無い。

**外部確認の結果**

- Cloudflare 互換性フラグの公式ページで、このフラグが無効なときの挙動（zone の origin へ送られ、セキュリティ設定を迂回する）を確認した。
- この項目には「Default as of」の行が無い。他のフラグにはこの行がある。このため、既定では無効と読める。
- private IP に関する記述は、この項目に無い。

**最小修正案**: [v0.1.md:66](../implementation-plan/v0.1.md) の `compatibility_flags` と [v0.1.md:167](../implementation-plan/v0.1.md) の確認対象に `global_fetch_strictly_public` を加える。

### R37 HTMLRewriterが文字参照を復号しない前提が構成に無い

- 元ID: D1-01（要修正）
- 根拠の強さ: 強

**観察された事実**

- [verify-url.ja.md:199](../specification/v0.1/verify-url.ja.md) は、要素・属性・テキストの走査に `HTMLRewriter`、本文からのURL抽出に `linkify-it` を使うと定める。
- [verify-url.ja.md:99・208](../specification/v0.1/verify-url.ja.md) は、`code`・`pre` 内のコード例だけに期待URLがある場合も一致として扱うと定める。
- [verify-url.ja.md](../specification/v0.1/verify-url.ja.md)・[v0.1.md](../implementation-plan/v0.1.md) に、文字参照の復号の記述は無い。
- 移行元の `profile-link-evidence.ts` には本文テキストの抽出が無く、`href` も復号せずに `new URL()` へ渡している。

**疑われる問題（推測）**: 復号しないテキストを linkify-it に渡すと、末尾に `&gt` などを取り込んだURLが抽出され、完全一致しない。

**発生する操作**: Zenn・Qiita の記事や Gist のコードブロック・インラインコードに、`<URL>` や `"URL"` の形で自分のAccountsプロフィールURLを書いて「保存して検証する」を押す操作で発生する。

**影響（推測）**

- 仕様が明示的に成功させるとしているコード例のケースが `not_verified` になる。
- [verify-url.ja.md:107](../specification/v0.1/verify-url.ja.md) の「異なるユーザーのURLの併存」の検出も、同じ理由で漏れうる。
- 受け入れ条件 [verify-url.ja.md:208](../specification/v0.1/verify-url.ja.md)（コード例の一致）を満たせない。

**他の箇所で扱われていないことの確認結果**: [verify-url.ja.md:93-109・193-201・208-209](../specification/v0.1/verify-url.ja.md)、[v0.1.md:133-135](../implementation-plan/v0.1.md)、移行元の `profile-link-evidence.ts` を確認した。文字参照の復号に触れた記述は無い。

**外部確認の結果**

- workerd 上で `<pre>` のテキストを連結すると、`&lt;`・`&gt;`・`&amp;`・`&#x3C;` などはそのまま返った。
- `a[href]` の `getAttribute` も `?a=1&amp;b=2&#38;c=3` のまま返った。
- linkify-it 5.0.0 で `A &lt;https://accounts.freeism.app/profiles/ausr_abc&gt; &amp;` を抽出すると、`https://accounts.freeism.app/profiles/ausr_abc&gt` になり、完全一致しなかった。
- Zenn の実ページに `<code>&lt;https://zenn.dev/__example__&gt;</code>` がある。

**最小修正案**

- [verify-url.ja.md:199](../specification/v0.1/verify-url.ja.md) に1文を加える。
  - 「テキストノードを連結してから文字参照を復号し、URL抽出器へ渡す。属性値も復号してからURLとして解決する」
- 復号に使う部品は、[verify-url.ja.md:201](../specification/v0.1/verify-url.ja.md) の方針どおり実装計画に記録する（R36）。

## 4. 記載追加が望ましい

実装者が妥当に判断できるが、仕様や実装計画に1行あると実装・案内がぶれないものである。
4.1 はトリアージの列挙の順に並べた。
4.2 は、トリアージで個別に言及されていないため、レビュー担当の区分（記載追加）を維持したものである。

### 4.1 トリアージで列挙したもの

#### R11 DNS TXTの取得手段と期限

- 事実: [verify-url.ja.md:195](../specification/v0.1/verify-url.ja.md) の工程、[verify-url.ja.md:197](../specification/v0.1/verify-url.ja.md) の共通処理、[verify-url.ja.md:199](../specification/v0.1/verify-url.ja.md) の部品のどれにも DNS が無い。[v0.1.md](../implementation-plan/v0.1.md) にも DoH・`node:dns`・`resolveTxt` の記述は無い。振る舞い（リンク不成立なら同じ要求で DNS）は [verify-url.ja.md:33・60](../specification/v0.1/verify-url.ja.md)、[main.ja.md:873](../specification/v0.1/main.ja.md)、[v0.1.md:133-134](../implementation-plan/v0.1.md) で定義済みである。
- 影響: 取得手段と DNS 照会の期限が実装者ごとに分かれる。[verify-url.ja.md:117](../specification/v0.1/verify-url.ja.md) の5秒はページ取得の期限で、DNS 照会の時間は含まない。
- 提案: 実装計画に「`node:dns/promises` の `resolveTxt`（1.1.1.1 の DoH）で取得し、DNS 照会の期限を定める」と1行加える。workerd で `resolveTxt` が動くことは確認済みである。

#### R15 DNS TXTに異なるユーザーのURLが併存する場合

- 事実: [verify-url.ja.md:107](../specification/v0.1/verify-url.ja.md) の判断不能規則はリンク証明だけを対象にする。[verify-url.ja.md:56-66](../specification/v0.1/verify-url.ja.md) に同じ規則は無い。
- 影響: ドメインの譲渡後に旧所有者の TXT が残ると、どちらのユーザーを証明するかが決まらない。発生はドメインの譲渡や再取得に限られ、新しい所有者が古い TXT を消せば止まる。
- 提案: [verify-url.ja.md:60](../specification/v0.1/verify-url.ja.md) 付近に「TXT に異なるAccountsユーザーのURLが複数ある場合は判断不能とする」と、[verify-url.ja.md:107](../specification/v0.1/verify-url.ja.md) と同じ規則を1文加える。

#### R19 既知サービスのhostでもDNS TXTを照会する

- 事実: [verify-url.ja.md:33](../specification/v0.1/verify-url.ja.md) に除外条件は無い。DNS の証明行は host をキーに保存され（[main.ja.md:854](../specification/v0.1/main.ja.md)）、方法別の結果は本人に表示される（[verify-url.ja.md:136](../specification/v0.1/verify-url.ja.md)、[main.ja.md:619](../specification/v0.1/main.ja.md)）。
- 影響: `github.com` の TXT を書けるのは運営者だけなので、乗っ取りの経路は無い（workerd の24件にも Accounts の値は無かった）。本人には実行できない DNS の案内や `dns_txt: not_verified` の表示が出る。
- 提案: 「既知サービスの host では DNS の結果と案内を出さない（または DNS へ進まない）」と1文加える。

#### R22 失敗した試行とredirect時の evidence_key

- 事実: [main.ja.md:854](../specification/v0.1/main.ja.md) は「リンクでは証拠の正規化URL」を `evidence_key` とするが、[main.ja.md:845](../specification/v0.1/main.ja.md) で NOT NULL である。取得不能やリンク不一致のときは「証拠」が無い。[verify-url.ja.md:116](../specification/v0.1/verify-url.ja.md) はどれをキーにするかを決めていない。
- 影響: 直近結果の行がどう分かれるかと表示が実装で変わる。照合と紐付けの正しさには及ばない。
- 提案: 「リンクは正規化した入力URLを `evidence_key` とし、証拠を確認したページは `evidence_url` に入れる」と1文加える。

#### R36 採用部品と参考実装のライセンス記録

- 事実: [verify-url.ja.md:201](../specification/v0.1/verify-url.ja.md) は、採用するコードや依存部品のライセンスを確認し、実装計画に記録するとする。[verify-url.ja.md:199](../specification/v0.1/verify-url.ja.md) で linkify-it の採用が決まっているが、[v0.1.md:40](../implementation-plan/v0.1.md) の依存一覧に無い。Keytrace と Divine は GitHub API 上でライセンス未設定だった。
- 影響: linkify-it の1件は、すでに [verify-url.ja.md:201](../specification/v0.1/verify-url.ja.md) の方針と合っていない。Keytrace・Divine のコードを流用すると、ライセンス上の問題になりうる。
- 提案: [v0.1.md:40](../implementation-plan/v0.1.md) に linkify-it（MIT）を加え、Keytrace・Divine は設計参照のみと1行記録する。

#### R61 Stack Overflowの質問・回答の個別対応

- 事実: [verify-url.ja.md:172](../specification/v0.1/verify-url.ja.md)、[main.ja.md:887](../specification/v0.1/main.ja.md)、[v0.1.md:135](../implementation-plan/v0.1.md) は Stack Overflow の質問・回答を個別対応に含める。[verify-url.ja.md:177](../specification/v0.1/verify-url.ja.md) は質問が403で、作者の対応を確認できなかったと記録している。同じく証拠を確認できない Reddit（[verify-url.ja.md:182](../specification/v0.1/verify-url.ja.md)）は汎用Webページ扱いである。
- 影響: curl では質問URLが常に 403（`cf-mitigated: challenge`）で、利用者から見ると常に `indeterminate` になる。Workers 環境からの取得は**未確認**である。
- 提案: 範囲の判断事項として、質問・回答を Reddit と同じ「条件を確認してから追加する」側へ移すか、残す理由を1文書くかを仕様作成者が決める。R01 の推奨案を採ると、コンテンツURLを個別対応する意味が小さくなり、この論点も小さくなる。

#### R18 DNSの反映待ちと否定キャッシュの案内

- 事実: [verify-url.ja.md:33・60](../specification/v0.1/verify-url.ja.md) で、リンク不成立時は最初の押下でも必ず DNS を照会する。[verify-url.ja.md:136](../specification/v0.1/verify-url.ja.md) に反映待ちの案内は無い。
- 影響: 「失敗して TXT の値を知る → TXT を追加 → すぐ再検証」という自然な手順で、否定応答のキャッシュにより失敗が続きうる。1.1.1.1 の TTL・否定キャッシュの具体値は未確認で、調査担当の記録（RFC 2308 など）に依拠する。
- 提案: DNS の不一致時の案内に「反映まで時間がかかる場合があるので、時間をおいて再検証する」を加える（R17 の修正と同じ箇所でよい）。

#### R25 150件の数え方

- 事実: [verify-url.ja.md:37](../specification/v0.1/verify-url.ja.md) は「Web URLは…150件」、[main.ja.md:852](../specification/v0.1/main.ja.md) は「`kind='url'`の本人行数で検査する」とする。Gist の証明で作者のプロフィールURLの行が増え（[verify-url.ja.md:166](../specification/v0.1/verify-url.ja.md)）、OAuth の例も `url` 識別子を持つ（[main.ja.md:338-341](../specification/v0.1/main.ja.md)）。
- 影響: 自動で増えるURL行や OAuth 由来のURL行を数えるか、追加前後のどちらで判定するか、上限到達時の表示が決まらない。受け入れ条件 [verify-url.ja.md:205](../specification/v0.1/verify-url.ja.md) の境界テストで解釈が問題になる。
- 提案: 数える対象、判定のタイミング（保存後に150件以下など）、上限到達時の表示を1文で定める。

#### R53 Xのウェブサイト欄はt.coになる

- 事実: curl で `x.com/OpenAI` のウェブサイト欄は `https://t.co/…`（表示は `openai.com`）、自己紹介文のリンクは展開後のURLだった。[verify-url.ja.md:183](../specification/v0.1/verify-url.ja.md) は「外部`a`リンクあり」とだけ書く。Workers 環境からは未確認である。
- 影響: 最も自然な置き場所であるウェブサイト欄に置いた利用者が `not_verified` になる。
- 提案: [verify-url.ja.md:183](../specification/v0.1/verify-url.ja.md) の制約列と本人向け案内に「ウェブサイト欄は t.co 経由のため証拠にならない。自己紹介文などに `https://` から書く」を加える。

#### R58 GitHub改名後のOAuth再ログイン時のユーザー名

- 事実: [verify-url.ja.md:163](../specification/v0.1/verify-url.ja.md) はユーザー名を検証時点の識別情報とする。[main.ja.md:532](../specification/v0.1/main.ja.md) が再ログインで更新すると定めるのは表示名だけである。`provider_username` には部分UNIQUE がある（[main.ja.md:844](../specification/v0.1/main.ja.md)）。
- 影響: 改名後に旧名を取得した別人が GitHub OAuth で連携すると、OAuth 応答のユーザー名が既存の有効な行と衝突し、実装しだいでログイン・連携が失敗しうる。
- 提案: OAuth のログイン・再連携で得たユーザー名を置き換えるか、衝突時にどうするか（移動する、またはユーザー名の保存だけ見送る）を1文で定める。

#### R59 組織アカウントの取り合い

- 事実: [verify-url.ja.md:89](../specification/v0.1/verify-url.ja.md) と [main.ja.md:133](../specification/v0.1/main.ja.md) は、Codeberg・Hugging Face の組織所有の外部アカウントを個人1人へ紐付ける。再証明で紐付け先が移る（[main.ja.md:136・875](../specification/v0.1/main.ja.md)）。
- 影響: 組織の複数メンバーが証明すると、最後に証明した人へ移る。リポジトリ1件の書込権限で組織全体の識別子を取得できうる（コラボレーターの範囲は未確認）。
- 提案: 組織識別子への適用を組織プロフィールページの証拠に限るか、「最後に証明した個人になる」ことを案内に書くかを決める。R01 の推奨案を採ると前者に近づく。

#### R55 rel="me" の出力対象

- 事実: [verify-url.ja.md:144](../specification/v0.1/verify-url.ja.md) は「外部プロフィールURL」、[main.ja.md:909](../specification/v0.1/main.ja.md) は「公開を許可された外部URL」に `rel="me"` を付けるとし、語が異なる。1つの外部アカウントが記事・Gist・リポジトリのURLや組織も持ちうる。
- 影響: コンテンツURLや組織に `rel="me"`（同一人物のプロフィールを示す関係）を付けるかが実装者ごとに分かれる。
- 提案: 「`rel="me"` は各外部アカウントのプロフィールURLにだけ付ける」と1文加え、組織アカウントの扱いも併せて決める。

#### R56 Mastodonの検証の操作順

- 事実: [verify-url.ja.md:156](../specification/v0.1/verify-url.ja.md) は Mastodon のリンク検証に触れている。調査担当の確認では、Mastodon はプロフィールの保存時に検証し、href の完全一致を求める（本レビューでは再確認していない）。
- 影響: 本人が先に Mastodon にURLを置いた時点では Accounts 側がまだ Mastodon のURLを公開していないため、Accounts で一般公開した後に Mastodon のプロフィールを保存し直さないとチェックが付かない。
- 提案: 本人向け案内に「Accounts で一般公開した後に Mastodon のプロフィールを再保存する」ことと、登録するURLの形式を書く。

#### R34 移行元のキャッシュ応答の拒否を持ち込まない

- 事実: 移行元 `safe-page-fetcher.ts:91-96` は、`Age` ヘッダーや `CF-Cache-Status` の HIT がある応答を拒否する。[verify-url.ja.md](../specification/v0.1/verify-url.ja.md) にキャッシュ応答の拒否は無い。[v0.1.md:133](../implementation-plan/v0.1.md) は移行元テストの対応付けを予定している。
- 影響: そのまま移すと、GitHub Pages など CDN のキャッシュで配信される個人サイトが常に取得失敗になる。
- 提案: 実装計画の移行項目に「キャッシュ応答の拒否は持ち込まない」と1行書く。移行元の `code`・`pre` の除外、`rel="me"` への絞り込み、UTF-8 固定は仕様と異なるが、懸念のみとする（C2-11 を含む）。

#### R41 前提とするCloudflareのプラン

- 事実: [main.ja.md](../specification/v0.1/main.ja.md)・[v0.1.md](../implementation-plan/v0.1.md) に Workers の契約プランの記載は無い。調査担当のローカル実測で、1MiB の合成HTMLを HTMLRewriter に通すと約194ms だった（参考値。本レビューでは再計測していない）。Workers Free の CPU 時間の上限は 10ms である（調査担当の確認に依拠）。
- 影響: Free プランや自己ホストでは、大きめのページの検証がリソース上限で失敗しうる。この失敗は結果として保存されない。
- 提案: 提供・技術要件か実装計画に前提とするプランを書き、1MiB 応答の解析 CPU 時間を Workers 上で計測する確認項目を加える。

#### R39 linkify-itの版とオプション

- 事実: [verify-url.ja.md:199](../specification/v0.1/verify-url.ja.md) は linkify-it の版もオプションも指定していない。調査担当が確認した CHANGELOG では、6.0 で `fuzzyLink` が既定で無効になり、Unicode の句読点でリンクが終わるようになった（本レビューでは再確認していない）。
- 影響: 5系や `fuzzyLink` 有効で使うと、日本語の句読点を取り込むなど、抽出結果が変わる。
- 提案: 実装計画に、採用する版と「`fuzzyLink: false`、`schema` が `https:` の一致だけを採用する」などのオプションを記録する。

#### R38・R29 テキストノード単位の連結と除外範囲

- 事実: [verify-url.ja.md:199](../specification/v0.1/verify-url.ja.md) が扱うのはチャンクの分割だけである。調査担当の実測では、`<!-- -->`・`<wbr>`・inline 要素でテキストノードが分かれた（本レビューでは再確認していない）。[verify-url.ja.md:99・105](../specification/v0.1/verify-url.ja.md) の「可視テキスト」と除外範囲に、`template`・`noscript`・`hidden` の扱いが無い。HTMLRewriter は CSS を評価しない。
- 影響: どこまで連結し、どこを除外するかで、テストの期待値が決まらない。
- 提案: 「チャンクを連結したテキストノード単位で抽出し、要素・コメントをまたいで連結しない」ことと、`template`・`noscript`・`hidden` を除外するかを1〜2文で書く。

#### R44 hostの末尾ドット

- 事実: 移行元 `normalize-identity-url.ts:45` は末尾ドットの host を拒否する。WHATWG URL は `github.com.` を保持する（node で確認）。[verify-url.ja.md:39-54](../specification/v0.1/verify-url.ja.md) に記述は無い。
- 影響: `github.com.` が既知サービスと判定されず、同じページを重複登録できる。単独での悪用価値は低い。
- 提案: URL正規化の節に「末尾ドットの host は拒否する」と1行加える。

#### R06 ユーザー単位の頻度制限

- 事実: [main.ja.md:557](../specification/v0.1/main.ja.md) は、v0.1 の検証頻度制御に WAF の IP などの集計キーを採用すると明示している。150件（[verify-url.ja.md:37](../specification/v0.1/verify-url.ja.md)）は登録数の上限で、頻度の上限ではない。1回の要求で最大4回のHTTP取得と1回の DNS 照会がある。
- 影響: ログイン済みの1利用者が複数IPで繰り返し検証すると、外部サービスが送信元IPに課す匿名アクセス制限を使い切り、他の利用者の検証が `indeterminate` になり続けうる（外部サービスの挙動は未確認）。
- 提案: ユーザー単位の緩い上限（Workers Rate Limiting binding でユーザーIDをキーにするなど）を加えるか、IP 単位で足りる理由を [main.ja.md:557](../specification/v0.1/main.ja.md) に1文書くかを仕様作成者が決める。

#### R46 監査ログでの移動の追跡

- 事実: [main.ja.md:608](../specification/v0.1/main.ja.md) は「Web URLの紐付け先更新を監査する」とする。[main.ja.md:611](../specification/v0.1/main.ja.md) は AccountsユーザーID・外部URLをログへ出力しないとする。[main.ja.md:875](../specification/v0.1/main.ja.md) は移動時に旧所有者の行を削除する。
- 影響: 横取りの申告を受けても、いつ誰から誰へ移ったかを確認できない。
- 提案: 移動の履歴をどこに残すか（ログではなくDBの監査用テーブルなど）を1文で決める。

#### R32 公開プロフィールURLのoriginの設定値

- 事実: [verify-url.ja.md:58](../specification/v0.1/verify-url.ja.md) は期待URLを `https://accounts.freeism.app/profiles/{accountsUserId}` とし、互換サービスはそのサービスの origin を使うとする。origin の決め方は書かれていない。移行元 `verify-web-ownership.ts:18-20` は origin を直書きしている。
- 影響: 要求の Host から origin を組み立てると、`*.workers.dev` や Preview の hostname で期待URLが変わる。本番での悪用の可能性は低い。
- 提案: [verify-url.ja.md:58](../specification/v0.1/verify-url.ja.md) に「origin は環境設定の公開 origin とし、要求の Host からは決めない」と1文加える。

#### R24 「未検証で保存」の検査範囲

- 事実: [verify-url.ja.md:30](../specification/v0.1/verify-url.ja.md) は「未検証で保存」を1文で定めるだけで、[verify-url.ja.md:31](../specification/v0.1/verify-url.ja.md) 以降は「保存して検証する」を前提にしている。
- 影響: 正規化・安全性検査・サービス判定・150件の検査を行うか、検証済みURLを未検証で保存し直したときに何をするかが決まらない。後者を誤ると紐付けが外れうる。
- 提案: 「未検証で保存も構文・安全性の検査、サービス判定、150件の検査を行い、外部取得と DNS 照会は行わない。既存の登録・証明は変更しない」と1文加える。

#### R23 redirect先の安全性違反の分類

- 事実: [verify-url.ja.md:122](../specification/v0.1/verify-url.ja.md) は「取得先の安全性の不備は入力エラー」とし、「取得不能」は DNS へ進むとする。[verify-url.ja.md:114](../specification/v0.1/verify-url.ja.md) は redirect 先も検査する。redirect 先の違反がどちらに当たるかは書かれていない。移行元 `safe-page-fetcher.ts:83-87` は入力と同じ `WEB_URL_UNSAFE` を返す。
- 影響: redirect 先が private アドレスだった場合に、入力エラーで保存しないか、リンク失敗として DNS へ進むかが実装で分かれる。
- 提案: [verify-url.ja.md:122](../specification/v0.1/verify-url.ja.md) に「入力エラーは入力URL自体の不備に限り、redirect 先の違反はリンク検証の失敗として DNS へ進む」（またはその逆）を1文で書く。

### 4.2 レビュー担当の区分を維持したもの

#### R04 判断不能規則を使った新規検証の妨害

- 事実: [verify-url.ja.md:107](../specification/v0.1/verify-url.ja.md) の「異なるユーザーを示すURL」が、実在するユーザーに限られるかは書かれていない。[verify-url.ja.md:138](../specification/v0.1/verify-url.ja.md) は証拠ページの整理を案内するが、整理できない場合は書かれていない。
- 影響: 本人がコメントを消せないページ（他人のプロジェクトの MR など）で、攻撃者がコメントで別のURLを書くと、新規のリンク検証が `indeterminate` になり続ける。既存の紐付けは維持される。R01 を直すと主な経路は小さくなる。
- 提案: 数える対象を実在するユーザーのURLに限るかを1文で書く。

#### R09 自己ホスト型サービスのv0.1での扱い

- 事実: [verify-url.ja.md:77・191](../specification/v0.1/verify-url.ja.md) は自己ホスト型（Mastodon など）の扱いに触れるが、[verify-url.ja.md:172](../specification/v0.1/verify-url.ja.md) と [main.ja.md:887](../specification/v0.1/main.ja.md) の個別対応の一覧に Mastodon は無い。[main.ja.md:419](../specification/v0.1/main.ja.md) は自己ホスト型の Provider に `issuer` を必須とする。
- 影響: Mastodon のURLを汎用Webページとして扱うか、`issuer` 付きで識別するかが実装者ごとに分かれる。
- 提案: 「v0.1 では自己ホスト型は汎用Webページとして登録・検証する」などを1文で書く。

#### R12 TXT値の比較方法

- 事実: [verify-url.ja.md:41](../specification/v0.1/verify-url.ja.md) の正規化の対象に TXT の値が無い。[verify-url.ja.md:58・60](../specification/v0.1/verify-url.ja.md) は「一致を確認」とだけ書く。workerd の `resolveTxt` は character-string ごとの配列を返し、CNAME の行も混ざる（実行で確認）。
- 影響: 生文字列の一致か、連結・正規化後の一致かが実装で分かれる。部分一致を採ると完全一致の原則（[verify-url.ja.md:52](../specification/v0.1/verify-url.ja.md)）とずれる。
- 提案: 「各レコードの character-string を連結し、URL正規化を適用して完全一致を判定する」と1文加える。

#### R13 DNSの失敗の分類と期限

- 事実: [verify-url.ja.md:133](../specification/v0.1/verify-url.ja.md) の `indeterminate` の例は取得系だけである。workerd では存在しない名前が `ENOTFOUND` になった。
- 影響: SERVFAIL・timeout と NXDOMAIN・NODATA を `indeterminate` と `not_verified` のどちらにするかが分かれる。
- 提案: DNS の失敗の分類と期限を1文で書く（R11 と同じ箇所でよい）。

#### R31 公開ホスト名がprivate IPへ解決される場合の防御

- 事実: Cloudflare の公式のフラグ説明に private IP の記述は無い（WebFetch で確認）。公開ドメインが private IP へ解決される場合の Workers の挙動は未確認である。
- 影響: この防御は基盤の挙動だけが頼りになる。影響は小さいと推測するが、証拠が不十分である。
- 提案: 実装計画に「private IP へ解決される公開ドメインへの取得を Workers 上でテストする」確認項目を加える。

#### R48 照合APIのURL入力に取得先の制約を適用するか

- 事実: [verify-url.ja.md:41・44・48](../specification/v0.1/verify-url.ja.md) は、登録URLと照合の入力URLに同じ正規化を適用し、外部URLの受付に取得先の制約を適用するとする。[main.ja.md:441](../specification/v0.1/main.ja.md) の `INVALID_VALUE` は「URL形式など」とする。
- 影響: 利用側が `http://` や `localhost` のURLを照合したときに、`invalid_input` と `no_match` のどちらになるかが分かれる。
- 提案: 照合の入力に適用する検査の範囲を1文で書く。

#### R52 証明に使う値を検証前に表示する

- 事実: [verify-url.ja.md:136](../specification/v0.1/verify-url.ja.md) は検証後の案内だけを定め、検証前に本人のプロフィールURL（TXT の値を兼ねる）を表示・コピーする導線は無い。
- 影響: 本人は1回失敗しないと置くべき値が分からない。DNS では、その1回目の照会が否定キャッシュを生む（R18）。
- 提案: 「アカウント連携」画面の入力欄の近くに、本人のプロフィールURLとコピー操作を表示すると1文加える。

#### R60 GitHubの組織ページの扱い

- 事実: [verify-url.ja.md:162](../specification/v0.1/verify-url.ja.md) は `github.com/{username}` をプロフィールとする。調査担当の実測で `github.com/cloudflare` が同じ形式で組織ページだった。GitLab はグループを個人プロフィールにしない（[verify-url.ja.md:176](../specification/v0.1/verify-url.ja.md)）。[main.ja.md:133](../specification/v0.1/main.ja.md) の組織の許容は Codeberg・Hugging Face に限る。
- 影響: GitHub の組織URLを個人のユーザー名として保存するか、拒否するかが分かれる。
- 提案: GitHub の組織ページの扱いを1文で書く。

## 5. 懸念のみ

現実的なフローでの実害が小さいもの、または仕様の意図として読めるものである。
いずれも**修正は不要**である。
5.1 はトリアージの列挙の順、5.2 はレビュー担当の区分（懸念のみ）を維持したものである。

### 5.1 トリアージで列挙したもの

#### R10 「紐付け先の更新」の正本の循環参照

- 事実: [verify-url.ja.md:24](../specification/v0.1/verify-url.ja.md) は紐付け先の更新を [main.ja.md](../specification/v0.1/main.ja.md) が正とし、[main.ja.md:150](../specification/v0.1/main.ja.md) は「登録・検証・紐付け先の更新は、[Webページの検証仕様]に従う」とする。
- 懸念のみとする理由: 更新規則の実体は、[main.ja.md:150](../specification/v0.1/main.ja.md) と同じ節の [main.ja.md:136・140](../specification/v0.1/main.ja.md) と、[main.ja.md:875](../specification/v0.1/main.ja.md) にある。読み手がたどれないほどではなく、実装への影響は無い。修正は不要である。

#### R21 手順5「いずれも成立しなければ入力URLを未検証として保存する」の文言

- 事実: [verify-url.ja.md:34](../specification/v0.1/verify-url.ja.md) と [v0.1.md:133](../implementation-plan/v0.1.md) に同じ文言がある。
- 懸念のみとする理由: 同じ文書の [verify-url.ja.md:60・215](../specification/v0.1/verify-url.ja.md) と [main.ja.md:135・874](../specification/v0.1/main.ja.md) が、再検証の失敗で既存の紐付けを維持すると明記している。`unverified` は登録状態（[verify-url.ja.md:130](../specification/v0.1/verify-url.ja.md)）で、`verificationStatus` は有効な証明の有無を表す（[main.ja.md:397](../specification/v0.1/main.ja.md)）。どちらの定義からも、証明済みの行が未検証へ戻るとは導けない。修正は不要である。

#### B1-06（R45）pathの大文字小文字・www・queryの順序

- 事実: [verify-url.ja.md:43-47・64](../specification/v0.1/verify-url.ja.md) は scheme・host だけを小文字化し、path・query の意味と `www` の有無を区別する。
- 懸念のみとする理由: 同じページが別の識別子になっても、攻撃者が各キーを得るにはそのページでの証拠が要り、横取りは起きない。影響は照合の `no_match` という使い勝手に限られる。個別対応サービスのプロフィールURLの正規形は、R08 の表で決めればよい。修正は不要である。

#### B2-08（R32の一部）互換サービスのorigin

- 事実: [verify-url.ja.md:58](../specification/v0.1/verify-url.ja.md) は、互換サービスではそのサービスの origin を用いた公開プロフィールURLを期待値とする。
- 懸念のみとする理由: 互換サービスの origin は各インスタンスの設定値で決まるため、別インスタンスのURLで証明が通ることは無く、新しい攻撃面は見当たらない。origin を設定値から決める点は R32 で扱う。修正は不要である。

#### C2-09 作者名の大文字小文字とusername省略形

- 事実: `github.com/Torvalds` などの大文字表記も同じアカウントを表す（調査担当の実測）。`gist.github.com/{id}` はユーザー名付きのURLへ302する。
- 懸念のみとする理由: 大文字小文字は R08 のユーザー名の正規化、username 省略の Gist は R03 の「最終取得URLに適用する」規則で解消する。GitHub が大文字小文字の非区別を公式に明示しているかは未確認である。修正は不要である。

#### C2-11（R34の一部）移行元の証拠抽出は仕様と異なる

- 事実: 移行元 `profile-link-evidence.ts` は、`rel="me"` の候補があればそれだけに絞り、`code`・`pre` を除外し、本文テキストのURLを抽出しない。[verify-url.ja.md:99・102](../specification/v0.1/verify-url.ja.md) はその逆を定める。
- 懸念のみとする理由: 仕様は正しい。移植時にこの絞り込みを持ち込まないことは実装時の注意であり、キャッシュ応答の拒否（R34）と同じ移行項目で扱える。修正は不要である。

#### D2-06（R28）Cloudflare依存と上位目標

- 事実: [上位目標のmain.ja.md:8-9](../specification/main.ja.md) は「OSSで提供」「依存せず、すぐ移行できる」の2行だけである。[verify-url.ja.md:115・199](../specification/v0.1/verify-url.ja.md) などは Cloudflare 固有の機能を使う。
- 懸念のみとする理由: [main.ja.md:57・628](../specification/v0.1/main.ja.md) などの文脈から、「依存せず」は利用者が特定の運営者に囲い込まれないことと読め、実行基盤の選定とは直接衝突しない。証拠の置き直しは v0.2 の DID 対応で解消する計画である。修正は不要である。

#### R40 日本語に接したURLの抽出

- 事実: 検証担当が linkify-it 5.0.0 の既定設定で実行すると、`プロフィールはhttps://accounts.freeism.app/profiles/ausr_abcです` から抽出されたURLは0件だった。
- 懸念のみとする理由: 完全一致の方針として妥当な挙動である。自動リンクされた `<a href>` は影響を受けない。検証担当は案内文の追加（記載追加）を提案したが、トリアージでは懸念のみとした。修正は不要である。

#### B2-09（R19の一部）既知サービスのhostでのDNS照会の安全性

- 事実: `github.com` の TXT を制御できるのはサービス運営者だけで、workerd の実行でも Accounts の値は無かった。
- 懸念のみとする理由: DNS 経由で他人の識別子を取る現実的な経路は無い。表示と案内の問題は R19 で扱う。修正は不要である。

### 5.2 レビュー担当の区分を維持したもの

| 統合ID | 内容 | 事実と、懸念のみとする理由（修正は不要） |
| --- | --- | --- |
| R14 | DNS成功時の `evidenceUrl` | [main.ja.md:401](../specification/v0.1/main.ja.md) は「公開証拠のURLを示せる場合に`evidenceUrl`を返す」とし、DNS では null とする読みが自然である |
| R26 | 受け入れ条件と本文の列挙差 | [verify-url.ja.md:105](../specification/v0.1/verify-url.ja.md) には `style` があり、[verify-url.ja.md:209](../specification/v0.1/verify-url.ja.md) には無い。受け入れ条件は例示として読め、実装への影響は小さい |
| R27 | `bidirectional_link` の名称と片方向の証明 | [main.ja.md:399](../specification/v0.1/main.ja.md)・[verify-url.ja.md:126](../specification/v0.1/verify-url.ja.md) の名称に対し、実際の証明は外部ページから Accounts への片方向である。未リリースなので改名するなら安い |
| R33 | Accounts自身のoriginを外部URLとして受け付ける | [verify-url.ja.md:113-114](../specification/v0.1/verify-url.ja.md) に除外規定は無いが、実害は見当たらない |
| R42 | 1MiBは展開後のバイト数か | [verify-url.ja.md:117](../specification/v0.1/verify-url.ja.md)。Workers で読み取れるのは展開後のバイト列なので、実装は自然に展開後で数える |
| R43 | JavaScriptが必要なページの「確認できる範囲を結果に示す」 | [verify-url.ja.md:120](../specification/v0.1/verify-url.ja.md)。結果の示し方の問題で、判定には影響しない |
| R47 | 証拠URLの公開 | [main.ja.md:877](../specification/v0.1/main.ja.md)。問題は見当たらない |
| R49 | プロフィールURLの例がID形式と合わない | [verify-url.ja.md:52](../specification/v0.1/verify-url.ja.md) の `…/profiles/alice` は、[main.ja.md:810](../specification/v0.1/main.ja.md) の `ausr_…` 形式と合わない。例示であり実装への影響は無い |
| R51 | 照合入力の説明が「プロフィールURL」と狭い | [main.ja.md:198](../specification/v0.1/main.ja.md) と [main.ja.md:209・410](../specification/v0.1/main.ja.md) の表現差。実装への影響は無い |
| R54 | 再検証の一時的な失敗が公開面に出るか | [main.ja.md:620](../specification/v0.1/main.ja.md) と [main.ja.md:399・401](../specification/v0.1/main.ja.md) は、一般公開・クライアント向けに直近の `checkedAt`・`result` を出すと決めている。出すべきかは設計判断で、不明ではない |
| R57 | GitHub OAuth行へのリンク証明の統合 | [main.ja.md:844](../specification/v0.1/main.ja.md) の UNIQUE `(user_id, kind, provider, issuer, value)` で結果が決まる |
| R62 | 実装計画のフェーズ分割 | [v0.1.md:16・133-135](../implementation-plan/v0.1.md)。分割の粒度は実装時に調整できる |

確認のみで懸念なし: R63（[v0.1.md:133-135](../implementation-plan/v0.1.md) と [verify-url.ja.md](../specification/v0.1/verify-url.ja.md) の対応）。対応に問題は無かった。

## 6. 付記

本レビューの対象外の文書だが、確認の過程で見つけたため記録する。

- R50 v0.3 文書のリンク切れ（元ID A2-17）
  - [specification/v0.3/main.ja.md:13・23](../specification/v0.3/main.ja.md) の `../v0.1/main.md` と、[specification/v0.3/main.ja.md:26](../specification/v0.3/main.ja.md) の `../../implementation-plan/v0.3.md` は実在しない。
  - v0.1 のファイルは `main.ja.md`・`verify-url.ja.md`、実装計画は `v0.1.md`・`v0.2.md` だけである。
  - 同じ A2-17 には、v0.3 の「文言一致の拡張」が v0.1 の完全一致の原則と逆向きである点と、v0.3 の Web検証の説明に DNS が無い点も含まれる（懸念のみ）。
- Points 側文書のリンク切れと文言の不一致
  - points-web-app の docs 配下に、実在しない `accounts-web-app/docs/specification/v0.1/main.md` へのリンクが11箇所ある（実体は `main.ja.md`）。
  - [unclaimed-fix-and-ownership.md:44](../../../points-web-app/docs/v0.2/details-ja/unclaimed-fix-and-ownership.md) は「編集可能Webページのリンク検証」と書いている。これは [main.ja.md:551](../specification/v0.1/main.ja.md) の「ページの編集権限の確認を示すものではない」と意味が食い違う。
  - R01 を直す際に、Points 側の表現も合わせるのがよい。

## 7. 統合指摘の全一覧

REVIEW（レビュー担当の統合一覧 1-1・1-2 節）から機械的に転記した。
最終区分はトリアージの結果である。
トリアージでレビュー担当の区分を上書きしたものは、備考に「管理者判断で変更」と書いた。
R35 は統合一覧に存在しない欠番である。

| 統合ID | 元ID | タイトル | 最終区分 | 備考 |
| --- | --- | --- | --- | --- |
| R01 | A1-02、B1-01、B2-01、C2-01 | 第三者コメントの証拠で、コンテンツ作者のユーザー名・プロフィールURLを取得できる | 要修正 | 仕様作成者の判断事項あり |
| R02 | B1-02（B2-01末尾・C2-01の一部） | リンク証明1回で、他ユーザーの有効な紐付けが即時に移動する | 要修正 | 管理者判断で変更（レビュー担当は記載追加） |
| R03 | B1-03、C2-02、C2-09の一部 | redirect後に作者が変わるのに、入力URLから作者を決めうる | 要修正 | 軽微 |
| R04 | B1-04 | 判断不能規則を使った新規検証の妨害 | 記載追加が望ましい | |
| R05 | A1-01、A2-06 | 頻度制限の参照先アンカーの誤り | 要修正 | |
| R06 | B1-07 | 頻度制御がIP単位だけ | 記載追加が望ましい | 管理者判断で変更（レビュー担当は懸念のみ） |
| R07 | A1-03、A2-07、A2-12 | M1の証明方法の列挙にDNS TXTが反映されていない | 要修正 | |
| R08 | A1-04、A2-05（B1-06・C2-09も関連） | Provider識別子の値とユーザー名の正規化がどこにも定義されていない | 要修正 | |
| R09 | A2-08、A1-04後半 | 自己ホスト型（Mastodon）のv0.1での扱い | 記載追加が望ましい | |
| R10 | A1-05、A1-15、A2-16 | 「紐付け先の更新」の正本の循環参照 | 懸念のみ | |
| R11 | A2-01、A1-12、B2-06（取得手段）、D2-01、D2-08 | DNS TXTの取得手段と「検証処理の構成」の欠落 | 記載追加が望ましい | |
| R12 | A1-06(2)、B2-06（比較）、D2-02、C-1-13 | TXT値の比較方法（正規化・連結・複数レコード） | 記載追加が望ましい | |
| R13 | A2-10(2)、B2-06（分類・時間）、D2-04、D1-09 | DNS失敗の分類と期限 | 記載追加が望ましい | |
| R14 | A1-06(3) | DNS成功時の`evidenceUrl` | 懸念のみ | |
| R15 | B2-04、A1-06(4) | DNS TXTに異なるAccountsユーザーのURLが併存する場合の規則がない | 記載追加が望ましい | |
| R16 | A2-04、A1-06(1) | DNS成功時に、別々の外部アカウント行にある同じhostのURLへどう対応付けるかが決まらない | 要修正 | 仕様作成者の判断事項あり |
| R17 | B2-05、C-1-02、D2-02のCNAME部分 | TXTを「hostそのもの」に置く設計はCNAMEのhostで設定できない | 要修正 | 仕様作成者の判断事項あり |
| R18 | B2-07、C-1-03、D2-03 | DNSキャッシュでTXT追加直後の再検証が失敗しうる | 記載追加が望ましい | |
| R19 | C-1-04、C2-08、B2-09 | 個別対応サービスのhost（github.com・x.com等）でもDNS TXTを照会する | 記載追加が望ましい | B2-09の安全性の論点は懸念のみ |
| R20 | C-1-01、A1-07、A2-11 | `action_required`の発生条件が未定義 | 要修正 | 管理者判断で変更（レビュー担当は記載追加）。軽微。仕様作成者の判断事項あり |
| R21 | A2-02、C-1-12 | 手順5「いずれも成立しなければ入力URLを未検証として保存する」の文言 | 懸念のみ | |
| R22 | A2-03、A1-09後半 | 失敗したリンク試行とredirect時の`evidence_key` | 記載追加が望ましい | |
| R23 | A1-09前半、B2-12 | redirect先の安全性違反を入力エラーと取得失敗のどちらにするか | 記載追加が望ましい | |
| R24 | A1-08、C-1-05、D2-08（未検証で保存） | 「未検証で保存」の処理範囲と再検証の導線 | 記載追加が望ましい | |
| R25 | A1-10、C-1-06 | 150件の数え方（OAuth由来・自動追加URLを含むか） | 記載追加が望ましい | |
| R26 | A1-14、A2-10(1,3,4,5) | 受け入れ条件と本文の列挙差（`style`など） | 懸念のみ | |
| R27 | A1-16、A2-13、A2-14 | `bidirectional_link`の名称と片方向の証明、用語ゆれ | 懸念のみ | |
| R28 | A1-17、D2-06 | 上位目標「依存せず、すぐ移行できる」との関係 | 懸念のみ | |
| R29 | A1-18、D1-03 | 「可視テキスト」と除外範囲（hidden・template・noscript・JSON） | 記載追加が望ましい | |
| R30 | B2-02、D2-05 | 実装計画の互換性フラグに`global_fetch_strictly_public`がない | 要修正 | |
| R31 | B2-03、D1-08の一部 | 公開ホスト名がprivate IPへ解決される場合の防御 | 記載追加が望ましい | |
| R32 | B2-08、D2-07 | 期待するプロフィールURLのoriginを設定値から決めることが未記載 | 記載追加が望ましい | B2-08の互換サービスoriginの論点は懸念のみ |
| R33 | B2-11 | Accounts自身のoriginを外部URLとして受け付ける | 懸念のみ | |
| R34 | B2-10、D1-13、D2-10、C2-11、D1-04、D1-07、D1-08、D1-14 | 移行元にあって仕様と合わない挙動と流用できる部品 | 記載追加が望ましい | キャッシュ応答の拒否を持ち込まない点が記載追加。C2-11などその他は懸念のみ |
| R36 | D2-11、C2-10、A1-13 | 参考実装・採用部品のライセンス記録 | 記載追加が望ましい | |
| R37 | D1-01 | HTMLRewriterはテキスト・属性値の文字参照を復号しない | 要修正 | |
| R38 | D1-02 | テキストノードの分割（inline要素・`<wbr>`・コメント） | 記載追加が望ましい | |
| R39 | D1-05 | linkify-itの版とオプション | 記載追加が望ましい | |
| R40 | D1-06 | 日本語に接したURLの抽出 | 懸念のみ | 検証担当は記載追加を提案したが、トリアージで懸念のみ |
| R41 | D1-10、D2-12 | Workers FreeのCPU 10msでは1MiB級の解析が収まらない見込み | 記載追加が望ましい | |
| R42 | D1-11 | 1MiBは展開後のバイト数か | 懸念のみ | |
| R43 | D1-12 | JSが必要なページの「確認できる範囲を結果に示す」は判定不能 | 懸念のみ | |
| R44 | B1-05 | host末尾のドット | 記載追加が望ましい | |
| R45 | B1-06 | pathの大文字小文字・www・query順で同一ページが多重キーになる | 懸念のみ | |
| R46 | B1-08 | ログ方針の下では紐付け先の移動を事後に追えない | 記載追加が望ましい | |
| R47 | B1-09 | 証拠URLの公開 | 懸念のみ | |
| R48 | A2-09 | 照合APIのURL入力に取得先の制約を適用するか | 記載追加が望ましい | |
| R49 | A2-15 | プロフィールURL例`…/profiles/alice`がID形式と合わない | 懸念のみ | |
| R50 | A2-17 | v0.3文書のリンク切れ | 付記 | v0.1の対象外 |
| R51 | A2-18 | M1:198の照合入力が「プロフィールURL」と狭い | 懸念のみ | |
| R52 | C-1-07 | 証明に使う値を検証前に表示・コピーする導線がない | 記載追加が望ましい | |
| R53 | C-1-08、C2-04 | XのWebsite欄はt.coになり、証拠にならない | 記載追加が望ましい | |
| R54 | C-1-09 | 再検証の一時的な失敗が公開面に出るか | 懸念のみ | |
| R55 | C-1-10 | `rel="me"`を付ける対象（コンテンツURL・組織） | 記載追加が望ましい | |
| R56 | C-1-11 | Mastodonの緑チェックの操作順とURL形式の案内 | 記載追加が望ましい | |
| R57 | C-1-14 | GitHub OAuth行へのリンク証明の統合 | 懸念のみ | |
| R58 | C2-05 | GitHub改名後の旧名の再取得と、OAuth由来ユーザー名の衝突 | 記載追加が望ましい | |
| R59 | C2-06 | 組織アカウントを個人1人へ紐付ける意味と、書込権限者による取得 | 記載追加が望ましい | |
| R60 | C2-07 | GitHub組織ページの扱い | 記載追加が望ましい | |
| R61 | C2-03 | Stack Overflowの質問・回答を個別対応に含めているが、匿名取得は403 | 記載追加が望ましい | 管理者判断で変更（レビュー担当は要修正）。範囲の判断事項 |
| R62 | D2-09 | 実装計画のフェーズ分割 | 懸念のみ | |
| R63 | A1-11 | PL:133-135とVUの対応 | 懸念なし | 確認のみ |

## 8. トリアージで区分を変えた指摘と理由

### 8.1 要修正へ上げたもの

#### R02（レビュー担当: 記載追加 → 最終: 要修正）

- レビュー担当は、R01 を直せば残る経路は「コメント欄のある汎用ページ」だけで、[main.ja.md:142・551](../specification/v0.1/main.ja.md) が意図的に受け入れた範囲だとして、記載追加に下げた。
- 管理者判断で要修正に戻した。理由は次のとおりである。
  - 検証担当が確認したとおり、[main.ja.md:142・551](../specification/v0.1/main.ja.md) は `verified` の意味しか述べていない。DNS TXT で証明済みのURLを、コメント1件のリンク証明で移動してよいとはどこにも書かれていない。
  - [main.ja.md:875](../specification/v0.1/main.ja.md) は、移動時に旧所有者の識別子行と「全証明との関連」を削除するため、DNS 証明まで失われる。
  - WordPress など、静的HTMLにコメントが載るブログは一般的で、Points の帰属という攻撃の動機もある。
  - R01 の修正では、入力URLそのものの移動はふさがらない。このため R01 と独立に必要である。

#### R20（レビュー担当: 記載追加 → 最終: 要修正（軽微））

- レビュー担当は、照合APIの `status`（[main.ja.md:263-267](../specification/v0.1/main.ja.md)）が `result` を使わず、Points の帰属判定に影響しないとして、記載追加に下げた。
- 管理者判断で要修正（軽微）とした。理由は次のとおりである。
  - `action_required` は API 契約（[main.ja.md:401](../specification/v0.1/main.ja.md)）と JSON バックアップに現れる値である。
  - 発生条件が無いままでは実装者が決められず、UI・API・バックアップで値が食い違う。
  - 1行で条件を定義するか、値を削除すれば足りる。

### 8.2 下げたもの

報告者が要修正とした指摘のうち、最終区分を要修正より下げたものである。
R61 はトリアージでレビュー担当の区分から下げた。
それ以外は、レビュー担当が下げた区分をトリアージで維持した。

| 統合ID | 元ID（報告者の区分） | 最終区分 | 理由 |
| --- | --- | --- | --- |
| R61 | C2-03（要修正） | 記載追加が望ましい | レビュー担当は要修正としたが、管理者判断で下げた。Stack Overflow の質問・回答が常に403であることは事実だが、仕様作成者は403を承知で含め、[verify-url.ja.md:177](../specification/v0.1/verify-url.ja.md) で「取得制限時は判断不能とする」と扱いを定めている。正しさや安全性の欠陥ではなく、範囲の判断事項である。レビュー担当自身も「範囲の判断事項」と書きながら要修正としており、区分が整合していなかった（検証担当の指摘）。R01 の推奨案を採ると、コンテンツURLを個別対応する意味が小さくなり、この論点も小さくなる |
| R11 | A2-01（要修正） | 記載追加が望ましい | 振る舞い（リンク不成立なら同じ要求で DNS）は [verify-url.ja.md:33・60](../specification/v0.1/verify-url.ja.md)、[main.ja.md:873](../specification/v0.1/main.ja.md)、[v0.1.md:133-134](../implementation-plan/v0.1.md) で定義済みである。欠けているのは取得手段（`node:dns/promises` の `resolveTxt`、DoH）と期限の選択で、実装計画への1行で足りる。`resolveTxt` が workerd で動くことも確認した |
| R15 | B2-04（要修正） | 記載追加が望ましい | TXT を書けるのはゾーン管理者だけで、発生はドメインの譲渡後の TXT の消し忘れに限られる。新しい所有者が古い TXT を消せば解消する。[verify-url.ja.md:107](../specification/v0.1/verify-url.ja.md) と同じ規則を1文足せば済む |
| R19 | C-1-04（要修正） | 記載追加が望ましい | `github.com` の TXT を書けるのは運営者だけで、乗っ取りの経路は無い。残るのは案内と表示の問題で、「既知サービスの host では DNS の案内を出さない」の1文で足りる |
| R22 | A2-03（要修正） | 記載追加が望ましい | 影響は直近結果の行の分かれ方と表示に限られ、照合と紐付けの正しさには及ばない。「失敗時の `evidence_key` は正規化した入力URL」の1文で解消する |
| R36 | D2-11（要修正） | 記載追加が望ましい | [verify-url.ja.md:201](../specification/v0.1/verify-url.ja.md) の記録義務は採用時に生じる。linkify-it は採用済みなのに [v0.1.md:40](../implementation-plan/v0.1.md) の依存一覧に無く、この1件は方針と合っていない（検証担当の訂正）。ただし記録を1行足せば済む。Keytrace・Divine はライセンス未設定のため、設計参照のみとする |
| R21 | A2-02（要修正） | 懸念のみ | [verify-url.ja.md:60・215](../specification/v0.1/verify-url.ja.md) と [main.ja.md:135・874](../specification/v0.1/main.ja.md) が再検証の失敗で既存の紐付けを維持すると明記している。`unverified`（[verify-url.ja.md:130](../specification/v0.1/verify-url.ja.md)）と `verificationStatus`（[main.ja.md:397](../specification/v0.1/main.ja.md)）の定義からも、証明済みの行が未検証へ戻るとは導けない |
| R10 | A1-05（要修正・軽微） | 懸念のみ | 更新規則の実体は、[main.ja.md:150](../specification/v0.1/main.ja.md) と同じ節の [main.ja.md:136・140](../specification/v0.1/main.ja.md) と、[main.ja.md:875](../specification/v0.1/main.ja.md) にある。読み手がたどれないほどではなく、実装への影響は無い |
