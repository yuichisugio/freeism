"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { isR2Enabled } from "@/lib/cloudflare/r2-client-config";
import { ACCEPTED_IMAGE_TYPES, getSignedUploadUrl, MAX_FILE_SIZE } from "@/lib/cloudflare/upload";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "./button";
import { Progress } from "./progress";

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

export type ImageUploadAreaProps = {
  onImageUploaded?: (imageUrl: string) => void;
  onImageRemoved?: () => void;
  initialImageUrl?: string;
  disabled?: boolean;
};

// ファイル処理の共通ロジックを抽出した関数
function processImageFile(file: File, callback: (file: File, objectUrl: string) => void) {
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`ファイルサイズが大きすぎます（上限: 5MB）`);
    return false;
  }

  const objectUrl = URL.createObjectURL(file);
  callback(file, objectUrl);
  return true;
}

// グローバルドロップゾーンのカスタムフック
function useGlobalDropZone({ onFileDrop, isEnabled, disabled }: { onFileDrop: (file: File) => void; isEnabled: boolean; disabled: boolean }) {
  const [isFileOver, setIsFileOver] = useState(false);

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
          processImageFile(file, (processedFile) => {
            onFileDrop(processedFile);
          });
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
  }, [disabled, isEnabled, onFileDrop]);

  return { isFileOver };
}

// 画像アップロードロジックのカスタムフック
function useImageUpload({ initialImageUrl, onImageUploaded, onImageRemoved }: { initialImageUrl?: string; onImageUploaded?: (imageUrl: string) => void; onImageRemoved?: () => void }) {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // メモリリーク防止
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl !== initialImageUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, initialImageUrl]);

  const handleFileSelected = useCallback((file: File, objectUrl: string) => {
    setCurrentFile(file);
    setPreviewUrl(objectUrl);
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      try {
        setIsUploading(true);
        setUploadProgress(0);

        // 署名付きURLを取得
        const signedUrlData = await getSignedUploadUrl(file.type);
        if (!signedUrlData) {
          toast.error("アップロードURLの取得に失敗しました");
          return;
        }

        setUploadProgress(20);

        // XMLHttpRequestを使用して進捗を追跡
        const xhr = new XMLHttpRequest();

        // アップロード進捗のイベントリスナー
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            // 20%-90%の間で進捗を表示（URLの取得で20%、残りの処理で10%）
            const progress = 20 + (event.loaded / event.total) * 70;
            setUploadProgress(Math.round(progress));
          }
        });

        // 完了イベント
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);

            // 成功したらパブリックURLをコールバックで返す
            if (signedUrlData.publicUrl && onImageUploaded) {
              onImageUploaded(signedUrlData.publicUrl);
            }

            toast.success("画像をアップロードしました");
          } else {
            throw new Error(`アップロードに失敗しました: ${xhr.statusText}`);
          }
        });

        // エラーイベント
        xhr.addEventListener("error", () => {
          throw new Error("ネットワークエラーが発生しました");
        });

        // 中断イベント
        xhr.addEventListener("abort", () => {
          throw new Error("アップロードが中断されました");
        });

        // リクエストを開始
        xhr.open("PUT", signedUrlData.signedUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      } catch (error) {
        console.error("アップロードエラー:", error);
        toast.error(error instanceof Error ? error.message : "画像のアップロードに失敗しました");
      } finally {
        setIsUploading(false);
      }
    },
    [onImageUploaded],
  );

  const handleRemoveImage = useCallback(() => {
    if (previewUrl && previewUrl !== initialImageUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setCurrentFile(null);
    setPreviewUrl(null);

    if (onImageRemoved) {
      onImageRemoved();
    }
  }, [previewUrl, initialImageUrl, onImageRemoved]);

  return {
    currentFile,
    previewUrl,
    isUploading,
    uploadProgress,
    handleFileSelected,
    handleUpload,
    handleRemoveImage,
  };
}

export function ImageUploadArea({ onImageUploaded, onImageRemoved, initialImageUrl, disabled = false }: ImageUploadAreaProps) {
  // クライアントサイドで安全に環境変数チェック
  const isEnabled = isR2Enabled();

  const { currentFile, previewUrl, isUploading, uploadProgress, handleFileSelected, handleUpload, handleRemoveImage } = useImageUpload({
    initialImageUrl,
    onImageUploaded,
    onImageRemoved,
  });

  // ファイル選択時の処理
  const handleFilesSelected = useCallback(
    (file: File) => {
      handleFileSelected(file, URL.createObjectURL(file));

      // 自動アップロード開始
      if (isEnabled) {
        handleUpload(file);
      }
    },
    [isEnabled, handleFileSelected, handleUpload],
  );

  // グローバルドロップゾーンの設定
  const { isFileOver } = useGlobalDropZone({
    onFileDrop: handleFilesSelected,
    isEnabled,
    disabled: disabled || isUploading,
  });

  // ドロップゾーンの設定
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      processImageFile(file, (processedFile, objectUrl) => {
        handleFileSelected(processedFile, objectUrl);

        // 自動アップロード開始
        if (isEnabled) {
          handleUpload(processedFile);
        }
      });
    },
    [isEnabled, handleFileSelected, handleUpload],
  );

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

  // 画像アップロード機能が無効の場合
  if (!isEnabled) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
        <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
        <p className="mt-2 text-sm text-gray-500">画像アップロード機能は現在無効です</p>
      </div>
    );
  }

  return (
    <>
      {/* グローバルドロップゾーンオーバーレイ */}
      <AnimatePresence>
        {isFileOver && (
          <motion.div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={globalDropOverlay}
            role="region"
            aria-label="画像ドロップエリア"
          >
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
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 rounded-full bg-white/80 p-1 text-gray-700 shadow-md hover:bg-white hover:text-red-500"
                disabled={isUploading}
                aria-label="画像を削除"
              >
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
                <Progress value={uploadProgress} className="h-1 bg-gray-700" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress} aria-label="アップロード進捗" />
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
            role="button"
            aria-label="画像をアップロード"
            tabIndex={0}
          >
            <input {...getInputProps()} aria-label="ファイル選択" />

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
      </div>
    </>
  );
}
