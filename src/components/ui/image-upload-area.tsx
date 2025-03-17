"use client";

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

export function ImageUploadArea({ onImageUploaded, onImageRemoved, initialImageUrl, disabled = false }: ImageUploadAreaProps) {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFileOver, setIsFileOver] = useState(false);
  const [isEnabled] = useState(isImageUploadEnabled());

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

  // メモリリーク防止
  useEffect(() => {
    return () => {
      if (previewUrl && !initialImageUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, initialImageUrl]);

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
}
