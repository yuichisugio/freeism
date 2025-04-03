// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

const SW_VERSION = "1.0.0";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Service Workerがインストールされたときに実行されるイベントハンドラ
 */
self.addEventListener("install", () => {
  console.log(`Service Worker がインストールされました (v${SW_VERSION})`);
  // Service Workerをすぐにアクティブ化
  self.skipWaiting();
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Service Workerがアクティブになったときに実行されるイベントハンドラ
 */
self.addEventListener("activate", (event) => {
  console.log(`Service Worker がアクティブになりました (v${SW_VERSION})`);
  // 新しいService Workerがすべてのクライアントを制御するように
  event.waitUntil(clients.claim());
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * リクエスト時の処理
 * 認証関連のパスは処理せず、そのままブラウザの通常の処理に任せる
 */
self.addEventListener("fetch", (event) => {
  // URL情報を取得
  const url = new URL(event.request.url);
  const pathname = url.pathname;

  // 認証関連のパスやAPIリクエストの場合は何もせず通常の動作を維持
  if (pathname.startsWith("/api/auth/") || pathname === "/api/auth") {
    console.log(`[SW] 認証関連リクエストをパススルー: ${pathname}`);
    return;
  }

  // その他のリクエストも基本的にはパススルーする
  // 必要に応じてキャッシュ戦略などを実装できる
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * プッシュ通知を受け取ったときに実行されるイベントハンドラ
 */
self.addEventListener("push", (event) => {
  console.log(`プッシュ通知を受信しました (v${SW_VERSION})`, event);

  const defaultNotificationData = {
    title: "新しい通知",
    body: "メッセージが届きました。",
    icon: "favicon.svg", // デフォルトアイコン
    badge: "favicon.svg", // デフォルトバッジ
    data: { url: "/" }, // デフォルトの遷移先
  };

  // 通知データの初期化（defaultから開始）
  let notificationData = { ...defaultNotificationData };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log("[SW] Push Payload:", payload);
      // ペイロードの内容で通知データを上書き
      notificationData = {
        ...defaultNotificationData, // デフォルト値を保持しつつ上書き
        title: payload.title || defaultNotificationData.title,
        body: payload.body || defaultNotificationData.body,
        icon: payload.icon || defaultNotificationData.icon,
        badge: payload.badge || defaultNotificationData.badge,
        // urlはpayload.data.urlにあることを期待 (サーバーアクション側と合わせる)
        data: {
          url: payload.data?.url || defaultNotificationData.data.url,
        },
      };
    } catch (e) {
      console.error("[SW] Error parsing push data:", e);
      // ペイロードがJSONでないか、形式が違う場合はデフォルト値を使用
    }
  } else {
    console.log("[SW] Push event received without data.");
    // データがない場合もデフォルト通知を表示
  }

  // 通知を表示
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: "general-notification",
    renotify: false,
    data: notificationData.data,
    actions: [
      { action: "open_url", title: "開く" },
      { action: "dismiss", title: "閉じる" },
    ],
  };

  console.log("[SW] Showing notification:", notificationData.title, options);

  // showNotificationはPromiseを返すので、waitUntilで処理完了を待つ
  event.waitUntil(self.registration.showNotification(notificationData.title, options));
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 通知がクリックされたときに実行されるイベントハンドラ
 */
self.addEventListener("notificationclick", (event) => {
  console.log(`通知がクリックされました (v${SW_VERSION})`, event);

  // 通知を閉じる
  event.notification.close();

  // 通知に関連付けられたURLを開く
  const urlToOpen = event.notification.data?.url || "/"; // デフォルトはルート
  console.log("[SW] Notification click: URL to open:", urlToOpen);

  // 適切なクライアント（タブ/ウィンドウ）を探してフォーカスまたは開く
  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true, // 他のService Workerが制御しているクライアントも含む
      })
      .then((clientList) => {
        // すでに同じURLのタブが開いているか確認
        for (const client of clientList) {
          // URLのパス部分だけで比較するなどの調整が必要な場合がある
          if (client.url === urlToOpen && "focus" in client) {
            console.log("[SW] Found matching client, focusing...");
            return client.focus(); // 見つかったらフォーカス
          }
        }
        // 開いているタブがなければ新しいタブで開く
        if (clients.openWindow) {
          console.log("[SW] No matching client found, opening new window...");
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});

// (オプション) プッシュ購読が変更されたときのイベント (ブラウザによっては未サポート)
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log(`[SW ${SW_VERSION}] Push Subscription Change`);
  // 購読情報が期限切れなどで変更された場合に発生
  // 新しい購読情報をサーバーに再送信する必要がある

  // 環境変数の取得はServiceWorkerでは直接できないので、
  // 再購読処理はメインスレッドに任せるべき
  event.waitUntil(
    // デフォルトのサブスクリプションオプションを使用して再購読
    self.registration.pushManager.subscribe({ userVisibleOnly: true }).then((newSubscription) => {
      console.log("[SW] New subscription obtained after change:", newSubscription.endpoint);
      // この新しい購読情報をクライアントに通知するなどの処理が必要
      return self.clients.matchAll().then((clients) => {
        if (clients.length > 0) {
          // クライアントに新しい購読情報を通知
          clients[0].postMessage({
            type: "subscription-changed",
            subscription: newSubscription,
          });
        }
      });
    }),
  );
});
