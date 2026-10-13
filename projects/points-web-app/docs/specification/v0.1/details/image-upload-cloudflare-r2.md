# 画像アップロード・Cloudflare R2仕様

- [画像アップロード・Cloudflare R2仕様](#画像アップロードcloudflare-r2仕様)
  - [既存仕様書との乖離・注意点](#既存仕様書との乖離注意点)
  - [実装場所](#実装場所)
  - [利用箇所](#利用箇所)
  - [UI仕様](#ui仕様)
  - [署名URL API](#署名url-api)
    - [`/api/upload`](#apiupload)
    - [`/api/upload/get-signed-url`](#apiuploadget-signed-url)
  - [署名URL生成](#署名url生成)
  - [ブラウザからR2へのPUT](#ブラウザからr2へのput)
  - [削除](#削除)
  - [環境変数の注意点](#環境変数の注意点)
  - [ファイル検証 utility](#ファイル検証-utility)

## 既存仕様書との乖離・注意点

既存の `image-upload_cloudflare-r2.md`
は最大5MB、`@/lib/cloudflare/*`、`fetch`によるPUTを前提にしています。現行実装は最大10MB、`@/actions/cloudflare/*`、`XMLHttpRequest`
によるPUTです。また R2 env 名や公開envの扱いに混在が見えます。

## 実装場所

- `src/components/share/image-upload-area.tsx`
- `src/components/share/upload-file-card.tsx`
- `src/actions/cloudflare/*`
- `src/app/api/upload/route.ts`
- `src/app/api/upload/get-signed-url/route.ts`
- `src/components/task/create-task-form.tsx`
- `src/components/task/task-edit-modal.tsx`
- `src/library-setting/env.ts`

## 利用箇所

画像アップロードUIは、報酬型タスクの作成・編集時に表示されます。アップロード成功後の公開URLは `Task.imageUrl`
に保存されます。削除時は `imageUrl` を空文字にします。

## UI仕様

`ImageUploadArea`:

- `onImageUploaded`
- `onImageRemoved`
- `initialImageUrl`
- `disabled`

制約:

- 最大10MB
- `maxFiles: 1`
- 先頭1ファイルのみ処理
- drag/drop 対応
- window全体への drag/drop に対応し、ドラッグ中はグローバルドロップオーバーレイを表示します。
- 画像以外が混在した drop では、画像ファイル以外を無視した warning を表示します。
- R2アップロードが無効な場合は、アップロードUIの代わりに「画像アップロード機能は現在無効です」と表示します。

受理MIME:

- `image/jpeg`
- `image/jpg`
- `image/png`
- `image/gif`
- `image/webp`
- `image/avif`

注意:

- 画面文言は `JPEG, PNG, WebP, GIF (最大10MB)` で、AVIF は未記載です。

## 署名URL API

### `/api/upload`

入力:

- `{ contentType: string }`

処理:

- `getSignedUploadUrl(contentType)` を呼びます。

認可:

- API層での認証チェックは確認できません。

エラー:

- contentType 不足: 400
- 署名URL生成失敗: 500
- 例外: 500

### `/api/upload/get-signed-url`

入力:

- `{ fileType: string; fileName?: string }`

処理:

- `generateSignedUploadUrl(fileType, fileName)` を呼びます。

認可:

- API層での認証チェックは確認できません。

エラー:

- fileType 不足: 400
- 署名URL生成失敗: 500
- 例外: 500

## 署名URL生成

`generateSignedUploadUrl(fileType, fileName?)`:

検証:

- 画像アップロード有効化設定
- R2 client
- bucket
- 対応 MIME

生成:

- `PutObjectCommand`
- `getSignedUrl(..., { expiresIn: 900 })`
- 有効期限は15分

key:

- `fileName` 未指定時は `uuid.ext`
- 実装上は `fileName ?? generatedName` のため、空文字は生成名ではなく空文字 key 扱いになる可能性があります。

出力:

- `signedUrl`
- `publicUrl`
- `key`

`CLOUDFLARE_PUBLIC_URL` があれば `${publicUrl}/${fileKey}` を返します。なければ `publicUrl` は null です。

## ブラウザからR2へのPUT

UIは署名URL取得後、ブラウザで `XMLHttpRequest` により `PUT` します。

- `Content-Type` は file.type
- upload progress を表示します。
- XHR失敗時は toast でエラーを表示します。

## 削除

R2上のオブジェクト削除APIは確認できません。UI削除は preview解除と親 callback のみです。

## 環境変数の注意点

- `ImageUploadArea` は `isR2Enabled()` 経由で `NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED` を見る経路があります。
- `env.ts` / `.env.example` には同名公開envが見当たらない可能性があります。
- R2 client の credential 名と env validation 名に混在が見えます。
- `CLOUDFLARE_R2_ENDPOINT_URL` は env 定義にありますが、読んだ R2 client 実装では未使用に見えます。

## ファイル検証 utility

`validateImageFiles`:

- 未選択NG
- 10MB超NG
- `file.type.startsWith("image/")` 以外NG

この utility は、定数の6種類限定ではなく任意の `image/*` を許容します。
