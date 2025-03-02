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
      // 必要なカラムを取得。タスク報告の場合はtaskとreference、貢献評価の場合はtaskId、contributionPoint、evaluationLogicを渡す必要があることを定義
      const requiredColumns = uploadType === "TASK_REPORT" ? ["task", "reference"] : ["taskId", "contributionPoint", "evaluationLogic"];
      // 必要なカラムを取得 - 型に基づいて明示的に定義

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
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-app">CSVファイルのアップロード</DialogTitle>
          <DialogDescription className="text-neutral-900">
            {uploadType === "TASK_REPORT" ? (
              "タスク報告のCSVファイルをアップロードしてください。"
            ) : (
              <>
                貢献評価のCSVファイルをアップロードしてください。
                <ul className="mt-2 list-disc pl-5 text-sm">
                  <li>必須項目: タスクID、タスク名、貢献度、評価ロジック</li>
                  <li>貢献度は数値で入力してください</li>
                  <li>評価ロジックは具体的な評価基準を記入してください</li>
                </ul>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-6">
          <div className="space-y-6">
            <Label className="form-label-custom">1.アップロードの種類</Label>
            <RadioGroup value={uploadType} onValueChange={(value) => setUploadType(value as UploadType)} className="grid grid-cols-2 gap-4">
              <div>
                <RadioGroupItem value="TASK_REPORT" id="task_report" className="peer sr-only" />
                <Label
                  htmlFor="task_report"
                  className={cn(
                    "flex flex-col items-center justify-between rounded-md border-2 p-4",
                    uploadType === "TASK_REPORT" ? "border-blue-600 bg-blue-50" : "border-blue-200 bg-white",
                  )}
                >
                  <File className="mb-2 h-6 w-6 text-blue-600" />
                  タスク報告
                </Label>
              </div>
              <div>
                <RadioGroupItem value="CONTRIBUTION_EVALUATION" id="contribution_evaluation" className="peer sr-only" />
                <Label
                  htmlFor="contribution_evaluation"
                  className={cn(
                    "flex flex-col items-center justify-between rounded-md border-2 p-4",
                    uploadType === "CONTRIBUTION_EVALUATION" ? "border-blue-600 bg-blue-50" : "border-blue-200 bg-white",
                  )}
                >
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
