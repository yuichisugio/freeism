import { ConnectionManager } from "@/lib/auction/server-sent-events/connection-manager-class";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

console.log("connection-manager-singleton.ts evaluating...");

// グローバルスコープにインスタンスを格納するためのキー (シンボル推奨)
// キー名を更新してキャッシュ衝突を避ける
const CM_INSTANCE_KEY = Symbol.for("__myapp_connectionManagerInstance_v5");

// シンボルキーによるインデックスアクセスを許可する型を定義します。
// globalThis は環境によって型が異なるため、必要なプロパティを持つ型として定義します。
// NodeJS.Global を使う代わりに、インデックスシグネチャを追加します。
type GlobalWithCmInstance = {
  [CM_INSTANCE_KEY]?: ConnectionManager;
  // 必要に応じて他のグローバルプロパティの型もここに追加できます
};

// globalThis を上記で定義した型として扱います (型アサーション)
const globalScope = globalThis as GlobalWithCmInstance;

let instance: ConnectionManager | undefined = globalScope[CM_INSTANCE_KEY]; // 初期値をグローバルから取得

// グローバルスコープにインスタンスが既に存在するかチェック
if (!instance) {
  console.log(`>>>> Instance NOT FOUND in global scope (value: ${instance === undefined ? "undefined" : "null"}). Creating NEW instance.`);
  // 存在しない場合のみ、新しいインスタンスを作成してグローバルに格納
  instance = new ConnectionManager(); // ConnectionManager のコンストラクタが呼ばれる
  globalScope[CM_INSTANCE_KEY] = instance;
  // instance が undefined でないことを確認してからメソッド呼び出し
  console.log(`>>>> NEW Instance created and stored globally. ID: ${instance.getInstanceId()}`);
} else {
  console.log(`>>>> Instance FOUND in global scope. Reusing existing instance.`);
  // 存在する場合のログ (instance は既に設定済み)
  // instance が undefined でないことを確認してからメソッド呼び出し
  console.log(`>>>> REUSED Existing Instance. ID: ${instance.getInstanceId()}`);
}

// デバッグ用に常にエクスポートされるインスタンスのIDを出力
// instance が確実に ConnectionManager 型であることを確認
if (instance instanceof ConnectionManager && typeof instance.getInstanceId === "function") {
  console.log(`Exporting ConnectionManager instance with ID: ${instance.getInstanceId()}`);
} else {
  // このケースは通常発生しないはずですが、念のためエラーハンドリング
  console.error("CRITICAL: Failed to create or retrieve a valid ConnectionManager instance!");
  // 必要であればここでエラーを投げるか、デフォルトインスタンスを作成する
  // throw new Error("Could not initialize ConnectionManager");
  // instance = new ConnectionManager(); // フォールバック？
}

// エクスポート (instance が undefined の可能性がないように上記でハンドリング)
// もし上記でエラーを投げない場合は、instance! のように Non-null assertion を使うか、
// または connectionManager の型を ConnectionManager | undefined にする必要がある。
// ここでは、上記のハンドリングで必ずインスタンスが存在する想定とする。
export const connectionManager = instance;

// --- 開発環境でのHMR対策 ---
if (process.env.NODE_ENV !== "production") {
  // モジュール再評価後も同じインスタンスをグローバル変数に再設定しておく
  // ここでも型アサーションを使用
  (globalThis as GlobalWithCmInstance)[CM_INSTANCE_KEY] = instance;
}
