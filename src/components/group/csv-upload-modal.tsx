"use client";

import type { UploadType } from "@/hooks/modal/use-csv-upload";
import type { DropzoneInputProps, DropzoneRootProps } from "react-dropzone";
import React, { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectedFileCard } from "@/components/ui/upload-file-card";
import { globalDropOverlay, UPLOAD_TYPE_INFO, useCsvUpload } from "@/hooks/modal/use-csv-upload";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Cloud, File, Loader2, X } from "lucide-react";

// --------------------------------------------------

/**
 * CSVアップロードモーダルのprops
 */
type CsvUploadModalProps = {
  isOpen: boolean;
  onCloseAction: (isOpen: boolean) => void;
  groupId: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グローバルドロップゾーンオーバーレイのprops
 */
type GlobalDropZoneOverlayProps = {
  isVisible: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アップロードタイプのラジオボタンのprops
 */
type UploadTypeRadioProps = {
  type: string;
  info: {
    title: string;
    description: string;
    note?: string;
  };
  isSelected: boolean;
  canUse: boolean;
  onSelect: (type: UploadType) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ファイル一覧のprops
 */
type FileListProps = {
  files: File[];
  isUploading: boolean;
  onRemoveFile: (file: File) => void;
  onRemoveAll: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ファイルアップロードエリアのprops
 */
type FileUploadAreaProps = {
  uploadType: string;
  isUploading: boolean;
  uploadProgress: number;
  dropzoneProps: {
    getRootProps: () => DropzoneRootProps;
    getInputProps: () => DropzoneInputProps;
    isDragActive: boolean;
    open?: () => void;
  };
  renderFileFormatInfo: () => React.ReactNode;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アクションボタンのprops
 */
type ActionButtonsProps = {
  isUploading: boolean;
  canUpload: boolean;
  onCancel: () => void;
  onUpload: () => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グローバルドロップゾーンオーバーレイ
 */
const GlobalDropZoneOverlay = memo(function GlobalDropZoneOverlay({ isVisible }: GlobalDropZoneOverlayProps) {
  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]" initial="hidden" animate="visible" exit="exit" variants={globalDropOverlay}>
        <motion.div
          className="mx-auto flex h-[90vh] w-[95vw] max-w-[1000px] flex-col items-center rounded-xl border-2 border-dashed border-blue-500 bg-white/95 p-8 shadow-2xl"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 20 }}
        >
          <motion.div animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, repeatType: "loop" }}>
            <Cloud className="mb-4 h-20 w-20 text-blue-500" />
          </motion.div>
          <h2 className="mb-2 text-2xl font-bold text-blue-500">ファイルをドロップして追加</h2>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アップロードタイプのラジオボタン
 */
const UploadTypeRadio = memo(function UploadTypeRadio({ type, info, isSelected, canUse, onSelect }: UploadTypeRadioProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const handleSelect = useCallback(() => {
    if (canUse) {
      onSelect(type as UploadType);
    }
  }, [canUse, onSelect, type]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <motion.div
      whileHover={{ scale: canUse ? 1.01 : 1 }}
      whileTap={{ scale: canUse ? 0.98 : 1 }}
      onClick={handleSelect}
      className={cn("relative cursor-pointer rounded-lg border-2 p-4", isSelected ? "border-blue-500" : "border-gray-200", !canUse && "cursor-not-allowed opacity-70")}
    >
      <div className="flex items-start">
        <RadioGroupItem value={type} id={type.toLowerCase()} className="absolute mt-1 mr-4 opacity-0 data-[state=checked]:text-blue-500" disabled={!canUse} />
        <div className="flex-1">
          <Label htmlFor={type.toLowerCase()} className={cn("flex cursor-pointer items-center text-base font-medium", !canUse && "cursor-not-allowed")}>
            <File className="mr-2 h-5 w-5 text-blue-500" />
            {info.title}
          </Label>
          <p className="mt-1 text-sm text-gray-500">{info.description}</p>

          {type === "FIXED_CONTRIBUTION" && !canUse && (
            <div className="mt-2 flex items-center text-xs text-amber-600">
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              <span>このアップロードにはグループオーナーまたはアプリオーナーの権限が必要です</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ファイル一覧
 */
const FileList = memo(function FileList({ files, isUploading, onRemoveFile, onRemoveAll }: FileListProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  if (files.length === 0) return null;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <motion.div className="space-y-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">選択されたファイル</h4>
        <Button variant="ghost" size="sm" onClick={onRemoveAll} disabled={isUploading} className="text-xs text-gray-500 hover:text-red-500">
          すべて削除
        </Button>
      </div>
      <div className="max-h-[240px] space-y-2 overflow-y-auto p-1">
        <AnimatePresence>
          {files.map((file, i) => (
            <motion.div key={`${file.name}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2, delay: i * 0.05 }}>
              <SelectedFileCard name={file.name} fileSize={file.size} onRemove={() => onRemoveFile(file)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ファイルアップロードエリア
 */
const FileUploadArea = memo(function FileUploadArea({ isUploading, uploadProgress, dropzoneProps, renderFileFormatInfo }: FileUploadAreaProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const { getRootProps, getInputProps, isDragActive } = dropzoneProps;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">CSVファイルをアップロード</h3>

      {/* ファイルフォーマットの説明 */}
      <div className="rounded-lg border bg-gray-50 p-4 text-sm">
        <h4 className="mb-2 font-medium text-gray-900">CSVファイルのフォーマット</h4>
        {renderFileFormatInfo()}
      </div>

      {/* ドロップゾーン */}
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all duration-200",
          isDragActive ? "scale-[1.01] border-blue-500 bg-blue-50 shadow-[0_0_0_2px_rgba(59,130,246,0.3)]" : "border-gray-300 hover:scale-[1.01] hover:bg-gray-50",
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
          <motion.div animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity, repeatType: "loop" }}>
            <Cloud className="mb-3 h-10 w-10 text-gray-400" />
          </motion.div>
          <p className="mb-2 font-medium text-gray-700">クリックまたはドラッグ&ドロップでアップロード</p>
          <p className="mb-2 text-sm text-gray-500">画面のどこにでもCSVファイルをドラッグ&ドロップできます</p>
          <p className="text-sm text-gray-500">CSVファイル (.csv) 形式のみサポート、最大5MB</p>
        </motion.div>
      </div>

      {/* アップロード進捗バー */}
      <AnimatePresence>
        {isUploading && (
          <motion.div className="mt-4 space-y-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}>
            <div className="flex items-center justify-between">
              <Label className="text-sm">アップロード進捗</Label>
              <span className="text-sm font-medium">{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アクションボタン
 */
const ActionButtons = memo(function ActionButtons({ isUploading, canUpload, onCancel, onUpload }: ActionButtonsProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <div className="flex flex-shrink-0 items-center justify-between border-t bg-gray-50 px-6 py-4">
      <Button variant="outline" onClick={onCancel} disabled={isUploading} className="text-gray-700">
        キャンセル
      </Button>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button onClick={onUpload} disabled={!canUpload} className={cn("relative min-w-[120px] bg-blue-600 text-white hover:bg-blue-700")}>
          {isUploading ? (
            <>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Loader2 className="mr-2 h-4 w-4" />
              </motion.div>
              アップロード中...
            </>
          ) : (
            <>
              <Cloud className="mr-2 h-4 w-4" />
              アップロード
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSVアップロードモーダル
 */
export const CsvUploadModal = memo(function CsvUploadModal({ isOpen, onCloseAction, groupId }: CsvUploadModalProps) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const csvUploadHook = useCsvUpload({
    groupId,
    isOpen,
    onCloseAction,
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  const { uploadType, isUploading, uploadProgress, currentFiles, isFileOver, hasPermissionForUploadType, dropzoneProps, setUploadType, handleRemoveFile, handleRemoveAll, handleUpload, onCancel, renderFileFormatInfo } = csvUploadHook;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return (
    <>
      {/* グローバルドロップゾーンオーバーレイ */}
      <GlobalDropZoneOverlay isVisible={isFileOver} />

      {/* アップロードモーダル */}
      <Dialog open={isOpen} onOpenChange={(open) => !isUploading && onCloseAction(open)}>
        <DialogContent className="flex max-h-[95vh] flex-col overflow-hidden rounded-xl border-none bg-white p-0 shadow-xl sm:max-w-[800px]" closeButton={false}>
          {/* ヘッダー */}
          <div className="relative flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
            <button onClick={() => !isUploading && onCloseAction(false)} className="absolute top-4 right-4 rounded-full p-1.5 text-white transition-colors hover:bg-white/20 focus:outline-none" disabled={isUploading} aria-label="閉じる">
              <X className="h-5 w-5" />
            </button>

            <DialogTitle className="pr-8 text-2xl font-bold tracking-tight">CSVファイルのアップロード</DialogTitle>
            <p className="mt-1 text-sm text-blue-100">CSVファイルをアップロードして一括でデータを登録します</p>
          </div>

          {/* メインコンテンツ */}
          <motion.div className="flex-grow space-y-6 overflow-y-auto p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {/* アップロードタイプ選択 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">アップロードの種類</h3>
              <RadioGroup value={uploadType} onValueChange={setUploadType} className="pt-2">
                <div className="grid grid-cols-1 gap-4">
                  {Object.entries(UPLOAD_TYPE_INFO).map(([type, info]) => (
                    <UploadTypeRadio key={type} type={type} info={info} isSelected={uploadType === type} canUse={hasPermissionForUploadType(type as UploadType)} onSelect={setUploadType} />
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* 選択されたファイル一覧 */}
            <AnimatePresence>{currentFiles.length > 0 && <FileList files={currentFiles} isUploading={isUploading} onRemoveFile={handleRemoveFile} onRemoveAll={handleRemoveAll} />}</AnimatePresence>

            {/* ファイルアップロードエリア */}
            <FileUploadArea uploadType={uploadType} isUploading={isUploading} uploadProgress={uploadProgress} dropzoneProps={dropzoneProps} renderFileFormatInfo={renderFileFormatInfo} />
          </motion.div>

          {/* アクションボタン */}
          <ActionButtons isUploading={isUploading} canUpload={!isUploading && currentFiles.length > 0 && hasPermissionForUploadType(uploadType)} onCancel={onCancel} onUpload={handleUpload} />
        </DialogContent>
      </Dialog>
    </>
  );
});
