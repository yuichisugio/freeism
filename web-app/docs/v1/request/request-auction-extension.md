# **オークション**

## **概要**

- スナイピング対策として、終了時刻の間際に入札があった場合にオークション時間の延長を行う

## **必要な理由・目的**

- 最終入札時刻からランダム時間の延長によって、終了間際に入札して落札するマナー違反を対策
- この仕様により、スナイピング（終了間際の入札）を防止しつつ、公正なオークション環境を提供する。

## **基本終了条件**

- オークションは設定された終了時間（endTime）に自動的に終了する
- 終了時間はTask作成時に出品者が設定

## **終了時間の延長ルール**

- 延長条件：`isExtension`カラムが`true`のオークションのみ延長
- 延長トリガー：現在日時と`endTime`の差分の時間（残り時間）が、「`endTime`と`startTime`の差分の5%の時間」or「`remainingTimeForExtension`の数字(単位は分)」のどちらか長い時間以下の場合に、入札があった場合に入札した時
- 延長時間：「`endTime`と`startTime`の差分の5%」or 「`extensionTime`の数字(単位は分)」のどちらか長い時間の分だけ、`endTime`を延長して、`extensionTotalCount`カラムに1だけ加算する
- 延長回数：最大延長回数は、`extensionLimitCount`カラムの数字の回数まで行う

## **使用するカラム**

- `Auction`テーブルの`extensionTotalCount`,`extensionLimitCount`,`remainingTimeForExtension`,`extensionTime`,`isExtension`カラム
