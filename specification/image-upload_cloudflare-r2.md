# 画像アップロード機能の詳細解説

まずは添付されたコードから解説していきます。このコードは主に画像アップロード機能を実装したReactコンポーネントと、それをサポートするユーティリティ関数で構成されています。

## `ImageUploadArea` コンポーネントの解説

```tsx
"use client";
```

この行は、このコンポーネントがクライアントサイド（ブラウザ側）で実行されることを示しています。Next.jsのApp
Routerでは、デフォルトではコンポーネントはサーバーサイドでレンダリングされますが、この指示により明示的にクライアントコンポーネントとして扱われます。これは画像のドラッグアンドドロップやファイル選択などのブラウザ機能を使用するために必要です。

```tsx
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ACCEPTED_IMAGE_TYPES, getSignedUploadUrl, isImageUploadEnabled, MAX_FILE_SIZE } from "@/lib/cloudflare/upload";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "./button";
import { Progress } from "./progress";
```

ここではさまざまなライブラリやコンポーネントをインポートしています：

1. React関連のフック：`useCallback`（関数のメモ化）、`useEffect`（副作用の処理）、`useState`（状態管理）
2. `next/image`：Next.jsの最適化された画像コンポーネント
3. 独自のユーティリティ関数：`ACCEPTED_IMAGE_TYPES`（許可する画像形式）、`getSignedUploadUrl`（アップロード用URL取得）、`isImageUploadEnabled`（アップロード機能が有効かどうか）、`MAX_FILE_SIZE`（最大ファイルサイズ）
4. `cn`：クラス名を結合するユーティリティ（TailwindCSS用）
5. `framer-motion`：アニメーション用ライブラリ
6. `lucide-react`：アイコンライブラリ
7. `react-dropzone`：ドラッグアンドドロップ機能を簡単に実装するライブラリ
8. `sonner`：トースト通知ライブラリ（ユーザーへのフィードバック表示用）
9. カスタムコンポーネント：`Button`と`Progress`

```tsx
// グローバルドロップエリアのアニメーション設定
const globalDropOverlay = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};
```

ここでは、framer-motionライブラリのためのアニメーション設定を定義しています。ファイルをウィンドウ全体にドラッグしたときに表示されるオーバーレイのアニメーション状態を3つ定義しています：

- `hidden`：非表示状態（透明度0）
- `visible`：表示状態（透明度1、0.2秒かけて徐々に表示）
- `exit`：消える時の状態（透明度0、0.2秒かけて徐々に消える）

```tsx
export type ImageUploadAreaProps = {
  onImageUploaded?: (imageUrl: string) => void;
  onImageRemoved?: () => void;
  initialImageUrl?: string;
  disabled?: boolean;
};
```

このコンポーネントが受け取るプロパティ（props）の型定義です。TypeScriptを使用して型安全性を確保しています：

- `onImageUploaded`：画像がアップロードされた時に呼ばれるコールバック関数（画像のURLを引数として受け取る）
- `onImageRemoved`：画像が削除された時に呼ばれるコールバック関数
- `initialImageUrl`：初期表示する画像のURL（既存の画像を表示する場合に使用）
- `disabled`：コンポーネントを無効化するかどうかのフラグ（デフォルトは`false`）

```tsx
export function ImageUploadArea({ onImageUploaded, onImageRemoved, initialImageUrl, disabled = false }: ImageUploadAreaProps) {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFileOver, setIsFileOver] = useState(false);
  const [isEnabled] = useState(isImageUploadEnabled());
```

ここでは、コンポーネントの状態を管理するためのステート変数を定義しています：

- `currentFile`：現在選択されているファイルオブジェクト
- `previewUrl`：画像プレビュー用のURL（選択した画像またはinitialImageUrl）
- `isUploading`：現在アップロード中かどうかのフラグ
- `uploadProgress`：アップロードの進行状況（0〜100の数値）
- `isFileOver`：ファイルがドロップゾーン上にドラッグされているかのフラグ
- `isEnabled`：画像アップロード機能が有効かどうかのフラグ（環境設定から取得）

