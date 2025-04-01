// hooks/useServiceWorker.ts

"use client";

import { useEffect, useState } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Service Workerを使用してプッシュ通知を管理するフック
 * @returns サービスワーカーの登録情報とエラー
 */
export function useServiceWorker() {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // registration: サービスワーカーの登録情報
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  // error: エラー情報
  const [error, setError] = useState<Error | null>(null);
  // isSupported: サービスワーカーとPush APIがサポートされているかどうか
  const [isSupported, setIsSupported] = useState(false);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  useEffect(() => {
    // Service Workerがブラウザでサポートされているか確認
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);

    if (!supported) {
      setError(new Error("このブラウザはService WorkerとPush APIをサポートしていません"));
      return;
    }

    // Service Workerの登録
    const registerServiceWorker = async () => {
      try {
        // Service Workerを登録
        const reg = await navigator.serviceWorker.register("/service-worker.js");
        console.log("Service Worker が登録されました:", reg);
        setRegistration(reg);
      } catch (err) {
        console.error("Service Worker の登録に失敗しました:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    void registerServiceWorker();
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return { registration, error, isSupported };
}
