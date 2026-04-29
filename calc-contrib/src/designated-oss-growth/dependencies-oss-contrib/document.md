# dependencies-oss-contribution

## 概要

- 「指定 OSS が使用している（依存している）GitHub OSS」による「指定 OSS の発展」への貢献度を分析
- 実装をシンプルにするために、各依存ライブラリごとに恣意的な数値を入力して評価する
  - 今後は静的解析や他の指標を指標して評価できるようにしたい

## 使い方

```shell
./main.sh [option] [path]
```

- path

  - `path`に、指定フォーマットの使用 OSS の一覧の JSON ファイルの PATH を指定する
  - その JSON ファイルの形式は、以下の形式であれば OK！
    ```json
    {
      "data":[
        {a},{b},{},...
      ]
    }
    ```

- オプション
  - `-d`,`--default`
    - デフォルト値を記載する
  - `-c`,`--calc`
    - 記載した貢献度で算出する

## 出力形式

```json
{
	"meta": {
		"createdAt": "2025-08-20",
		"specified-oss": {
			"owner": "ryoppippi",
			"Repository": "ccusage"
		}
	},
	"data": [
		{
			"host": "gitlab.com",
			"owner": "group",
			"repo": "lib-b",
			"evaluation": {
				"result": 3
				"evaluationCriteria": {
					"timeResources": 3
				}
			}
		},
		{
			"host": "github.com",
			"owner": "acme",
			"repo": "lib-a",
			"package_manager_url": "pack-D",
			"homepage": "page-p",
			"repository_url": "git/e"
		}
	]
}
```

## 仕様

1. `dependencies_json` に、`config_json` の key と value の値が入っていない data 配列の要素には、config_json の key と value の値を、key-value オブジェクトとして出力形式を参考に入れる
2. 入れた config_json の key と value の値をもとに、平均値を算出して、evaluation.result に記載する
3. すでに config_json の key と value の値が入っている場合は、平均値を再計算する
   後から key と value の値を修正して再計算したいため
4. config.json で、"enabled"が true 以外の文言の場合は、そのキーは、dependencies_json に入れない。すでにある場合は削除する