```tsx
// ドロップゾーンの設定
const onDrop = useCallback(
  (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`ファイルサイズが大きすぎます（上限: 5MB）`);
      return;
    }

    setCurrentFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // 自動アップロード開始
    if (isEnabled) {
      handleUpload(file);
    }
  },
  [isEnabled],
);
```

この関数は、ファイルがドロップゾーンにドロップされた時に呼ばれます。`useCallback`でメモ化されているため、`isEnabled`の値が変わらない限り再生成されません：

1. ドロップされたファイルが無い場合は何もしない
2. 最初のファイルを取得（複数ファイルが選択された場合でも最初の1つだけ処理）
3. ファイルサイズが上限（5MB）を超えている場合はエラーメッセージを表示して処理を中止
4. 選択されたファイルを状態に保存
5. `URL.createObjectURL`でファイルのプレビュー用URLを生成し、状態に保存
6. アップロード機能が有効な場合は、自動的にアップロード処理を開始

```tsx
// ドロップゾーン設定
const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
  accept: ACCEPTED_IMAGE_TYPES,
  maxSize: MAX_FILE_SIZE,
  onDrop,
  disabled: disabled || isUploading || !isEnabled,
  maxFiles: 1,
  onDropRejected: (rejectedFiles) => {
    rejectedFiles.forEach((rejection) => {
      if (rejection.errors[0]?.code === "file-too-large") {
        toast.error(`ファイルサイズが大きすぎます（上限: 5MB）`);
      } else {
        toast.error(`無効なファイル形式です`);
      }
    });
  },
  noClick: false,
  noKeyboard: true,
  preventDropOnDocument: false,
});
```

`react-dropzone`ライブラリの`useDropzone`フックを使用して、ドラッグ&ドロップ機能を設定しています：

- `accept`：受け付けるファイル形式（JPEG、PNG、WebP、GIFなど）
- `maxSize`：最大ファイルサイズ（5MB）
- `onDrop`：ファイルがドロップされた時のコールバック関数
- `disabled`：コンポーネントが無効化されているか、アップロード中か、または機能そのものが無効の場合はドロップゾーンも無効化
- `maxFiles`：一度に選択できるファイル数の上限（1つだけ）
- `onDropRejected`：ファイルが拒否された時のコールバック（サイズ超過や不正な形式の場合にエラーメッセージを表示）
- `noClick`：クリックでファイル選択を無効にするかどうか（false = 有効）
- `noKeyboard`：キーボード操作を無効にするかどうか（true = 無効）
- `preventDropOnDocument`：ドキュメント全体へのドロップを防止するかどうか（false = 防止しない）

返り値として以下を取得しています：

- `getRootProps`：ドロップゾーンのルート要素に適用するプロパティ
- `getInputProps`：ファイル入力要素に適用するプロパティ
- `isDragActive`：現在ファイルがドラッグされているかどうか
- `open`：プログラム的にファイル選択ダイアログを開くための関数

```tsx
// ウィンドウ全体へのドラッグドロップ
useEffect(() => {
  if (disabled || !isEnabled) return;

  const preventDefault = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: DragEvent) => {
    preventDefault(e);
    setIsFileOver(true);
  };

  const handleDragOver = (e: DragEvent) => {
    preventDefault(e);
    setIsFileOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    preventDefault(e);
    if (e.relatedTarget === null || e.relatedTarget === document.body || e.relatedTarget === document.documentElement) {
      setIsFileOver(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    preventDefault(e);
    setIsFileOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter((file) => {
        return Object.keys(ACCEPTED_IMAGE_TYPES).includes(file.type);
      });

      if (imageFiles.length < files.length) {
        toast.warning("画像ファイル以外は無視されました");
      }

      if (imageFiles.length > 0) {
        const file = imageFiles[0];
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`ファイルサイズが大きすぎます（上限: 5MB）`);
          return;
        }

        setCurrentFile(file);
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);

        // 自動アップロード開始
        if (isEnabled) {
          handleUpload(file);
        }
      }
    }
  };

  window.addEventListener("dragenter", handleDragEnter as EventListener);
  window.addEventListener("dragover", handleDragOver as EventListener);
  window.addEventListener("dragleave", handleDragLeave as EventListener);
  window.addEventListener("drop", handleDrop as EventListener);

  return () => {
    window.removeEventListener("dragenter", handleDragEnter as EventListener);
    window.removeEventListener("dragover", handleDragOver as EventListener);
    window.removeEventListener("dragleave", handleDragLeave as EventListener);
    window.removeEventListener("drop", handleDrop as EventListener);
  };
}, [disabled, isEnabled]);
```

