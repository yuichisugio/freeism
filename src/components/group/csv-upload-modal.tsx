"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkCreateEvaluations } from "@/app/actions/evaluation";
import { checkAppOwner, checkGroupOwner } from "@/app/actions/group";
import { bulkCreateTasks, bulkUpdateFixedEvaluations, bulkUpdateTaskStatuses } from "@/app/actions/task";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectedFileCard } from "@/components/ui/upload-file-card";
import { cn } from "@/lib/utils";
import { contributionType } from "@prisma/client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Cloud, File, Loader2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

// --------------------------------------------------
// 型定義
// --------------------------------------------------
type CsvUploadModalProps = {
  isOpen: boolean;
  onCloseAction: (isOpen: boolean) => void;
  groupId: string;
};

type UploadType = "TASK_REPORT" | "CONTRIBUTION_EVALUATION" | "FIXED_CONTRIBUTION" | "TASK_STATUS";

type UseCsvUploadOptions = {
  groupId: string;
  isOpen: boolean;
  onCloseAction: (isOpen: boolean) => void;
};

type UploadTypeInfo = {
  title: string;
  description: string;
  requiredFields: string;
  optionalFields?: string;
  note?: string;
  example: string;
};

type GlobalDropZoneOverlayProps = {
  isVisible: boolean;
};

type UploadTypeRadioProps = {
  type: UploadType;
  info: UploadTypeInfo;
  isSelected: boolean;
  canUse: boolean;
  onSelect: (type: UploadType) => void;
};

type FileListProps = {
  files: File[];
  isUploading: boolean;
  onRemoveFile: (file: File) => void;
  onRemoveAll: () => void;
};

type FileUploadAreaProps = {
  uploadType: UploadType;
  isUploading: boolean;
  uploadProgress: number;
  dropzoneProps: {
    getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
    getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
    isDragActive: boolean;
    open?: () => void;
  };
  renderFileFormatInfo: () => JSX.Element;
};

type ActionButtonsProps = {
  isUploading: boolean;
  canUpload: boolean;
  onCancel: () => void;
  onUpload: () => void;
};

// --------------------------------------------------
// 定数
// --------------------------------------------------
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = { "text/csv": [".csv"] };

const REQUIRED_COLUMNS: Record<UploadType, string[]> = {
  TASK_REPORT: ["task", "contributionType"],
  CONTRIBUTION_EVALUATION: ["taskId", "contributionPoint", "evaluationLogic"],
  FIXED_CONTRIBUTION: ["id", "fixedContributionPoint", "fixedEvaluator", "fixedEvaluationLogic"],
  TASK_STATUS: ["taskId", "status"],
};

const UPLOAD_TYPE_INFO: Record<UploadType, UploadTypeInfo> = {
  TASK_REPORT: {
    title: "タスク報告",
    description: "タスクの内容やタイプを一括で登録します。",
    requiredFields: `task（タスク内容）, contributionType（貢献タイプ: ${contributionType.REWARD} または ${contributionType.NON_REWARD}）`,
    optionalFields:
      "reference（参考にした内容）, info（証拠・結果・補足情報）, auctionStartTime（オークション開始日時, YYYY-MM-DD HH:MM形式）, auctionEndTime（オークション終了日時, YYYY-MM-DD HH:MM形式）, deliveryMethod（提供方法）",
    note: `報酬あり（${contributionType.REWARD}）のタスクはオークション関連の設定が必要です。`,
    example: `Webサイトのデザイン改修,https://example.com/design,${contributionType.REWARD},プルリクURL: https://github.com/org/repo/pull/123,2023-04-01 12:00,2023-04-08 12:00,Amazonほしい物リスト`,
  },
  CONTRIBUTION_EVALUATION: {
    title: "貢献評価",
    description: "タスクに対する貢献ポイントや評価ロジックを一括で登録します。",
    requiredFields: "taskId（タスクID）, contributionPoint（貢献ポイント）, evaluationLogic（評価ロジック）",
    example: "clrqz3kp20000n4og9xq9d6mt,80,プロジェクトに大きく貢献した",
  },
  FIXED_CONTRIBUTION: {
    title: "FIXした分析結果",
    description: "分析結果を一括で登録します。",
    requiredFields: "id（タスクID）, fixedContributionPoint（ポイント）, fixedEvaluator（評価者ID）, fixedEvaluationLogic（評価ロジック）",
    optionalFields: "fixedEvaluationDate（評価日, YYYY-MM-DD形式）",
    note: "ステータスが「タスク完了(TASK_COMPLETED)」のタスクのみが対象です",
    example: "clrqz3kp20000n4og9xq9d6mt,100,clrq0001,ロジックの説明,2023-04-01",
  },
  TASK_STATUS: {
    title: "タスクステータス",
    description: "タスクのステータスを一括で更新します。",
    requiredFields: "taskId（タスクID）, status（ステータス→ PENDING・ BIDDED・ POINTS_DEPOSITED・ TASK_COMPLETED・ FIXED_EVALUATED・ POINTS_AWARDED・ ARCHIVED）",
    note: "statusに指定できる値は限定されています。大文字小文字を正確に入力してください。",
    example: "clrqz3kp20000n4og9xq9d6mt,TASK_COMPLETED",
  },
};

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

