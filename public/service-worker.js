/**
 * Service Workerがインストールされたときに実行されるイベントハンドラ
 */
self.addEventListener("install", () => {
  console.log("Service Worker がインストールされました");
  // Service Workerをすぐにアクティブ化
  self.skipWaiting();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Service Workerがアクティブになったときに実行されるイベントハンドラ
 */
self.addEventListener("activate", (event) => {
  console.log("Service Worker がアクティブになりました");
  // 新しいService Workerがすべてのクライアントを制御するように
  event.waitUntil(clients.claim());
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知を受け取ったときに実行されるイベントハンドラ
 */
self.addEventListener("push", (event) => {
  console.log("プッシュ通知を受信しました", event);

  // 通知のデータを取得
  const data = event.data ? event.data.json() : {};
  const title = data.title || "お知らせ";
  const options = {
    body: data.body || "お知らせがあります",
    icon: data.icon || "/icon.png", // publicフォルダに配置したアイコン
    badge: data.badge || "/badge.png", // publicフォルダに配置したバッジ
    data: {
      url: data.url || "/", // 通知がクリックされたときに開くURL
    },
    lang: "ja", // 通知の言語
    requireInteraction: true, // 通知を閉じない
  };
  // 通知を表示
  event.waitUntil(self.registration.showNotification(title, options));
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知がクリックされたときに実行されるイベントハンドラ
 */
self.addEventListener("notificationclick", (event) => {
  console.log("通知がクリックされました", event);

  // 通知を閉じる
  event.notification.close();

  // 通知に関連付けられたURLを開く
  const url = event.notification.data.url || "/";

  // 通知がクリックされたときに開くURLを開く
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // 既に開いているウィンドウがあればそこを使用
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      // 開いていなければ新しいタブを開く
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