このuseEffectフックでは、ウィンドウ全体でのドラッグ&ドロップを処理するイベントリスナーを設定しています：

1. コンポーネントが無効または機能が無効の場合は何もしない
2. イベントのデフォルト動作を防止する共通関数を定義
3. ドラッグ関連のイベントハンドラを定義：
   - `handleDragEnter`：ファイルがウィンドウ上にドラッグされ始めた時
   - `handleDragOver`：ファイルがウィンドウ上でドラッグされている時
   - `handleDragLeave`：ファイルがウィンドウから離れた時
   - `handleDrop`：ファイルがウィンドウにドロップされた時
4. ドロップされたファイルを処理する手順：
   - ドロップされたファイルの中から画像ファイルのみをフィルタリング
   - 画像以外のファイルが含まれていた場合は警告を表示
   - 画像ファイルがある場合は最初のファイルを処理
   - サイズチェック、プレビュー表示、アップロード開始
5. イベントリスナーをウィンドウに登録
6. クリーンアップ関数でイベントリスナーを削除（コンポーネントのアンマウント時に実行）

```tsx
// メモリリーク防止
useEffect(() => {
  return () => {
    if (previewUrl && !initialImageUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };
}, [previewUrl, initialImageUrl]);
```

このuseEffectでは、コンポーネントがアンマウントされる時にメモリリークを防止する処理を行っています：

- `URL.createObjectURL`で生成されたオブジェクトURLは明示的に解放しないとメモリリークの原因になります
- コンポーネントのクリーンアップ時に、初期画像URL以外のプレビューURLを持っている場合は`URL.revokeObjectURL`で解放します

```tsx
// アップロードハンドラー
const handleUpload = async (file: File) => {
  if (!isEnabled || !file) return;

  try {
    setIsUploading(true);
    setUploadProgress(10); // 開始を示すために10%

    // 署名付きURLを取得
    const signedUrlData = await getSignedUploadUrl(file.type);
    if (!signedUrlData) {
      toast.error("アップロードURLの取得に失敗しました");
      setIsUploading(false);
      return;
    }

    setUploadProgress(30); // URLの取得が完了したら30%

    // 画像の最適化（圧縮・リサイズ）はクライアントサイドで行い、バンドルサイズを抑える
    // 実際のプロダクションでは、ここでリサイズや圧縮を行うことが推奨されます

    // fetchを使用して署名付きURLに直接アップロード
    const response = await fetch(signedUrlData.signedUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    setUploadProgress(90); // アップロードがほぼ完了

    if (!response.ok) {
      throw new Error(`アップロードに失敗しました: ${response.statusText}`);
    }

    setUploadProgress(100); // 完了

    // 成功したらパブリックURLをコールバックで返す
    if (signedUrlData.publicUrl && onImageUploaded) {
      onImageUploaded(signedUrlData.publicUrl);
    }

    toast.success("画像をアップロードしました");
  } catch (error) {
    console.error("アップロードエラー:", error);
    toast.error(error instanceof Error ? error.message : "画像のアップロードに失敗しました");
  } finally {
    setIsUploading(false);
  }
};
```

この関数は実際の画像アップロード処理を行います：

1. 機能が無効またはファイルが無い場合は何もしない
2. アップロード中の状態をセットして進捗表示を10%に設定
3. 署名付きアップロードURLを取得（これによりクライアントが直接ストレージにアップロードできる）
4. URLが取得できなかった場合はエラーメッセージを表示して終了
5. 進捗表示を30%に更新
6. コメントで示されているように、実際のプロダクションではここで画像の最適化処理を行うことが推奨
7. `fetch` APIを使用して署名付きURLに直接ファイルをアップロード（PUTリクエスト）
8. 進捗表示を90%に更新
9. レスポンスが正常でなければエラーをスロー
10. 進捗表示を100%に更新（完了）
11. アップロードが成功したら、公開URLをコールバック関数で親コンポーネントに通知
12. 成功メッセージを表示
13. エラーが発生した場合はエラーログとエラーメッセージを表示
14. 最後に、成功/失敗に関わらずアップロード中の状態をリセット

