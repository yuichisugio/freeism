# push通知の仕様書

## 1. push通知自体の実装

1. push通知自体の実装ログインが必要な画面に入ったら、push通知の許諾を表示して、service-workerをインストールする
2. 通知を拒否して無効化していたが通知を受け取りたくなれば、dashboard/settings/page.tsx画面に、通知toggleを設定して、ONにすることで、OSの通知許諾画面にリダイレクトさせてONにできるような実装

## 2. 追加実装したいpush通知の仕様。

1. アプリ内通知の作成formで、push通知ToggleをONにすると、push通知も送れるようにする

## push通知を実装するファイルのPATH

1. public/service-worker.js
2. src/app/push-notification.ts
3. src/hooks/push-notification.ts
4. 新規作成してもOK

## push通知の使用場面

1. アプリ内通知の作成form
2. オークション関連の通知

## 考慮したいこと

1. push-notification.tsのsendNotification()にデータを渡せば、いつでもpush通知を送信できるようにしたいので、componentとは疎結合な設計にしたい
