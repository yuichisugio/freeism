import { ConnectionManager } from "@/lib/auction/action/connection-manager-class";

declare global {
  var __connectionManagerInstance: ConnectionManager | undefined;
}

let connectionManager: ConnectionManager;

console.log("ConnectionManagerSingleton: Initializing..."); // 初期化開始ログ

if (process.env.NODE_ENV === "production") {
  connectionManager = new ConnectionManager(); // 本番環境では直接インスタンス化
  console.log("ConnectionManagerSingleton: Using production instance.");
} else {
  // 開発環境ではグローバルキャッシュを使用
  if (!global.__connectionManagerInstance) {
    console.log("ConnectionManagerSingleton: Creating new instance for development.");
    // ここで new ConnectionManager() を呼び出す
    global.__connectionManagerInstance = new ConnectionManager();
  } else {
    console.log("ConnectionManagerSingleton: Re-using existing development instance.");
  }
  connectionManager = global.__connectionManagerInstance;
}

console.log("ConnectionManagerSingleton: Instance assigned."); // インスタンス割り当てログ

export { connectionManager };
