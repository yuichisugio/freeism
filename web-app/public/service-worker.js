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
    icon: "favicon.svg", // デフォルトアイコン
    badge: "favicon.svg", // デフォルトバッジ
    data: { url: "/" }, // デフォルトの遷移先
  };

  // 通知データの初期化（defaultから開始）
  let notificationData = { ...defaultNotificationData };

  if (event.data) {
    try {
      // まずはテキストとして取得
      const rawData = event.data.text();
      console.log("[SW] Raw push data:", rawData);

      // JSONとしてパース可能かチェック
      let payload;
      try {
        payload = JSON.parse(rawData);
        console.log("[SW] Push Payload (JSON):", payload);
      } catch (jsonError) {
        console.log("[SW] Data is not JSON, using as text:", rawData);
        // JSONでない場合は、テキストをbodyとして使用
        payload = {
          title: defaultNotificationData.title,
          body: rawData,
        };
      }

      // ペイロードの内容で通知データを上書き
      notificationData = {
        ...defaultNotificationData, // デフォルト値を保持しつつ上書き
        title: payload.title || defaultNotificationData.title,
        body: payload.body || defaultNotificationData.body,
        icon: payload.icon || defaultNotificationData.icon,
        badge: payload.badge || defaultNotificationData.badge,
        data: {
          url: payload.data?.url || defaultNotificationData.data.url,
        },
      };
    } catch (e) {
      console.error("[SW] Error processing push data:", e);
      // エラーが発生した場合はデフォルト値を使用
    }
  } else {
    console.log("[SW] Push event received without data.");
    // データがない場合もデフォルト通知を表示
  }

  notificationData.title =
    notificationData.title.length > 20 ? `${notificationData.title.substring(0, 20)}...` : notificationData.title;
  notificationData.body =
    notificationData.body.length > 40 ? `${notificationData.body.substring(0, 40)}...` : notificationData.body;

  // 通知を表示
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
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
  console.log("[SW] Action clicked:", event.action);

  // 通知を閉じる
  event.notification.close();

  // アクションボタンがクリックされた場合の処理
  if (event.action === "dismiss") {
    console.log("[SW] Dismiss action clicked - closing notification only");
    return; // 何もしない（通知を閉じるだけ）
  }

  if (event.action === "open_url" || !event.action) {
    // 「開く」ボタンがクリックされた場合、または通知本体がクリックされた場合
    console.log("[SW] Opening URL action triggered");

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
  }
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * endpointなどのプッシュ購読が変更されたときのイベント
 * 購読情報が期限切れなどで変更された場合に発生
 * 新しい購読情報をサーバーに再送信する必要がある
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    // 新しい購読情報を取得
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        // applicationServerKeyは元の購読から取得（oldSubscriptionがある場合）
        applicationServerKey: event.oldSubscription ? event.oldSubscription.options.applicationServerKey : undefined,
      })
      .then((newSubscription) => {
        console.log("[SW] New subscription generated:", newSubscription);

        // matchAllで、アプリを開いているユーザーがあればそれらにメッセージを送信して、subscriptionを更新
        return clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
          // アクティブなクライアントが見つかった場合はメッセージング経由で購読情報を更新
          if (clientList.length > 0) {
            console.log(`[SW] Found ${clientList.length} active clients, sending message`);
            const message = {
              type: "SUBSCRIPTION_CHANGED",
              oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
              newSubscription: newSubscription,
            };

            // すべてのクライアントにメッセージを送信
            return Promise.all(
              clientList.map((client) => {
                console.log("[SW] Sending message to client:", client.id);
                return client.postMessage(message);
              }),
            ).then(() => newSubscription);
          } else {
            console.log("[SW] No active clients found, falling back to API");
            // クライアントが見つからない場合はAPIを使用
            return fetch("/api/push-notification/update", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
                newSubscription: newSubscription,
              }),
            }).then(() => newSubscription);
          }
        });
      })
      .then((subscription) => {
        console.log("[SW] Subscription update processed successfully:", subscription.endpoint);
      })
      .catch((error) => {
        console.error("[SW] Failed to resubscribe or update subscription:", error);
      }),
  );
});