```tsx
// 画像削除ハンドラー
const handleRemoveImage = () => {
  if (currentFile) {
    setCurrentFile(null);
  }

  if (previewUrl && !initialImageUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  setPreviewUrl(null);

  if (onImageRemoved) {
    onImageRemoved();
  }
};
```

この関数は画像を削除する処理を行います：

1. 現在のファイル状態をクリア
2. 初期画像URL以外のプレビューURLがある場合はオブジェクトURLを解放
3. プレビューURL状態をクリア
4. 画像削除コールバック関数が提供されている場合は呼び出し（親コンポーネントに通知）

```tsx
// 画像アップロード機能が無効の場合
if (!isEnabled) {
  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
      <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
      <p className="mt-2 text-sm text-gray-500">画像アップロード機能は現在無効です</p>
    </div>
  );
}
```

アップロード機能が無効に設定されている場合、シンプルなメッセージ付きのプレースホルダーコンポーネントを表示します。

```tsx
return (
  <>
    {/* グローバルドロップゾーンオーバーレイ */}
    <AnimatePresence>
      {isFileOver && (
        <motion.div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]" initial="hidden" animate="visible" exit="exit" variants={globalDropOverlay}>
          <motion.div
            className="mx-auto flex h-[300px] w-[600px] max-w-[95vw] flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-500 bg-white/95 shadow-2xl"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 20 }}
          >
            <motion.div animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, repeatType: "loop" }}>
              <ImageIcon className="mb-4 h-20 w-20 text-blue-500" />
            </motion.div>
            <h2 className="mb-2 text-2xl font-bold text-blue-500">画像をドロップしてアップロード</h2>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <div className="space-y-4">
      {/* プレビュー表示 */}
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-md border">
          <div className="relative aspect-[16/9] w-full">
            <Image src={previewUrl} alt="画像プレビュー" fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
          </div>

          {/* 削除ボタン */}
          {!disabled && (
            <button onClick={handleRemoveImage} className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-gray-700 shadow-md hover:bg-white hover:text-red-500" disabled={isUploading}>
              <Trash2 className="h-5 w-5" />
            </button>
          )}

          {/* アップロード進捗バー */}
          {isUploading && (
            <div className="absolute bottom-0 left-0 w-full bg-black/50 p-2">
              <div className="flex items-center justify-between text-white">
                <span className="text-xs font-medium">アップロード中...</span>
                <span className="text-xs">{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-1 bg-gray-700" />
            </div>
          )}
        </div>
      ) : (
        // ドロップゾーン
        <div
          {...getRootProps()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all duration-200",
            isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input {...getInputProps()} />

          <motion.div
            className="flex flex-col items-center"
            animate={
              isDragActive
                ? {
                    y: [0, -8, 0],
                    transition: { duration: 2, repeat: Infinity, repeatType: "loop" as const },
                  }
                : {}
            }
          >
            {isUploading ? <Loader2 className="mb-3 h-10 w-10 animate-spin text-blue-500" /> : <Upload className="mb-3 h-10 w-10 text-gray-400" />}
            <p className="mb-2 font-medium text-gray-700">クリックまたはドラッグ&ドロップ</p>
            <p className="text-sm text-gray-500">JPEG, PNG, WebP, GIF (最大5MB)</p>
          </motion.div>
        </div>
      )}

      {/* 選択ボタン */}
      {!previewUrl && !disabled && (
        <div className="text-center">
          <Button type="button" variant="outline" size="sm" onClick={open} disabled={isUploading}>
            <ImageIcon className="mr-2 h-4 w-4" />
            画像を選択
          </Button>
        </div>
      )}
    </div>
  </>
);
```

最後のreturn文では、コンポーネントのUIをレンダリングしています。主に3つの部分から構成されています：

