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
    // 受け付けるファイルの種類
    accept: ACCEPTED_FILE_TYPES,
    // 最大ファイルサイズ
    maxSize: MAX_FILE_SIZE,
    // ドロップされたときに呼び出される処理
    onDrop: (acceptedFiles) => {
      // ファイルのサイズが大きすぎる場合はエラーを表示
      const validFiles = acceptedFiles.filter((file) => {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name}のサイズが大きすぎます（上限: 5MB）`);
          return false;
        }
        return true;
      });
      // ファイルをstateに追加
      setCurrentFiles((prev) => [...prev, ...validFiles]);
    },
    // ドロップされたファイルが拒否されたときに呼び出される処理
    onDropRejected: (rejectedFiles) => {
      // ファイルのサイズが大きすぎる場合はエラーを表示
      rejectedFiles.forEach((rejection) => {
        // ファイルのサイズが大きすぎる場合はエラーを表示
        if (rejection.errors[0]?.code === "file-too-large") {
          toast.error(`${rejection.file.name}のサイズが大きすぎます（上限: 5MB）`);
        } else {
          // ファイルの形式が無効な場合はエラーを表示
          toast.error(`${rejection.file.name}は無効なファイル形式です`);
        }
      });
    },
    // noClickをfalseでクリックでファイルを添付できるようにする
    noClick: false,
    // キーボードが押されたときに呼び出される処理
    noKeyboard: true,
    // ドロップされたときに呼び出される処理
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
    // ファイルを削除
    setCurrentFiles((prev) => prev.filter((file) => file !== fileToRemove));
  }, []);

  // 全てのファイルを削除
  const handleRemoveAll = useCallback(() => {
    // ファイルを削除
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
        // 1行目をヘッダーとして扱う
        header: true,
        // 空行をスキップ
        skipEmptyLines: true,
        // パースが完了したときに呼び出される処理。パースしたデータを返す
        complete: (results) => resolve(results.data),
        // パースが失敗したときに呼び出される処理。エラーを返す
        error: (error) => reject(error),
      });
    });
  };

  // アップロード処理
  async function handleUpload() {
    // ファイルが選択されていない場合はエラーを表示
    if (currentFiles.length === 0) {
      toast.error("ファイルを選択してください");
      return;
    }

    // アップロード中にする
    setIsUploading(true);
    // アップロードの進捗を0にする
    setUploadProgress(0);

    try {
      // アップロードするファイルの総数を取得
      const totalFiles = currentFiles.length;
      // アップロードしたファイルの数。初期値は０
      let processedFiles = 0;

      // アップロードするファイルを一つずつ処理
      for (const file of currentFiles) {
        // ファイルをパースしてデータを検証
        const data = await parseAndValidateCSV(file);
        // 必要なカラムを取得。タスク報告の場合はtaskとreference、貢献評価の場合はtaskId、contributionPoint、evaluationLogicを渡す必要があることを定義
        const requiredColumns = uploadType === "TASK_REPORT" ? ["task", "reference"] : ["taskId", "contributionPoint", "evaluationLogic"];

        // データの検証。reduceの第一引数にはreduceの繰り返した分の合算が入るエラーの配列、第二引数にはデータの配列、第三引数には行数を渡す
        const missingData = data.reduce((errors: string[], row: any, index: number) => {
          // 必要なカラムを取得
          requiredColumns.forEach((column) => {
            // データが不足している場合はエラーを表示
            if (!row[column]) {
              errors.push(`「${column}」の「${index + 1}行目」のデータが不足しています。`);
            }
          });
          return errors;

          // reduceの初期値は空の配列
        }, []);

        // データが不足している場合はtoastでエラーを表示
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

        // データの保存。タスク報告の場合はbulkCreateTasks、貢献評価の場合はbulkCreateEvaluationsを呼び出す
        const result = uploadType === "TASK_REPORT" ? await bulkCreateTasks(data, groupId) : await bulkCreateEvaluations(data, groupId);

        // エラーが発生した場合はエラーを表示
        if (result.error) {
          toast.error(result.error);
          continue;
        }

        // アップロードしたファイルの数をインクリメント
        processedFiles++;
        // アップロードの進捗を更新
        setUploadProgress((processedFiles / totalFiles) * 100);
      }

      // アップロードが完了したらエラーを表示
      toast.success("CSVファイルのアップロードが完了しました");
      // モーダーを閉じる
      onCancel();
      // ページを更新
      router.push(`/dashboard/group/${groupId}`);
    } catch (error) {
      // エラーが発生した場合はエラーを表示
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
          <DialogDescription className="text-neutral-900">タスク報告または貢献評価のCSVファイルをアップロードしてください。</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-6">
          <div className="space-y-6">
            <Label className="form-label-custom">1.アップロードの種類</Label>
            <RadioGroup value={uploadType} onValueChange={(value) => setUploadType(value as UploadType)} className="grid grid-cols-2 gap-4">
              <div>
                <RadioGroupItem value="TASK_REPORT" id="task_report" className="peer sr-only" />
                <Label htmlFor="task_report" className={cn("flex flex-col items-center justify-between rounded-md border-2 p-4", uploadType === "TASK_REPORT" ? "border-blue-600 bg-blue-50" : "border-blue-200 bg-white")}>
                  <File className="mb-2 h-6 w-6 text-blue-600" />
                  タスク報告
                </Label>
              </div>
              <div>
                <RadioGroupItem value="CONTRIBUTION_EVALUATION" id="contribution_evaluation" className="peer sr-only" />
                <Label htmlFor="contribution_evaluation" className={cn("flex flex-col items-center justify-between rounded-md border-2 p-4", uploadType === "CONTRIBUTION_EVALUATION" ? "border-blue-600 bg-blue-50" : "border-blue-200 bg-white")}>
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
            <div {...getRootProps()}>
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
