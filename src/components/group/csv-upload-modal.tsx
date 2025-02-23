"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkCreateEvaluations, bulkCreateTasks } from "@/app/actions";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectedFileCard } from "@/components/ui/upload-file-card";
import { cn } from "@/lib/utils";
import { Cloud, File, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

// モーダルのprops
type CsvUploadModalProps = {
  isOpen: boolean; // モーダルが開いているかどうか
  onCloseAction: (isOpen: boolean) => void; // モーダルを閉じるための関数.関数を渡すときはActionを使う
  groupId: string; // グループのID
};

// アップロードの種類
type UploadType = "TASK_REPORT" | "CONTRIBUTION_EVALUATION";
// 最大ファイルサイズ.今回は５MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// 受け付けるファイルの種類
const ACCEPTED_FILE_TYPES = { "text/csv": [".csv"] };

/**
 * モーダルのコンポーネント
 * @param {CsvUploadModalProps} props - モーダルのprops
 * @param {boolean} isOpen - モーダルが開いているかどうか
 * @param {function} onCloseAction - モーダルを閉じるための関数.関数を渡すときはActionを使う
 * @param {string} groupId - グループのID
 * @returns {React.ReactNode} - モーダルのコンポーネント
 */
export function CsvUploadModal({ isOpen, onCloseAction, groupId }: CsvUploadModalProps) {
  // アップロードの種類。初期値はタスク報告
  const [uploadType, setUploadType] = useState<UploadType>("TASK_REPORT");
  // アップロード中かどうか
  const [isUploading, setIsUploading] = useState(false);
  // アップロードの進捗
  const [uploadProgress, setUploadProgress] = useState(0);
  // アップロードしたファイル
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  // ルーター
  const router = useRouter();

  // ドラッグ&ドロップの設定
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    onDrop: (acceptedFiles) => {
      const validFiles = acceptedFiles.filter((file) => {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name}のサイズが大きすぎます（上限: 5MB）`);
          return false;
        }
        return true;
      });
      setCurrentFiles((prev) => [...prev, ...validFiles]);
    },
    onDropRejected: (rejectedFiles) => {
      rejectedFiles.forEach((rejection) => {
        if (rejection.errors[0]?.code === "file-too-large") {
          toast.error(`${rejection.file.name}のサイズが大きすぎます（上限: 5MB）`);
        } else {
          toast.error(`${rejection.file.name}は無効なファイル形式です`);
        }
      });
    },
    noClick: true,
    noKeyboard: true,
    preventDropOnDocument: false,
  });

  // モーダルが閉じられたときにファイルをクリア
  useEffect(() => {
    if (!isOpen) {
      setCurrentFiles([]);
      setUploadProgress(0);
    }
  }, [isOpen]);

  // グローバルなドロップゾーンオーバーレイのスタイル
  const globalDropzoneStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 9999,
    pointerEvents: isDragActive ? "auto" : "none",
  };

  // ファイルを削除
  const handleRemoveFile = useCallback((fileToRemove: File) => {
    setCurrentFiles((prev) => prev.filter((file) => file !== fileToRemove));
  }, []);

  // 全てのファイルを削除
  const handleRemoveAll = useCallback(() => {
    setCurrentFiles([]);
  }, []);

  // アップロードしたファイルをカードとして表示
  const fileCards = useMemo(() => {
    return currentFiles.map((file, i) => <SelectedFileCard key={`${file.name}-${i}`} name={file.name} fileSize={file.size} onRemove={() => handleRemoveFile(file)} />);
  }, [currentFiles, handleRemoveFile]);

  // キャンセル処理
  const onCancel = useCallback(() => {
    if (isUploading) return;
    setCurrentFiles([]);
    setUploadProgress(0);
    onCloseAction(false);
  }, [isUploading, onCloseAction]);

  // CSVファイルをパースしてデータを検証
  const parseAndValidateCSV = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error),
      });
    });
  };

  // アップロード処理
  async function handleUpload() {
    if (currentFiles.length === 0) {
      toast.error("ファイルを選択してください");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const session = await auth();
      if (!session?.user?.id) {
        throw new Error("認証エラーが発生しました");
      }

      const totalFiles = currentFiles.length;
      let processedFiles = 0;

      for (const file of currentFiles) {
        const data = await parseAndValidateCSV(file);
        const requiredColumns = uploadType === "TASK_REPORT" ? ["task", "reference"] : ["taskId", "contributionPoint", "evaluationLogic"];

        // データの検証
        const missingData = data.reduce((errors: string[], row: any, index: number) => {
          requiredColumns.forEach((column) => {
            if (!row[column]) {
              errors.push(`「${column}」の「${index + 1}行目」のデータが不足しています。`);
            }
          });
          return errors;
        }, []);

        if (missingData.length > 0) {
          toast.error(
            <div className="space-y-2">
              <p className="font-semibold">データが不足しています：</p>
              {missingData.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>,
          );
          continue;
        }

        // データの保存
        const result = uploadType === "TASK_REPORT" ? await bulkCreateTasks(data, groupId, session.user.id) : await bulkCreateEvaluations(data, groupId, session.user.id);

        if (result.error) {
          toast.error(result.error);
          continue;
        }

        processedFiles++;
        setUploadProgress((processedFiles / totalFiles) * 100);
      }

      toast.success("CSVファイルのアップロードが完了しました");
      onCancel();
      router.refresh();
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("CSVファイルの処理中にエラーが発生しました");
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-app">CSVファイルのアップロード</DialogTitle>
          <DialogDescription className="text-neutral-500">タスク報告または貢献評価のCSVファイルをアップロードしてください。</DialogDescription>
        </DialogHeader>

        <div {...getRootProps()}>
          <div className="grid gap-6 py-6">
            <div className="space-y-6">
              <Label className="form-label-custom">1.アップロードの種類</Label>
              <RadioGroup defaultValue="TASK_REPORT" value={uploadType} onValueChange={(value) => setUploadType(value as UploadType)} className="grid grid-cols-2 gap-4">
                <div>
                  <RadioGroupItem value="TASK_REPORT" id="task_report" className="peer sr-only" />
                  <Label htmlFor="task_report" className="flex flex-col items-center justify-between rounded-md border-2 border-blue-200 bg-white p-4 peer-checked:border-blue-600 peer-checked:bg-blue-50 hover:bg-blue-50 [&:has([data-state=checked])]:border-blue-600">
                    <File className="mb-2 h-6 w-6 text-blue-600" />
                    タスク報告
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="CONTRIBUTION_EVALUATION" id="contribution_evaluation" className="peer sr-only" />
                  <Label htmlFor="contribution_evaluation" className="flex flex-col items-center justify-between rounded-md border-2 border-blue-200 bg-white p-4 peer-checked:border-blue-600 peer-checked:bg-blue-50 hover:bg-blue-50 [&:has([data-state=checked])]:border-blue-600">
                    <File className="mb-2 h-6 w-6 text-blue-600" />
                    貢献評価
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="form-label-custom">2.CSVファイル</Label>
                {currentFiles.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={handleRemoveAll} className="text-neutral-500 hover:text-neutral-700">
                    全て削除
                  </Button>
                )}
              </div>
              {currentFiles.length > 0 && <div className="grid gap-2">{fileCards}</div>}
              <div
                className={cn(
                  "relative flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-200 bg-white/50 px-5 py-5 text-center transition-colors hover:bg-blue-50",
                  isDragActive && "border-blue-600 bg-blue-50",
                  currentFiles.length > 0 && "border-blue-600 bg-blue-50",
                )}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                  <Cloud className="h-8 w-8 text-blue-600" />
                  <p className="text-sm text-neutral-600">{isDragActive ? "ファイルをドロップしてください" : "ドラッグ＆ドロップでファイルを選択"}</p>
                  <p className="text-xs text-neutral-500">最大ファイルサイズ: 5MB</p>
                </div>
              </div>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-center text-sm text-neutral-600">アップロード中... {Math.round(uploadProgress)}%</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isUploading}>
            キャンセル
          </Button>
          <Button onClick={handleUpload} disabled={currentFiles.length === 0 || isUploading} className="button-default-custom">
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                アップロード中...
              </>
            ) : (
              "アップロード"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
      {/* ドラッグ&ドロップのオーバーレイ。点線の範囲外でもドラッグ&ドロップが可能になるようにしている */}
      {isDragActive && (
        <div style={globalDropzoneStyle} {...getRootProps()}>
          <input {...getInputProps()} />
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <p className="text-app text-3xl">ファイルをドロップしてください</p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
