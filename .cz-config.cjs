module.exports = {
  types: [
    {
      name: "ci:       CI用の設定やスクリプトに関する変更",
      value: "ci",
    },
    {
      name: "chore:    その他の変更（ソースやテストの変更を含まない）",
      value: "chore",
    },
    { name: "revert:   前のコミットに復帰", value: "revert" },
    { name: "feat:     新機能", value: "feat" },
    { name: "fix:      バグ修正", value: "fix" },
    { name: "docs:     ドキュメントのみの変更", value: "docs" },
    {
      name: "style:    フォーマットの変更（コードの動作に影響しない）",
      value: "style",
    },
    {
      name: "refactor: リファクタリングのための変更（機能追加やバグ修正を含まない）",
      value: "refactor",
    },
    { name: "perf:     パフォーマンスの改善のための変更", value: "perf" },
    {
      name: "test:     不足テストの追加や既存テストの修正",
      value: "test",
    },
    {
      name: "build:    ビルドシステムや外部依存に関する変更",
      value: "build",
    },
  ],
  messages: {
    type: "コミットする変更タイプを選択:\n",
    scope:
      "変更内容のスコープ(例:コンポーネントやファイル名):（enterでスキップ）\n",
    subject: "変更内容を要約した本質的説明:\n",
    body: "変更内容の詳細:（enterでスキップ）\n",
    breaking: "破壊的変更を含みますか？（enterでスキップ）\n",
    footer: "issueに関連した変更ですか？（enterでスキップ）\n",
    confirmCommit: "上記のコミットを続行してもよろしいですか?(Y/n)\n",
  },
  skipQuestions: [],
  scopes: ["components", "pages", "database", "api", "other"],
  subjectLimit: 100,
};
