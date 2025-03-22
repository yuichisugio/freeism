import React from "react";

// Reactの型定義を拡張
declare module "react" {
  type IntrinsicAttributes = {
    // これにより、どんなカスタムpropsでもコンポーネントに渡せるようになる
    [key: string]: any;
  };
}
