# Graph of Freeism

- [Graph of Freeism](#graph-of-freeism)
  - [Flow of Freeism](#flow-of-freeism)
  - [How derivative rewards work](#how-derivative-rewards-work)
  - [How official packages work](#how-official-packages-work)
  - [Data structure of Freeism](#data-structure-of-freeism)
  - [How contribution scores are calculated](#how-contribution-scores-are-calculated)

## Flow of Freeism

- Description
  - A diagram that roughly explains the flow of Freeism.

```mermaid
  graph LR

    %% Variable names and labels
    Platform["<b>App</b><br/><br/>Platform"]
    Demand["<b>Demand side</b><br/><br/>People who purchase goods"]
    Supply["<b>Supply side</b><br/><br/>People who provide goods"]
    Review["<b>Evaluators</b><br/><br/>People who perform evaluations"]

    %% Styles
    style Platform fill:#ff6b9d,stroke:#c2185b,stroke-width:4px,color:#fff
    style Demand fill:#4fc3f7,stroke:#0277bd,stroke-width:4px,color:#000
    style Supply fill:#fff176,stroke:#f57f17,stroke-width:4px,color:#000
    style Review fill:#a5d6a7,stroke:#2e7d32,stroke-width:4px,color:#000

    %% Evaluator → App
    Review -->|"<div style='text-align: left;'><b>Evaluator → App</b><br/>1 Register with the app<br/>2 Register evaluation axes<br/>11 Submit evaluations</div>"| Platform

    %% Demand side → App
    Demand -->|"<div style='text-align: left;'><b>Demand side → App</b><br/>1 Register with the app<br/>4 Bidding & winning auctions<br/>8 Notify receipt of goods</div>"| Platform

    %% Supply side → App
    Supply -->|"<div style='text-align: left;'><b>Supply side → App</b><br/>1 Register with the app<br/>3 List goods and specify points</div>"| Platform

    %% Evaluator → Supply side
    Review -->|"<div style='text-align: left;'><b>Evaluator → Supply side</b><br/>10 Calculate contribution</div>"| Supply

    %% Supply side → Demand side
    Supply -->|"<div style='text-align: left;'><b>Supply side → Demand side</b><br/>7 Provide goods</div>"| Demand

    %% App → Demand side
    Platform -->|"<div style='text-align: left;'><b>App → Demand side</b><br/>5 Consume points for the bid amount</div>"| Demand

    %% App → Supply side
    Platform -->|"<div style='text-align: left;'><b>App → Supply side</b><br/>6 Share winner information<br/>12 Award points</div>"| Supply

    %% App → Evaluator
    Platform -->|"<div style='text-align: left;'><b>App → Evaluator</b><br/>9 Provide supply-side information</div>"| Review
```

## How derivative rewards work

- Description
  - When good B contributes to evaluation axis A, if good B used good C, part of the evaluation-axis A points that good B earned can also go to good C.

```mermaid
  flowchart LR

    AxisA["<b>Evaluation axis A</b>"]
    B["<b>Good B</b><br/>※Contributes to evaluation axis A"]
    C["<b>Good C</b><br/>※Used by good B"]

    AxisA -->|"1. Evaluate contribution<br>2. Award A points"| B
    B -->|"1. Use<br>2. As derivative reward<br>distribute part"| C

    %%{init: {'flowchart': {'padding': 0}}}%%

    style AxisA fill:#e3f2fd,stroke:#1565c0,stroke-width:2px,color:#000
    style B fill:#fff3e0,stroke:#ef6c00,stroke-width:3px,color:#000
    style C fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px,color:#000
```

## How official packages work

- Description
  - To distribute points that good C received to the people who contributed to building good C, official packages are used.

```mermaid
flowchart LR

  %%{init: {'flowchart': {'padding': 0}}}%%

    C2["<b>Good C</b><br>※Receives points as derivative reward"]
    OP["<b>Official package</b>"]
    P1["<b>Contributor</b>"]
    P2["<b>Contributor</b>"]
    Pn["<b>Contributor</b>"]

    C2 -->|"Used as the unit for<br/>distributing received points"| OP
    OP -->|"Distribute"| P1
    OP -->|"Distribute"| P2
    OP -->|"Distribute"| Pn

    style C2 fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px,color:#000
    style OP fill:#f3e5f5,stroke:#6a1b9a,stroke-width:3px,color:#000
    style P1 fill:#e0f7fa,stroke:#00838f,stroke-width:3px,color:#000
    style P2 fill:#e0f7fa,stroke:#00838f,stroke-width:3px,color:#000
    style Pn fill:#e0f7fa,stroke:#00838f,stroke-width:3px,color:#000
```

## Data structure of Freeism

- Description
  - A diagram that roughly explains the data structure of Freeism.

```mermaid
  graph LR

  %% Variable names and labels
  group-1["<b>Group-1</b>"]
  group-2["<b>Group-2</b>"]
  group-1-product-1["<b>“Group-1”’s “Good-1”</b>"]
  group-1-product-2["<b>“Group-1”’s “Good-2”</b>"]
  group-2-product-1["<b>“Group-1”’s “Good-1”</b>"]
  group-2-product-2["<b>“Group-1”’s “Good-2”</b>"]
  group-1-product-1-official-package-1["<b>“Group-1”’s “Good-1”’s “Official package-1”</b>"]
  group-1-product-1-official-package-2["<b>“Group-1”’s “Good-1”’s “Official package-2”</b>"]
  group-1-product-1-unofficial-package-1["<b>“Group-1”’s “Good-1”’s “Unofficial package-1”</b>"]
  group-1-product-1-unofficial-package-2["<b>“Group-1”’s “Good-1”’s “Unofficial package-2”</b>"]
  group-1-product-1-unofficial-package-3["<b>“Group-1”’s “Good-1”’s “Unofficial package-3”</b>"]
  a-official-review["<b>Official evaluation axis for a</b>"]
  a-review-1["<b>Evaluation axis A-1</b>"]
  a-review-2["<b>Evaluation axis A-2</b>"]
  a-review-3["<b>Evaluation axis A-3</b>"]
  a-review-1-contributor-1["<b>Evaluator-1 for evaluation axis A-1</b>"]
  a-review-1-contributor-2["<b>Evaluator-1 for evaluation axis A-1</b>"]
  a-contributor-2["<b>Contributor A-2</b>"]
  a-Reviewer["<b>Evaluator</b><br/><br/>Person who performs evaluations"]

  %% Arrows
  group-1 -->|"One group (company) registers multiple goods"| group-1-product-1
  group-1-product-1
```

## How contribution scores are calculated

```mermaid
  flowchart TB

  %% Variables
  package-a["Package (A)"]
  evaluation-criteria-b["Evaluation axis (B)"]
  evaluation-criteria-c["Evaluation axis (C)"]

  contributor-d-b["Contributor (D)"]
  contributor-d-c["Contributor (D)"]
  saas-e-b["SaaS (E)"]
  saas-e-c["SaaS (E)"]

  package-f["Package (F)"]
  evaluation-criteria-g["Evaluation axis (G)"]
  evaluation-criteria-h["Evaluation axis (H)"]

  react-j-g["React (J)"]
  react-j-h["React (J)"]
  contributor-i-g["Contributor (I)"]

  package-k["Package (K)"]
  evaluation-criteria-l["Evaluation axis (L)"]
  evaluation-criteria-m["Evaluation axis (M)"]

  contributor-n-l["Contributor (N)"]
  contributor-o-l["Contributor (O)"]
  contributor-p-l["Contributor (P)"]
  contributor-q-m["Contributor (Q)"]

  package-r["Package (R)"]
  evaluation-criteria-s["Evaluation axis (S)"]
  contributor-t["Contributor (T)"]
  contributor-u["Contributor (U)"]

  %% Styles: Mermaid style does not support wildcards in node IDs (e.g. package-*).
  %% In flowcharts, define a style class once with classDef and apply to multiple nodes with class (official: Flowchart Styling / classDef).
  %% Colors correspond by type to “How official packages work” and the derivative-reward diagram.
  classDef packageStyle fill:#f3e5f5,stroke:#6a1b9a,stroke-width:3px,color:#000
  classDef evaluationCriteriaStyle fill:#e3f2fd,stroke:#1565c0,stroke-width:3px,color:#000
  classDef contributorStyle fill:#e0f7fa,stroke:#00838f,stroke-width:3px,color:#000
  classDef saasStyle fill:#fff3e0,stroke:#ef6c00,stroke-width:3px,color:#000
  classDef reactStyle fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px,color:#000
  class package-a,package-f,package-k,package-r packageStyle
  class evaluation-criteria-b,evaluation-criteria-c,evaluation-criteria-g,evaluation-criteria-h,evaluation-criteria-l,evaluation-criteria-m,evaluation-criteria-s evaluationCriteriaStyle
  class contributor-d-b,contributor-d-c,contributor-i-g,contributor-n-l,contributor-o-l,contributor-p-l,contributor-q-m,contributor-t,contributor-u contributorStyle
  class saas-e-b,saas-e-c saasStyle
  class react-j-g,react-j-h reactStyle

  %% Arrows
  package-a -->|"4"| evaluation-criteria-b
  package-a -->|"6"| evaluation-criteria-c

  evaluation-criteria-b -->|"3"| contributor-d-b
  evaluation-criteria-c -->|"4"| contributor-d-c

  evaluation-criteria-b -->|"7"| saas-e-b
  evaluation-criteria-c -->|"6"| saas-e-c

  saas-e-b -->|"10"| package-f
  saas-e-c -->|"10"| package-f

  package-f -->|"8"| evaluation-criteria-g
  package-f -->|"2"| evaluation-criteria-h

  evaluation-criteria-g -->|"8"| react-j-g
  evaluation-criteria-g -->|"2"| contributor-i-g

  evaluation-criteria-h -->|"10"| react-j-h

  react-j-g -->|"10"| package-k
  react-j-h -->|"10"| package-k

  package-k -->|"5"| evaluation-criteria-l
  package-k -->|"5"| evaluation-criteria-m

  evaluation-criteria-l -->|"5"| contributor-n-l
  evaluation-criteria-l -->|"3"| contributor-o-l
  evaluation-criteria-l -->|"2"| contributor-p-l

  evaluation-criteria-m -->|"10"| contributor-q-m

  contributor-n-l -->|"10"| package-r
  package-r -->|"10"| evaluation-criteria-s
  evaluation-criteria-s -->|"7"| contributor-t
  evaluation-criteria-s -->|"3"| contributor-u
```