1. **グローバルドロップゾーンオーバーレイ**：

   - `AnimatePresence`と`motion.div`を使用したアニメーション効果
   - ファイルがウィンドウ上にドラッグされている時だけ表示（`isFileOver`が`true`の時）
   - 半透明の黒い背景とぼかし効果を持つ全画面オーバーレイ
   - 中央に青い点線枠のドロップ領域とアニメーションするアイコン

2. **メイン表示エリア**：

   - プレビュー表示またはドロップゾーンのいずれかを表示
   - **プレビュー表示**（`previewUrl`がある場合）：
     - 画像プレビュー（Next.jsの最適化された`Image`コンポーネント使用）
     - 無効化されていない場合は右上に削除ボタン
     - アップロード中は下部に進捗バー
   - **ドロップゾーン**（`previewUrl`がない場合）：
     - `react-dropzone`の設定を適用（`getRootProps`と`getInputProps`）
     - ドラッグ中はスタイルが変化（青い枠と背景色）
     - アニメーションするアイコンとテキスト
     - コンポーネントが無効な場合は半透明に

3. **選択ボタン**：
   - プレビューが表示されておらず、コンポーネントが無効でない場合に表示
   - クリックでファイル選択ダイアログを開く（`open`関数を使用）
   - アップロード中は無効化

## Cloudflare R2クライアント設定の解説

次に、2つ目のコードブロック（`r2-client.ts`）を解説します：

```typescript
import { env } from "@/env";
import { S3Client } from "@aws-sdk/client-s3";

/**
 * R2にアクセスするためのS3クライアントを作成
 * R2はS3互換APIを提供しているため、S3クライアントで接続可能
 */
export function createR2Client() {
  // 画像アップロード機能が無効の場合はnullを返す
  if (env.ENABLE_IMAGE_UPLOAD !== "true") {
    return null;
  }

  // 必要な設定が不足している場合はnullを返す
  if (!env.CLOUDFLARE_ACCESS_KEY_ID || !env.CLOUDFLARE_SECRET_ACCESS_KEY || !env.CLOUDFLARE_ACCOUNT_ID) {
    console.warn("R2の設定情報が不足しているため、R2クライアントを作成できません");
    return null;
  }

  // S3クライアントを作成
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
    },
  });
}
```

この関数は、Cloudflare R2ストレージにアクセスするためのS3互換クライアントを作成します：

1. 環境変数から設定情報を取得
2. 画像アップロード機能が無効の場合は`null`を返す
3. 必要な設定情報（アクセスキー、シークレットキー、アカウントID）が不足している場合は警告ログを出力して`null`を返す
4. `S3Client`を初期化して返す
   - `region`：Cloudflare R2では「auto」を指定
   - `endpoint`：Cloudflare R2のエンドポイントURL（アカウントIDを含む）
   - `credentials`：認証情報（アクセスキーとシークレットキー）

```typescript
/**
 * R2バケット名を取得
 */
export function getR2BucketName(): string | null {
  // 画像アップロード機能が無効の場合はnullを返す
  if (env.ENABLE_IMAGE_UPLOAD !== "true") {
    return null;
  }

  return env.CLOUDFLARE_R2_BUCKET || null;
}
```

この関数は、Cloudflare R2のバケット名を環境変数から取得します：

1. 画像アップロード機能が無効の場合は`null`を返す
2. 環境変数に設定されたバケット名、または設定がなければ`null`を返す

```typescript
/**
 * R2のパブリックURLを取得
 */
export function getR2PublicUrl(): string | null {
  // 画像アップロード機能が無効の場合はnullを返す
  if (env.ENABLE_IMAGE_UPLOAD !== "true") {
    return null;
  }

  return env.CLOUDFLARE_PUBLIC_URL || null;
}
```

この関数は、アップロードした画像にアクセスするためのパブリックURLベースを環境変数から取得します：

1. 画像アップロード機能が無効の場合は`null`を返す
2. 環境変数に設定されたパブリックURL、または設定がなければ`null`を返す

## アップロードユーティリティの解説

3つ目のコードブロック（`upload.ts`）を解説します：