// --------------------------------------------------
// ユーティリティ関数
// --------------------------------------------------
/**
 * CSVファイルをパースしてデータを検証
 * @param file パースするCSVファイル
 * @returns パースされたデータ
 */
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

/**
 * 失敗したデータをCSVとしてエクスポート
 * @param failedData エクスポートする失敗データ
 */
const exportFailedData = (failedData: any[]) => {
  if (!failedData.length) return;

  const csv = Papa.unparse(failedData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `登録失敗データ_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// --------------------------------------------------
// カスタムフック
// --------------------------------------------------
/**
 * CSVアップロードの状態とロジックを管理するカスタムフック
 * @param groupId グループID
 * @param isOpen モーダルが開いているかどうか
 * @param onCloseAction モーダルを閉じるアクション
 * @returns アップロードの状態とハンドラー
 */
function useCsvUpload({ groupId, isOpen, onCloseAction }: UseCsvUploadOptions) {
  const [uploadType, setUploadType] = useState<UploadType>("TASK_REPORT");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [isFileOver, setIsFileOver] = useState(false);
  const [isAppOwner, setIsAppOwner] = useState(false);
  const [isGroupOwner, setIsGroupOwner] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const router = useRouter();
  const session = useSession();

  // 権限チェック
  useEffect(() => {
    async function checkPermissions() {
      try {
        if (!session?.data?.user?.id) {
          setIsAuthorized(false);
          return;
        }

        const userId = session.data.user.id;
        const [appOwnerResult, groupOwnerResult] = await Promise.all([checkAppOwner(userId), checkGroupOwner(userId, groupId)]);

        setIsAppOwner(!!appOwnerResult);
        setIsGroupOwner(!!groupOwnerResult);
        setIsAuthorized(!!appOwnerResult || !!groupOwnerResult);
      } catch (error) {
        console.error("権限チェックエラー:", error);
        setIsAuthorized(false);
      }
    }

    if (isOpen) {
      checkPermissions();
    }
  }, [groupId, isOpen, session]);

  // ファイルドロップ処理
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}のサイズが大きすぎます（上限: 5MB）`);
        return false;
      }
      return true;
    });

    setCurrentFiles((prev) => [...prev, ...validFiles]);
  }, []);

  // ドロップゾーン設定
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    onDrop,
    onDropRejected: (rejectedFiles) => {
      rejectedFiles.forEach((rejection) => {
        if (rejection.errors[0]?.code === "file-too-large") {
          toast.error(`${rejection.file.name}のサイズが大きすぎます（上限: 5MB）`);
        } else {
          toast.error(`${rejection.file.name}は無効なファイル形式です`);
        }
      });
    },
    noClick: false,
    noKeyboard: true,
    preventDropOnDocument: false,
  });

  // ウィンドウ全体へのドラッグドロップ
  useEffect(() => {
    if (!isOpen) return;

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
      // DOMのDragEventキャスト不要
      if (e.relatedTarget === null || e.relatedTarget === document.body || e.relatedTarget === document.documentElement) {
        setIsFileOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      preventDefault(e);
      setIsFileOver(false);

      // DOMのDragEventキャスト不要
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const csvFiles = files.filter((file) => file.type === "text/csv" || file.name.endsWith(".csv"));

        if (csvFiles.length < files.length) {
          toast.warning("CSVファイル以外は無視されました");
        }

        const validFiles = csvFiles.filter((file) => {
          if (file.size > MAX_FILE_SIZE) {
            toast.error(`${file.name}のサイズが大きすぎます（上限: 5MB）`);
            return false;
          }
          return true;
        });

        if (validFiles.length > 0) {
          setCurrentFiles((prev) => [...prev, ...validFiles]);
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
  }, [isOpen]);

  // モーダルクローズ時の状態リセット
  useEffect(() => {
    if (!isOpen) {
      setCurrentFiles([]);
      setUploadProgress(0);
    }
  }, [isOpen]);

  // ファイル削除
  const handleRemoveFile = useCallback((fileToRemove: File) => {
    setCurrentFiles((prev) => prev.filter((file) => file !== fileToRemove));
  }, []);

  // 全ファイル削除
  const handleRemoveAll = useCallback(() => {
    setCurrentFiles([]);
  }, []);

  // ファイルカードコンポーネント
  const fileCards = useMemo(() => {
    return currentFiles.map((file, i) => (
      <motion.div key={`${file.name}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2, delay: i * 0.05 }}>
        <SelectedFileCard name={file.name} fileSize={file.size} onRemove={() => handleRemoveFile(file)} />
      </motion.div>
    ));
  }, [currentFiles, handleRemoveFile]);

  // キャンセル処理
  const onCancel = useCallback(() => {
    if (isUploading) return;
    setCurrentFiles([]);
    setUploadProgress(0);
    onCloseAction(false);
  }, [isUploading, onCloseAction]);

  // 必要なカラム取得
  const getRequiredColumns = useCallback((type: UploadType): string[] => {
    return REQUIRED_COLUMNS[type] || [];
  }, []);

  // アップロードタイプに応じた権限チェック
  const hasPermissionForUploadType = useCallback(
    (type: UploadType): boolean => {
      if (type === "FIXED_CONTRIBUTION") {
        return isGroupOwner || isAppOwner;
      }
      return true;
    },
    [isGroupOwner, isAppOwner],
  );

  // アップロード処理
  const handleUpload = useCallback(async () => {
    if (currentFiles.length === 0) {
      toast.error("ファイルを選択してください");
      return;
    }

    if (!hasPermissionForUploadType(uploadType)) {
      toast.error(`${UPLOAD_TYPE_INFO[uploadType].title}のアップロードには権限が必要です`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const requiredColumns = getRequiredColumns(uploadType);
      const allFilesData: { file: File; data: any[] }[] = [];
      const allValidationErrors: string[] = [];

      // ファイルのパースと検証
      for (const file of currentFiles) {
        try {
          const data = await parseAndValidateCSV(file);
          const missingData = data.reduce((errors: string[], row: any, index: number) => {
            const missingColumns = requiredColumns.filter((column) => row[column] === undefined || row[column] === null || row[column] === "");

            if (missingColumns.length > 0) {
              errors.push(`「${file.name}」の「${index + 1}行目」で以下の項目が未入力です: ${missingColumns.join(", ")}`);
            }

            return errors;
          }, []);

          if (missingData.length > 0) {
            allValidationErrors.push(...missingData);
          } else {
            allFilesData.push({ file, data });
          }
        } catch (error) {
          allValidationErrors.push(`「${file.name}」のパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 検証エラーがある場合は処理中断
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

      // データの保存処理
      const totalFiles = allFilesData.length;
      let processedFiles = 0;
      let hasErrors = false;

      for (const { data } of allFilesData) {
        let result: any;

        if (uploadType === "TASK_REPORT") {
          result = await bulkCreateTasks(data, groupId);
        } else if (uploadType === "CONTRIBUTION_EVALUATION") {
          result = await bulkCreateEvaluations(data, groupId);
        } else if (uploadType === "FIXED_CONTRIBUTION") {
          result = await bulkUpdateFixedEvaluations(data, groupId);

          if (result.failedData && result.failedData.length > 0) {
            exportFailedData(result.failedData);
            toast.info(`${result.failedData.length}件のデータが登録できませんでした。CSVファイルをダウンロードして確認してください。`);
          }
        } else if (uploadType === "TASK_STATUS") {
          result = await bulkUpdateTaskStatuses(data);

          if (result.failedData && result.failedData.length > 0) {
            exportFailedData(result.failedData);
            toast.info(`${result.failedData.length}件のデータが更新できませんでした。CSVファイルをダウンロードして確認してください。`);
          }
        }

        if (result && !result.success) {
          toast.error(result.error || "データの保存中にエラーが発生しました");
          hasErrors = true;
          break;
        }

        processedFiles++;
        setUploadProgress((processedFiles / totalFiles) * 100);
      }

      if (!hasErrors) {
        toast.success("CSVファイルのアップロードが完了しました");
        onCancel();
        router.refresh();
      }
    } catch (error) {
      console.error("アップロード処理エラー:", error);
      toast.error(error instanceof Error ? error.message : "CSVファイルの処理中に予期しないエラーが発生しました");
    } finally {
      setIsUploading(false);
    }
  }, [currentFiles, uploadType, hasPermissionForUploadType, getRequiredColumns, groupId, onCancel, router]);

  // ファイルフォーマット情報表示
  const renderFileFormatInfo = useCallback(() => {
    const info = UPLOAD_TYPE_INFO[uploadType];

    // 必須フィールドとオプションフィールドをキーバリューペアに変換
    const parseFieldsToObject = (fieldsString: string): { key: string; description: string }[] => {
      if (!fieldsString) return [];

      return fieldsString
        .split(",")
        .map((field) => field.trim())
        .filter((field) => field)
        .map((field) => {
          const match = field.match(/([^（]+)（([^）]+)）/);
          if (match) {
            return { key: match[1].trim(), description: match[2].trim() };
          }
          return { key: field, description: "" };
        });
    };

    const requiredFields = parseFieldsToObject(info.requiredFields);
    const optionalFields = info.optionalFields ? parseFieldsToObject(info.optionalFields) : [];

    // すべてのフィールドを結合（必須を先に）
    const allFields = [...requiredFields, ...optionalFields];

    return (
      <div className="mb-3 space-y-4">
        {/* テーブル説明 */}
        <div className="text-sm text-gray-700">
          <p className="mb-1 font-medium">CSVファイルの形式:</p>
          <p>以下のカラムをCSVファイルに含めてください。最初の行はヘッダー行として使用してください。</p>
        </div>

        {/* テーブル形式で表示 */}
        <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {requiredFields.map((field, index) => (
                  <th key={`req-${index}`} className="border-r border-gray-200 bg-green-50 px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-700 uppercase last:border-r-0">
                    {field.key} <span className="font-normal text-green-600">*</span>
                  </th>
                ))}
                {optionalFields.map((field, index) => (
                  <th key={`opt-${index}`} className="border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase last:border-r-0">
                    {field.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white text-sm text-gray-600">
                {allFields.map((field, index) => {
                  // アップロードタイプごとにサンプルデータを作成
                  let sampleValue = "";
                  const key = field.key;

                  if (key.includes("task")) {
                    sampleValue = "カスタマーサポート機能の改善";
                  } else if (key.includes("Id") || key === "id") {
                    sampleValue = "clrqz3kp20000...";
                  } else if (key.includes("Point")) {
                    sampleValue = "100";
                  } else if (key.includes("status")) {
                    sampleValue = "TASK_COMPLETED";
                  } else if (key.includes("contribution") || key.includes("contributionType")) {
                    sampleValue = contributionType.REWARD;
                  } else if (key.includes("Logic") || key.includes("logic")) {
                    sampleValue = "作業効率の向上に貢献";
                  } else if (key.includes("Evaluator") || key.includes("evaluator")) {
                    sampleValue = "user_abc123";
                  } else if (key.includes("Date") || key.includes("date")) {
                    sampleValue = "2023-12-31";
                  } else if (key.includes("reference")) {
                    sampleValue = "https://example.com";
                  } else if (key.includes("info")) {
                    sampleValue = "PR: #123";
                  }

                  return (
                    <td key={`cell-${index}`} className="border-r border-gray-200 px-3 py-2 whitespace-nowrap last:border-r-0">
                      {sampleValue}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* カラム説明 */}
        <div className="space-y-1.5 text-sm">
          <p className="font-medium text-gray-700">カラム説明:</p>
          <ul className="list-disc space-y-1 pl-5">
            {allFields.map((field, index) => (
              <li key={`desc-${index}`} className="text-gray-600">
                <span className="font-medium">{field.key}</span>: {field.description}
                {index < requiredFields.length && <span className="ml-1 text-red-500">（必須）</span>}
              </li>
            ))}
          </ul>
        </div>

        {info.note && (
          <div className="mt-2 text-sm">
            <p className="text-gray-700">
              <span className="font-medium text-red-600">注意:</span> {info.note}
            </p>
          </div>
        )}

        <div className="mt-2 text-sm">
          <p className="text-gray-700">
            <span className="font-medium">記入例:</span> <span className="italic">{info.example}</span>
          </p>
        </div>
      </div>
    );
  }, [uploadType]);

  return {
    // 状態
    uploadType,
    isUploading,
    uploadProgress,
    currentFiles,
    isFileOver,
    isAuthorized,
    // ドロップゾーン
    dropzoneProps: { getRootProps, getInputProps, isDragActive, open },
    // ハンドラー
    setUploadType,
    handleRemoveFile,
    handleRemoveAll,
    handleUpload,
    onCancel,
    // UI生成
    fileCards,
    renderFileFormatInfo,
    // 権限
    hasPermissionForUploadType,
  };
}

// --------------------------------------------------
// サブコンポーネント
// --------------------------------------------------
/**
 * グローバルドロップゾーンオーバーレイ
 */
function GlobalDropZoneOverlay({ isVisible }: GlobalDropZoneOverlayProps) {
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
}

/**
 * アップロードタイプのラジオボタン
 */
function UploadTypeRadio({ type, info, isSelected, canUse, onSelect }: UploadTypeRadioProps) {
  return (
    <motion.div
      whileHover={{ scale: canUse ? 1.01 : 1 }}
      whileTap={{ scale: canUse ? 0.98 : 1 }}
      onClick={() => canUse && onSelect(type)}
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
}

/**
 * ファイル一覧
 */
function FileList({ files, isUploading, onRemoveFile, onRemoveAll }: FileListProps) {
  if (files.length === 0) return null;

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
}

/**
 * ファイルアップロードエリア
 */
function FileUploadArea({ isUploading, uploadProgress, dropzoneProps, renderFileFormatInfo }: FileUploadAreaProps) {
  const { getRootProps, getInputProps, isDragActive } = dropzoneProps;

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
}

/**
 * アクションボタン
 */
function ActionButtons({ isUploading, canUpload, onCancel, onUpload }: ActionButtonsProps) {
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
}

// --------------------------------------------------
// メインコンポーネント
// --------------------------------------------------
/**
 * CSVアップロードモーダル
 */
export function CsvUploadModal({ isOpen, onCloseAction, groupId }: CsvUploadModalProps) {
  const {
    uploadType,
    isUploading,
    uploadProgress,
    currentFiles,
    isFileOver,
    hasPermissionForUploadType,
    dropzoneProps,
    setUploadType,
    handleRemoveFile,
    handleRemoveAll,
    handleUpload,
    onCancel,
    renderFileFormatInfo,
  } = useCsvUpload({ groupId, isOpen, onCloseAction });

  return (
    <>
      {/* グローバルドロップゾーンオーバーレイ */}
      <GlobalDropZoneOverlay isVisible={isFileOver} />

      {/* アップロードモーダル */}
      <Dialog open={isOpen} onOpenChange={(open) => !isUploading && onCloseAction(open)}>
        <DialogContent className="flex max-h-[95vh] flex-col overflow-hidden rounded-xl border-none bg-white p-0 shadow-xl sm:max-w-[800px]" closeButton={false}>
          {/* ヘッダー */}
          <div className="relative flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
            <button
              onClick={() => !isUploading && onCloseAction(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-white transition-colors hover:bg-white/20 focus:outline-none"
              disabled={isUploading}
              aria-label="閉じる"
            >
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
              <RadioGroup value={uploadType} onValueChange={(value) => setUploadType(value as UploadType)} className="pt-2">
                <div className="grid grid-cols-1 gap-4">
                  {Object.entries(UPLOAD_TYPE_INFO).map(([type, info]) => (
                    <UploadTypeRadio
                      key={type}
                      type={type as UploadType}
                      info={info}
                      isSelected={uploadType === type}
                      canUse={hasPermissionForUploadType(type as UploadType)}
                      onSelect={setUploadType}
                    />
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
}
