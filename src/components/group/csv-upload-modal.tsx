"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkCreateEvaluations } from "@/app/actions/evaluation";
import { bulkCreateTasks } from "@/app/actions/task";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectedFileCard } from "@/components/ui/upload-file-card";
import { cn } from "@/lib/utils";
import { Cloud, File, Loader2, X } from "lucide-react";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

// モーダルのprops
type CsvUploadModalProps = {
  isOpen: boolean; // モーダルが開いているかどうか
  onCloseAction: (isOpen: boolean) => void; // モーダルを閉じるための関数.関数を渡すときはActionを使う
  groupId: string; // グループのID
};

// 最大ファイルサイズ.今回は５MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// 受け付けるファイルの種類
const ACCEPTED_FILE_TYPES = { "text/csv": [".csv"] };
// 型定義
type UploadType = "TASK_REPORT" | "CONTRIBUTION_EVALUATION";

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
    return currentFiles.map((file, i) => (
      <SelectedFileCard key={`${file.name}-${i}`} name={file.name} fileSize={file.size} onRemove={() => handleRemoveFile(file)} />
    ));
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

  // アップロード処理。一つでも無効な項目があれば、何もデータと登録せずに処理を中断
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
      // 必要なカラムを取得。タスク報告の場合はtaskとcontributionType、貢献評価の場合はtaskId、contributionPoint、evaluationLogicを渡す必要があることを定義
      const requiredColumns = uploadType === "TASK_REPORT" ? ["task", "contributionType"] : ["taskId", "contributionPoint", "evaluationLogic"];

      // すべてのファイルのデータと検証エラーを収集
      const allFilesData: { file: File; data: any[] }[] = [];
      const allValidationErrors: string[] = [];

      // まず、すべてのファイルをパースして検証
      for (const file of currentFiles) {
        try {
          // ファイルをパースしてデータを検証
          const data = await parseAndValidateCSV(file);

          // 各行のすべての必須フィールドが入力されているか検証。reduceの第一引数にはreduceの繰り返した分の合算が入るエラーの配列、第二引数にはデータの配列、第三引数には行数を渡す
          const missingData = data.reduce((errors: string[], row: any, index: number) => {
            // すべての必須カラムを確認
            const missingColumns = requiredColumns.filter((column) => row[column] === undefined || row[column] === null || row[column] === "");

            // 不足している項目がある場合はエラーメッセージを追加
            if (missingColumns.length > 0) {
              errors.push(`「${file.name}」の「${index + 1}行目」で以下の項目が未入力です: ${missingColumns.join(", ")}`);
            }

            return errors;
          }, []);

          // 検証エラーがある場合はエラーリストに追加、なければデータを追加
          if (missingData.length > 0) {
            allValidationErrors.push(...missingData);
          } else {
            allFilesData.push({ file, data });
          }
        } catch (error) {
          // パースに失敗した場合はエラーを表示
          allValidationErrors.push(`「${file.name}」のパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 検証エラーがある場合は処理を中断
      if (allValidationErrors.length > 0) {
        toast.error(
          <div className="space-y-2">
            <p className="font-semibold">データ検証エラー:</p>
            {allValidationErrors.map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>,
        );
        setIsUploading(false);
        return;
      }

      // 検証が成功した場合、すべてのファイルのデータを保存
      const totalFiles = allFilesData.length;
      let processedFiles = 0;
      let hasErrors = false;

      // すべてのファイルのデータを保存
      for (const { data } of allFilesData) {
        // データの保存。タスク報告の場合はbulkCreateTasks、貢献評価の場合はbulkCreateEvaluationsを呼び出す
        // アップロードタイプに応じた関数を呼び出し
        const result = uploadType === "TASK_REPORT" ? await bulkCreateTasks(data, groupId) : await bulkCreateEvaluations(data, groupId);

        // エラーがある場合は表示して処理を中断
        if (!result.success) {
          toast.error(result.error || "データの保存中にエラーが発生しました");
          hasErrors = true;
          break;
        }

        // 進捗を更新
        processedFiles++;
        // アップロードの進捗を更新
        setUploadProgress((processedFiles / totalFiles) * 100);
      }

      // 全て成功した場合のみ成功メッセージを表示
      if (!hasErrors) {
        toast.success("CSVファイルのアップロードが完了しました");
        onCancel(); // モーダルを閉じる
        router.refresh(); // データを最新化
      }
    } catch (error) {
      console.error("アップロード処理エラー:", error);
      toast.error(error instanceof Error ? error.message : "CSVファイルの処理中に予期しないエラーが発生しました");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <>
      {/* グローバルなドロップゾーンオーバーレイ */}
      <div
        {...getRootProps()}
        style={globalDropzoneStyle}
        className={cn(
          "hidden",
          isDragActive && "flex items-center justify-center bg-black/40 backdrop-blur-sm",
          "transition-all duration-200 ease-in-out",
        )}
      >
        <div className="border-primary-500 m-4 rounded-lg border-2 border-dashed bg-white p-16 text-center">
          <Cloud className="mx-auto mb-4 h-10 w-10 text-blue-500" />
          <h2 className="mb-2 text-xl font-semibold">ファイルをドロップしてアップロード</h2>
          <p className="text-sm text-gray-500">CSVファイルをドラッグ&ドロップしてください</p>
        </div>
      </div>

      {/* アップロードモーダル */}
      <Dialog open={isOpen} onOpenChange={(open) => !isUploading && onCloseAction(open)}>
        <DialogContent className="overflow-hidden rounded-xl border-none bg-white p-0 shadow-xl sm:max-w-[550px]">
          <div className="relative bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
            <button
              onClick={() => !isUploading && onCloseAction(false)}
              className="absolute top-4 right-4 rounded-full p-1 text-blue-100 opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none"
              disabled={isUploading}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">閉じる</span>
            </button>

            <DialogTitle className="text-2xl font-bold tracking-tight">CSVファイルのアップロード</DialogTitle>
            <p className="mt-1 text-sm text-blue-100">CSVファイルをアップロードして一括でデータを登録します</p>
          </div>

          <div className="space-y-6 p-6">
            {/* アップロードタイプ選択 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">アップロードの種類</h3>
              <RadioGroup value={uploadType} onValueChange={(value) => setUploadType(value as UploadType)} className="pt-2">
                <div className="grid grid-cols-1 gap-4">
                  <div
                    className={cn(
                      "relative cursor-pointer rounded-lg border-2 p-4",
                      uploadType === "TASK_REPORT" ? "border-blue-500" : "border-gray-200",
                    )}
                  >
                    <div className="flex items-start">
                      <RadioGroupItem value="TASK_REPORT" id="task_report" className="mt-1 mr-4 data-[state=checked]:text-blue-500" />
                      <div className="flex-1">
                        <Label htmlFor="task_report" className="flex cursor-pointer items-center text-base font-medium">
                          <File className="mr-2 h-5 w-5 text-blue-500" />
                          タスク報告
                        </Label>
                        <p className="mt-1 text-sm text-gray-500">タスクの内容やタイプを一括で登録します。</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "relative cursor-pointer rounded-lg border-2 p-4",
                      uploadType === "CONTRIBUTION_EVALUATION" ? "border-blue-500" : "border-gray-200",
                    )}
                  >
                    <div className="flex items-start">
                      <RadioGroupItem
                        value="CONTRIBUTION_EVALUATION"
                        id="contribution_evaluation"
                        className="mt-1 mr-4 data-[state=checked]:text-blue-500"
                      />
                      <div className="flex-1">
                        <Label htmlFor="contribution_evaluation" className="flex cursor-pointer items-center text-base font-medium">
                          <Cloud className="mr-2 h-5 w-5 text-purple-500" />
                          貢献評価
                        </Label>
                        <p className="mt-1 text-sm text-gray-500">タスクに対する貢献ポイントや評価ロジックを一括で登録します。</p>
                      </div>
                    </div>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* ファイルアップロードエリア */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">CSVファイルをアップロード</h3>
              <div
                {...getRootProps()}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                  isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50",
                  "cursor-pointer",
                )}
              >
                <input {...getInputProps()} />

                <div className="flex flex-col items-center">
                  <Cloud className="mb-3 h-10 w-10 text-gray-400" />
                  <p className="mb-2 font-medium text-gray-700">クリックまたはドラッグ&ドロップでアップロード</p>
                  <p className="text-sm text-gray-500">CSVファイル (.csv) 形式のみサポート、最大5MB</p>
                </div>
              </div>

              {/* 選択されたファイル一覧 */}
              {currentFiles.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">選択されたファイル</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAll}
                      disabled={isUploading}
                      className="text-xs text-gray-500 hover:text-red-500"
                    >
                      すべて削除
                    </Button>
                  </div>
                  <div className="max-h-[180px] space-y-2 overflow-y-auto p-1">{fileCards}</div>
                </div>
              )}

              {/* アップロード進捗バー */}
              {isUploading && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">アップロード進捗</Label>
                    <span className="text-sm font-medium">{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
            <Button variant="outline" onClick={onCancel} disabled={isUploading} className="text-gray-700">
              キャンセル
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || currentFiles.length === 0}
              className={cn("relative min-w-[120px] bg-blue-600 text-white hover:bg-blue-700")}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  アップロード中...
                </>
              ) : (
                <>
                  <Cloud className="mr-2 h-4 w-4" />
                  アップロード
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