```typescript
import { env } from "@/env";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

import { createR2Client, getR2BucketName, getR2PublicUrl } from "./r2-client";

/**
 * 画像アップロード機能が有効かどうかを確認
 */
export function isImageUploadEnabled(): boolean {
  return env.NEXT_PUBLIC_ENABLE_IMAGE_UPLOAD === "true";
}
```

この関数は、環境変数から画像アップロード機能が有効かどうかを確認します。`NEXT_PUBLIC_`プレフィックスは、この環境変数がクライアントサイドでも利用可能であることを示しています。

```typescript
/**
 * 署名付きアップロードURLを生成
 * クライアントサイドからR2に直接アップロードするために使用
 * @param fileType アップロードするファイルのMIMEタイプ
 * @param fileName オプションのファイル名（指定しない場合はUUIDを生成）
 * @returns 署名付きURLと、アップロード後のパブリックURLのオブジェクト
 */
export async function getSignedUploadUrl(
  fileType: string,
  fileName?: string,
): Promise<{
  signedUrl: string;
  publicUrl: string | null;
  key: string;
} | null> {
  // 画像アップロード機能が無効の場合はnullを返す
  if (!isImageUploadEnabled()) {
    return null;
  }

  const r2Client = createR2Client();
  const bucketName = getR2BucketName();
  const publicUrl = getR2PublicUrl();

  if (!r2Client || !bucketName) {
    console.warn("R2クライアントまたはバケット名が設定されていないため、署名付きURLを生成できません");
    return null;
  }

  // MIMEタイプから拡張子を取得
  const extension = getExtensionFromMimeType(fileType);
  if (!extension) {
    console.warn(`サポートされていないMIMEタイプです: ${fileType}`);
    return null;
  }

  // ファイル名が指定されていない場合はUUIDを生成
  const fileKey = fileName || `${uuidv4()}.${extension}`;

  // 署名付きURLを生成（有効期限15分）
  const putCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    ContentType: fileType,
  });

  const signedUrl = await getSignedUrl(r2Client, putCommand, { expiresIn: 900 });

  return {
    signedUrl,
    publicUrl: publicUrl ? `${publicUrl}/${fileKey}` : null,
    key: fileKey,
  };
}
```

この関数は、クライアント側から直接Cloudflare R2にファイルをアップロードするための署名付きURLを生成します：

1. 機能が無効の場合は`null`を返す
2. R2クライアント、バケット名、パブリックURLを取得
3. クライアントまたはバケット名が取得できない場合は警告ログを出力して`null`を返す
4. MIMEタイプから拡張子を取得（サポートされていない形式の場合は警告を出力して`null`を返す）
5. ファイル名が指定されていない場合は、UUID + 拡張子でファイル名を生成
6. AWS SDKの`PutObjectCommand`を作成（バケット名、ファイルキー、ContentTypeを指定）
7. `getSignedUrl`を使用して署名付きURLを生成（有効期限15分 = 900秒）
8. 署名付きURL、パブリックURL、ファイルキーを含むオブジェクトを返す

```typescript
/**
 * MIMEタイプから拡張子を取得するヘルパー関数
 * @param mimeType MIMEタイプ
 * @returns 拡張子（ピリオドなし）
 */
function getExtensionFromMimeType(mimeType: string): string | null {
  const mimeTypeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };

  return mimeTypeMap[mimeType] || null;
}
```

この関数は、MIMEタイプから対応するファイル拡張子を取得します：

1. サポートするMIMEタイプとその拡張子のマッピング定義
2. 指定されたMIMEタイプに対応する拡張子を返す（対応していない場合は`null`）

```typescript
/**
 * アップロードできる画像タイプの配列
 */
export const ACCEPTED_IMAGE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/avif": [".avif"],
};

/**
 * 最大ファイルサイズ（5MB）
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
```

最後に、定数を定義しています：

- `ACCEPTED_IMAGE_TYPES`：受け付ける画像形式（MIMEタイプと対応する拡張子）
- `MAX_FILE_SIZE`：アップロード可能な最大ファイルサイズ（5MB = 5 _ 1024 _ 1024バイト）
