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
 * プッシュ通知を受け取ったときに実行されるイベントハンドラ
 */
self.addEventListener("push", (event) => {
  console.log(`プッシュ通知を受信しました (v${SW_VERSION})`, event);

  const defaultNotificationData = {
    title: "新しい通知",
    body: "メッセージが届きました。",
    icon: "/icons/icon-192x192.png", // デフォルトアイコン
    badge: "/icons/badge-72x72.png", // デフォルトバッジ
    data: { url: "/" }, // デフォルトの遷移先
  };

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

  // アクションボタンがクリックされた場合の処理 (オプション)
  // if (event.action === 'open_url') {
  //   console.log('[SW] Open URL action clicked');
  // } else if (event.action === 'dismiss') {
  //    console.log('[SW] Dismiss action clicked');
  //    return; // 何もしないで閉じる
  // } else {
  //    console.log('[SW] Notification body clicked');
  // }

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
  event.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: "YOUR_VAPID_PUBLIC_KEY" }).then((newSubscription) => {
      console.log("[SW] New subscription obtained after change:", newSubscription.endpoint);
      // TODO: このnewSubscriptionをサーバーに送信する処理
      // return sendSubscriptionToServer(newSubscription);
    }),
  );
});
