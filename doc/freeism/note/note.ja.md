# 無料主義のグラフ

- [無料主義のグラフ](#無料主義のグラフ)
  - [無料主義のフロー](#無料主義のフロー)
  - [派生報酬の仕組み](#派生報酬の仕組み)
  - [公式パッケージの仕組み](#公式パッケージの仕組み)
  - [無料主義のデータ構造](#無料主義のデータ構造)

## 無料主義のフロー

- 説明
  - 無料主義のフローについて大まかに説明した図

```mermaid
  graph LR

    %% 項目変数名と表示名
    Platform["<b>アプリ</b><br/><br/>プラットフォーム"]
    Demand["<b>需要者</b><br/><br/>商品を購入する人"]
    Supply["<b>供給側</b><br/><br/>商品を提供する人"]
    Review["<b>評価者</b><br/><br/>評価を行う人"]

    %% スタイルを指定
    style Platform fill:#ff6b9d,stroke:#c2185b,stroke-width:4px,color:#fff
    style Demand fill:#4fc3f7,stroke:#0277bd,stroke-width:4px,color:#000
    style Supply fill:#fff176,stroke:#f57f17,stroke-width:4px,color:#000
    style Review fill:#a5d6a7,stroke:#2e7d32,stroke-width:4px,color:#000

    %% 評価者 → アプリ
    Review -->|"<div style='text-align: left;'><b>評価者 → アプリ</b><br/>1 アプリに登録<br/>2 評価軸を登録<br/>11 評価を提出</div>"| Platform

    %% 需要者 → アプリ
    Demand -->|"<div style='text-align: left;'><b>需要者 → アプリ</b><br/>1 アプリに登録<br/>4 入札＆落札<br/>8 商品受領の連絡</div>"| Platform

    %% 供給者 → アプリ
    Supply -->|"<div style='text-align: left;'><b>供給者 → アプリ</b><br/>1 アプリに登録<br/>3 商品出品とポイント指定</div>"| Platform

    %% 評価者 → 供給者
    Review -->|"<div style='text-align: left;'><b>評価者 → 供給者</b><br/>10 貢献度の算出</div>"| Supply

    %% 供給者 → 需要者
    Supply -->|"<div style='text-align: left;'><b>供給者 → 需要者</b><br/>7 商品の提供</div>"| Demand

    %% アプリ → 需要者
    Platform -->|"<div style='text-align: left;'><b>アプリ → 需要者</b><br/>5 入札額のポイント消費</div>"| Demand

    %% アプリ → 供給者
    Platform -->|"<div style='text-align: left;'><b>アプリ → 供給者</b><br/>6 落札者の情報伝達<br/>12 ポイントの付与</div>"| Supply

    %% アプリ → 評価者
    Platform -->|"<div style='text-align: left;'><b>アプリ → 評価者</b><br/>9 供給者の情報提供</div>"| Review
```

## 派生報酬の仕組み

- 説明
  - 評価軸Aに対して商材Bが貢献した際に、商材Bが商材Cを使用していた場合は、商材Bが獲得した評価軸Aポイントの一部を商材Cも受け取れます。

```mermaid
  flowchart LR

    AxisA["<b>評価軸A</b>"]
    B["<b>商材B</b><br/>※評価軸Aへ貢献"]
    C["<b>商材C</b><br/>※商材Bが使用"]

    AxisA -->|"1.貢献の評価<br>2.Aポイント付与"| B
    B -->|"1.使用<br>2.派生報酬として<br>一部を分配"| C

    %%{init: {'flowchart': {'padding': 0}}}%%

    style AxisA fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    style B fill:#fff3e0,stroke:#ef6c00,stroke-width:3px,color:#000
    style C fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px,color:#000
```

## 公式パッケージの仕組み

- 説明
  - 商材Cが受け取ったポイントを、商材Cを作り上げるのに貢献した人たちへ分配する方法として、公式パッケージを使用します。

```mermaid
flowchart LR

  %%{init: {'flowchart': {'padding': 0}}}%%

    C2["<b>商材C</b><br>※派生報酬でポイント受領"]
    OP["<b>公式パッケージ</b>"]
    P1["<b>貢献者</b>"]
    P2["<b>貢献者</b>"]
    Pn["<b>貢献者</b>"]

    C2 -->|"受け取ったポイントの<br/>分配の単位として利用"| OP
    OP -->|"分配"| P1
    OP -->|"分配"| P2
    OP -->|"分配"| Pn

    style C2 fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px,color:#000
    style OP fill:#f3e5f5,stroke:#6a1b9a,stroke-width:3px,color:#000
    style P1 fill:#e0f7fa,stroke:#00838f,stroke-width:3px,color:#000
    style P2 fill:#e0f7fa,stroke:#00838f,stroke-width:3px,color:#000
    style Pn fill:#e0f7fa,stroke:#00838f,stroke-width:3px,color:#000
```

## 無料主義のデータ構造

- 説明
  - 無料主義のデータ構造について大まかに解説した図

```mermaid
  graph LR

  %% 項目変数名と表示名
  group-1["<b>グループ-1</b>"]
  group-2["<b>グループ-2</b>"]
  group-1-product-1["<b>「グループ-1」の「商材-1」</b>"]
  group-1-product-2["<b>「グループ-1」の「商材-2」</b>"]
  group-2-product-1["<b>「グループ-1」の「商材-1」</b>"]
  group-2-product-2["<b>「グループ-1」の「商材-2」</b>"]
  group-1-product-1-official-package-1["<b>「グループ-1」の「商材-1」の「公式パッケージ-1」</b>"]
  group-1-product-1-official-package-2["<b>「グループ-1」の「商材-1」の「公式パッケージ-2」</b>"]
  group-1-product-1-unofficial-package-1["<b>「グループ-1」の「商材-1」の「非公式パッケージ-1」</b>"]
  group-1-product-1-unofficial-package-2["<b>「グループ-1」の「商材-1」の「非公式パッケージ-2」</b>"]
  group-1-product-1-unofficial-package-3["<b>「グループ-1」の「商材-1」の「非公式パッケージ-3」</b>"]
  a-official-review["<b>aの公式評価軸</b>"]
  a-review-1["<b>Aの評価軸-1</b>"]
  a-review-2["<b>Aの評価軸-2</b>"]
  a-review-3["<b>Aの評価軸-3</b>"]
  a-review-1-contributor-1["<b>Aの評価軸-1の評価者-1</b>"]
  a-review-1-contributor-2["<b>Aの評価軸-1の評価者-1</b>"]
  a-contributor-2["<b>Aの貢献者-2</b>"]
  a-Reviewer["<b>評価者</b><br/><br/>評価を行う人"]

  %% 矢印
  group-1 -->|"一つのグループ(企業)が複数の商材を登録"| group-1-product-1
  group-1-product-1
```
