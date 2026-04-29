# Software Dep

## 概要

- ソフトウェアが依存するソフトウェアを調査するコードを集めたフォルダです。

## 対応する方法

1. `github-osi`
2. `github-sbom`
3. `libraries.io`
4. `package-file`
   1. 未実装
5. `package-manager-api`
   1. 未実装

## 使用方法

- 一気に対応する方法全てを実行して、すべての結果を統合したい場合は、`software-dep`フォルダ直下の`main.sh`を実行する
  - `software-dep`フォルダ直下`main.sh`を実行すると、指定した PATH フォルダ(デフォは対応ファイル全て)直下の `main.sh` を全て順次実行して、`formatted_data` 直下の最新フォルダの結果を統合して出力する
  - それにより、可能な限り依存関係の漏れがない一覧を作成したい
- 別々に実行したい場合は対応する方法のフォルダ直下の`main.sh`を実行する
