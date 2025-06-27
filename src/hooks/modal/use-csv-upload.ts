"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { checkIsPermission } from "@/actions/permission/permission";
import { bulkCreateEvaluations } from "@/actions/task/bulk-create-evaluation";
import { bulkCreateTask } from "@/actions/task/bulk-create-task";
import { bulkUpdateFixedEvaluations } from "@/actions/task/bulk-update-fix-evaluation";
import { bulkUpdateTaskStatus } from "@/actions/task/bulk-update-task-status";
import { AUCTION_CONSTANTS } from "@/lib/constants";
import { ContributionType } from "@prisma/client";
import { useSession } from "next-auth/react";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アップロードタイプ
 */
export type UploadType = "TASK_REPORT" | "CONTRIBUTION_EVALUATION" | "FIXED_CONTRIBUTION" | "TASK_STATUS";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カスタムフックの引数型
 */
export type UseCsvUploadOptions = {
  // state
  groupId: string;
  isOpen: boolean;

  // action
  onCloseAction: (isOpen: boolean) => void;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アップロードタイプの情報
 */
export type UploadTypeInfo = {
  title: string;
  description: string;
  requiredFields: string;
  optionalFields?: string;
  note?: string;
  example: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSV行の型
 */
type CsvRow = Record<string, string>;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * APIレスポンス型
 */
type ApiResponseBase = {
  success: boolean;
  error?: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク作成API用のレスポンス型
 */
type TasksApiResponse = ApiResponseBase & {
  tasks?: unknown[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 評価API用のレスポンス型
 */
type EvaluationsApiResponse = ApiResponseBase & {
  analyses?: Array<{ count: number; message: string }>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 固定評価API用のレスポンス型
 */
type FixedEvaluationsApiResponse = ApiResponseBase & {
  successData?: unknown[];
  failedData?: Record<string, unknown>[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクステータスAPI用のレスポンス型
 */
type TaskStatusesApiResponse = ApiResponseBase & {
  updatedCount?: number;
  failedCount?: number;
  failedData?: Record<string, unknown>[] | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * TaskReport用データ型
 */
type TaskReportData = {
  task: string;
  detail?: string | null;
  reference?: string | null;
  info?: string | null;
  contributionType?: string | null;
  deliveryMethod?: string | null;
  auctionStartTime?: string | Date;
  auctionEndTime?: string | Date;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ContributionEvaluation用データ型
 */
type ContributionEvaluationData = {
  taskId: string;
  contributionPoint: number;
  evaluationLogic: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * FixedContribution用データ型
 */
type FixedContributionData = {
  id: string;
  fixedContributionPoint: string | number;
  fixedEvaluatorId: string;
  fixedEvaluationLogic: string;
  fixedEvaluationDate?: string | Date;
  [key: string]: unknown;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * TaskStatus用データ型
 */
type TaskStatusData = {
  taskId: string;
  status: string;
  [key: string]: unknown;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 定数
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = { "text/csv": [".csv"] };

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 必須カラム
 */
const REQUIRED_COLUMNS: Record<UploadType, string[]> = {
  TASK_REPORT: ["task", "contributionType"],
  CONTRIBUTION_EVALUATION: ["taskId", "contributionPoint", "evaluationLogic"],
  FIXED_CONTRIBUTION: ["id", "fixedContributionPoint", "fixedEvaluatorId", "fixedEvaluationLogic"],
  TASK_STATUS: ["taskId", "status"],
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アップロードタイプの情報
 */
export const UPLOAD_TYPE_INFO: Record<UploadType, UploadTypeInfo> = {
  TASK_REPORT: {
    title: "タスク報告",
    description: "タスクの内容やタイプを一括で登録します。",
    requiredFields: `task（タスク内容）, contributionType（貢献タイプ: ${ContributionType.REWARD} または ${ContributionType.NON_REWARD}）`,
    optionalFields:
      "category（カテゴリ: " +
      AUCTION_CONSTANTS.AUCTION_CATEGORIES.slice(1).join(", ") +
      "）, reference（参考にした内容）, info（証拠・結果・補足情報）, auctionStartTime（オークション開始日時, YYYY-MM-DD HH:MM形式）, auctionEndTime（オークション終了日時, YYYY-MM-DD HH:MM形式）, deliveryMethod（提供方法）",
    note: `報酬あり（${ContributionType.REWARD}）のタスクはオークション関連の設定が必要です。未指定のカテゴリは「その他」として登録されます。`,
    example: `Webサイトのデザイン改修,${ContributionType.REWARD},デザイン,https://example.com/design,プルリクURL: https://github.com/org/repo/pull/123,2023-04-01 12:00,2023-04-08 12:00,Amazonほしい物リスト`,
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
    requiredFields:
      "id（タスクID）, fixedContributionPoint（ポイント）, fixedEvaluatorId（評価者ID）, fixedEvaluationLogic（評価ロジック）",
    optionalFields: "fixedEvaluationDate（評価日, YYYY-MM-DD形式）",
    note: "ステータスが「タスク完了(TASK_COMPLETED)」のタスクのみが対象です",
    example: "clrqz3kp20000n4og9xq9d6mt,100,clrq0001,ロジックの説明,2023-04-01",
  },
  TASK_STATUS: {
    title: "タスクステータス",
    description: "タスクのステータスを一括で更新します。",
    requiredFields:
      "taskId（タスクID）, status（ステータス→ PENDING・ POINTS_DEPOSITED・ TASK_COMPLETED・ FIXED_EVALUATED・ POINTS_AWARDED・ ARCHIVED）",
    note: "statusに指定できる値は限定されています。大文字小文字を正確に入力してください。",
    example: "clrqz3kp20000n4og9xq9d6mt,TASK_COMPLETED",
  },
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グローバルドロップオーバーレイ
 */
export const globalDropOverlay = {
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSVファイルをパースしてデータを検証
 * @param file パースするCSVファイル
 * @returns パースされたデータ
 */
export async function parseAndValidateCSV(file: File): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as CsvRow[]),
      error: (error) => reject(error),
    });
  });
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 失敗したデータをCSVとしてエクスポート
 * @param failedData エクスポートする失敗データ
 */
export function exportFailedData(failedData: Record<string, unknown>[]): void {
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
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * CSVアップロードの状態とロジックを管理するカスタムフックの戻り値
 * @param groupId グループID
 * @param isOpen モーダルが開いているかどうか
 * @param onCloseAction モーダルを閉じるアクション
 * @returns アップロードの状態とハンドラー
 */
export type CsvUploadHookReturn = {
  // 状態
  uploadType: UploadType;
  isUploading: boolean;
  uploadProgress: number;
  currentFiles: File[];
  isFileOver: boolean;
  isAuthorized: boolean;
  // ドロップゾーン
  dropzoneProps: {
    getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
    getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
    isDragActive: boolean;
    open?: () => void;
  };
  // ハンドラー
  setUploadType: (type: UploadType) => void;
  handleRemoveFile: (file: File) => void;
  handleRemoveAll: () => void;
  handleUpload: () => Promise<void>;
  onCancel: () => void;
  // UI生成
  fileCards: Array<{ key: string; file: File; index: number }>;
  renderFileFormatInfo: () => React.ReactNode;
  // 権限
  hasPermissionForUploadType: (type: UploadType) => boolean;
};

// ----------------------------------------------------------------------------------------------------

/**
 * CSVアップロードの状態とロジックを管理するカスタムフック
 * @param groupId グループID
 * @param isOpen モーダルが開いているかどうか
 * @param onCloseAction モーダルを閉じるアクション
 * @returns アップロードの状態とハンドラー
 */
export function useCsvUpload({ groupId, isOpen, onCloseAction }: UseCsvUploadOptions): CsvUploadHookReturn {
  // ---------------------------------------------------------------------------

  /**
   * state
   */
  // アップロードタイプ
  const [uploadType, setUploadType] = useState<UploadType>("TASK_REPORT");
  // アップロード中かどうか
  const [isUploading, setIsUploading] = useState(false);
  // アップロード進捗
  const [uploadProgress, setUploadProgress] = useState(0);
  // 現在のファイル
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  // ファイルオーバー
  const [isFileOver, setIsFileOver] = useState(false);
  // 権限ありかどうか
  const [isAuthorized, setIsAuthorized] = useState(false);

  // ---------------------------------------------------------------------------

  /**
   * ルーター
   */
  const router = useRouter();

  // ---------------------------------------------------------------------------

  /**
   * セッション
   */
  const session = useSession();
  const userId = useMemo(() => session?.data?.user?.id, [session]);

  // ---------------------------------------------------------------------------

  /**
   * 権限チェック
   */
  useEffect(() => {
    async function checkPermissions() {
      try {
        if (!userId) {
          setIsAuthorized(false);
          return;
        }

        const isOwnerOrRoleCheck = await checkIsPermission(userId, groupId, undefined, true);

        setIsAuthorized(isOwnerOrRoleCheck.success);
      } catch (error) {
        console.error("権限チェックエラー:", error);
        setIsAuthorized(false);
      }
    }

    if (isOpen) {
      void checkPermissions();
    }
  }, [groupId, isOpen, session, userId]);

  // ---------------------------------------------------------------------------

  /**
   * ファイルドロップ処理
   */
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

  // ---------------------------------------------------------------------------

  /**
   * ドロップゾーン設定
   */
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

  // ---------------------------------------------------------------------------

  /**
   * ウィンドウ全体へのドラッグドロップ
   */
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
      if (
        e.relatedTarget === null ||
        e.relatedTarget === document.body ||
        e.relatedTarget === document.documentElement
      ) {
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

  // ---------------------------------------------------------------------------

  /**
   * モーダルクローズ時の状態リセット
   */
  useEffect(() => {
    if (!isOpen) {
      setCurrentFiles([]);
      setUploadProgress(0);
    }
  }, [isOpen]);

  // ---------------------------------------------------------------------------

  /**
   * ファイル削除
   */
  const handleRemoveFile = useCallback((fileToRemove: File) => {
    setCurrentFiles((prev) => prev.filter((file) => file !== fileToRemove));
  }, []);

  // ---------------------------------------------------------------------------

  /**
   * 全ファイル削除
   */
  const handleRemoveAll = useCallback(() => {
    setCurrentFiles([]);
  }, []);

  // ---------------------------------------------------------------------------

  /**
   * ファイルカードコンポーネント
   */
  const fileCards = useMemo(() => {
    return currentFiles.map((file, i) => ({
      key: `${file.name}-${i}`,
      file,
      index: i,
    }));
  }, [currentFiles]);

  // ---------------------------------------------------------------------------

  /**
   * キャンセル処理
   */
  const onCancel = useCallback(() => {
    if (isUploading) return;
    setCurrentFiles([]);
    setUploadProgress(0);
    onCloseAction(false);
  }, [isUploading, onCloseAction]);

  // ---------------------------------------------------------------------------

  /**
   * 必要なカラム取得
   */
  const getRequiredColumns = useCallback((type: UploadType): string[] => {
    return REQUIRED_COLUMNS[type] ?? [];
  }, []);

  // ---------------------------------------------------------------------------

  /**
   * アップロードタイプに応じた権限チェック
   */
  const hasPermissionForUploadType = useCallback(
    (type: UploadType): boolean => {
      if (type === "FIXED_CONTRIBUTION") {
        return isAuthorized;
      }
      return true;
    },
    [isAuthorized],
  );

  // ---------------------------------------------------------------------------

  /**
   * CSVデータをTaskReportDataに変換
   */
  const convertToTaskReportData = useCallback((data: CsvRow[]): TaskReportData[] => {
    return data.map((row) => {
      // 必須フィールドのデフォルト値を空文字列に設定
      const task = typeof row.task === "string" ? row.task : "";

      // オプションフィールドはnullまたはundefinedを許容
      const detail = row.detail || null;
      const reference = row.reference || null;
      const info = row.info || null;
      const contributionType = row.contributionType || null;
      const deliveryMethod = row.deliveryMethod || null;

      // 日付フィールドはundefinedを許容
      const auctionStartTime = row.auctionStartTime;
      const auctionEndTime = row.auctionEndTime;

      return {
        task,
        detail,
        reference,
        info,
        contributionType,
        deliveryMethod,
        auctionStartTime,
        auctionEndTime,
      } as TaskReportData;
    });
  }, []);

  // ---------------------------------------------------------------------------

  /**
   * CSVデータをContributionEvaluationDataに変換
   */
  const convertToContributionEvaluationData = useCallback((data: CsvRow[]): ContributionEvaluationData[] => {
    return data.map((row) => {
      const taskId = typeof row.taskId === "string" ? row.taskId : "";
      const contributionPoint = Number(row.contributionPoint || "0");
      const evaluationLogic = typeof row.evaluationLogic === "string" ? row.evaluationLogic : "";

      return {
        taskId,
        contributionPoint,
        evaluationLogic,
      } as ContributionEvaluationData;
    });
  }, []);

  // ---------------------------------------------------------------------------

  /**
   * CSVデータをFixedContributionDataに変換
   */
  const convertToFixedContributionData = useCallback((data: CsvRow[]): FixedContributionData[] => {
    return data.map((row) => {
      const id = typeof row.id === "string" ? row.id : "";
      const fixedContributionPoint = row.fixedContributionPoint || "0";
      const fixedEvaluatorId = typeof row.fixedEvaluatorId === "string" ? row.fixedEvaluatorId : "";
      const fixedEvaluationLogic = typeof row.fixedEvaluationLogic === "string" ? row.fixedEvaluationLogic : "";
      const fixedEvaluationDate = row.fixedEvaluationDate;

      return {
        id,
        fixedContributionPoint,
        fixedEvaluatorId,
        fixedEvaluationLogic,
        fixedEvaluationDate,
      } as FixedContributionData;
    });
  }, []);

  // ---------------------------------------------------------------------------

  /**
   * CSVデータをTaskStatusDataに変換
   */
  const convertToTaskStatusData = useCallback((data: CsvRow[]): TaskStatusData[] => {
    return data.map((row) => {
      const taskId = typeof row.taskId === "string" ? row.taskId : "";
      const status = typeof row.status === "string" ? row.status : "";

      return {
        taskId,
        status,
      } as TaskStatusData;
    });
  }, []);

  // ---------------------------------------------------------------------------

  /**
   * アップロード処理
   */
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
      const allFilesData: { file: File; data: CsvRow[] }[] = [];
      const allValidationErrors: string[] = [];

      // ファイルのパースと検証
      for (const file of currentFiles) {
        try {
          const data = await parseAndValidateCSV(file);
          const missingData = data.reduce((errors: string[], row: CsvRow, index: number) => {
            // 必須カラムのチェック（型安全な方法で）
            const missingColumnsList = requiredColumns.filter((column) => {
              // rowがオブジェクトでcolumnが文字列キーとして存在するかを確認
              return typeof row === "object" && row !== null
                ? column in row
                  ? row[column] === undefined || row[column] === null || row[column] === ""
                  : true
                : true;
            });

            if (missingColumnsList.length > 0) {
              errors.push(
                `「${file.name}」の「${index + 1}行目」で以下の項目が未入力です: ${missingColumnsList.join(", ")}`,
              );
            }

            return errors;
          }, []);

          if (missingData.length > 0) {
            allValidationErrors.push(...missingData);
          } else {
            allFilesData.push({ file, data });
          }
        } catch (error) {
          allValidationErrors.push(
            `「${file.name}」のパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // 検証エラーがある場合は処理中断
      if (allValidationErrors.length > 0) {
        toast.error("データ検証エラーが発生しました");
        console.error("検証エラー:", allValidationErrors);
        setIsUploading(false);
        return;
      }

      // データの保存処理
      const totalFiles = allFilesData.length;
      let processedFiles = 0;
      let hasErrors = false;

      for (const { data } of allFilesData) {
        let result: ApiResponseBase = { success: false };

        if (uploadType === "TASK_REPORT") {
          try {
            // 安全にCSVRowをTaskReportDataに変換
            const taskData = convertToTaskReportData(data);

            // APIを呼び出し
            const taskResponse = (await bulkCreateTask(taskData, groupId)) as TasksApiResponse;

            result = {
              success: taskResponse.success,
              error: taskResponse.error,
            };
          } catch (error) {
            result = {
              success: false,
              error: error instanceof Error ? error.message : "不明なエラーが発生しました",
            };
          }
        } else if (uploadType === "CONTRIBUTION_EVALUATION") {
          try {
            // 安全にCSVRowをContributionEvaluationDataに変換
            const evalData = convertToContributionEvaluationData(data);

            // APIを呼び出し
            const evalResponse = (await bulkCreateEvaluations(evalData, groupId)) as EvaluationsApiResponse;

            result = {
              success: evalResponse.success,
              error: evalResponse.error,
            };
          } catch (error) {
            result = {
              success: false,
              error: error instanceof Error ? error.message : "不明なエラーが発生しました",
            };
          }
        } else if (uploadType === "FIXED_CONTRIBUTION") {
          try {
            // 安全にCSVRowをFixedContributionDataに変換
            const fixedData = convertToFixedContributionData(data);

            // APIを呼び出し
            const fixedResponse = (await bulkUpdateFixedEvaluations(fixedData, groupId)) as FixedEvaluationsApiResponse;

            result = {
              success: fixedResponse.success,
              error: fixedResponse.error,
            };

            // 失敗データの処理
            if (
              fixedResponse.failedData &&
              Array.isArray(fixedResponse.failedData) &&
              fixedResponse.failedData.length > 0
            ) {
              exportFailedData(fixedResponse.failedData);
              toast.info(
                `${fixedResponse.failedData.length}件のデータが登録できませんでした。CSVファイルをダウンロードして確認してください。`,
              );
            }
          } catch (error) {
            result = {
              success: false,
              error: error instanceof Error ? error.message : "不明なエラーが発生しました",
            };
          }
        } else if (uploadType === "TASK_STATUS") {
          try {
            // 安全にCSVRowをTaskStatusDataに変換
            const statusData = convertToTaskStatusData(data);

            // APIを呼び出し
            const statusResponse = (await bulkUpdateTaskStatus(statusData, userId ?? "")) as TaskStatusesApiResponse;

            result = {
              success: statusResponse.success,
              error: statusResponse.error,
            };

            // 失敗データの処理
            if (
              statusResponse.failedData &&
              Array.isArray(statusResponse.failedData) &&
              statusResponse.failedData.length > 0
            ) {
              exportFailedData(statusResponse.failedData);
              toast.info(
                `${statusResponse.failedData.length}件のデータが更新できませんでした。CSVファイルをダウンロードして確認してください。`,
              );
            }
          } catch (error) {
            result = {
              success: false,
              error: error instanceof Error ? error.message : "不明なエラーが発生しました",
            };
          }
        }

        if (!result.success) {
          toast.error(result.error ?? "データの保存中にエラーが発生しました");
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
  }, [
    currentFiles,
    uploadType,
    hasPermissionForUploadType,
    getRequiredColumns,
    groupId,
    onCancel,
    router,
    convertToTaskReportData,
    convertToContributionEvaluationData,
    convertToFixedContributionData,
    convertToTaskStatusData,
    userId,
  ]);

  // ---------------------------------------------------------------------------

  /**
   * ファイルフォーマット情報表示
   */
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
          const match = /([^（]+)（([^）]+)）/.exec(field);
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

    // React要素を返す
    return React.createElement(
      "div",
      { className: "mb-3 space-y-4" },
      // テーブル説明
      React.createElement(
        "div",
        { className: "text-sm text-gray-700" },
        React.createElement("p", { className: "mb-1 font-medium" }, "CSVファイルの形式:"),
        React.createElement(
          "p",
          null,
          "以下のカラムをCSVファイルに含めてください。最初の行はヘッダー行として使用してください。",
        ),
      ),

      // テーブル形式で表示
      React.createElement(
        "div",
        { className: "overflow-x-auto rounded-md border border-gray-200 shadow-sm" },
        React.createElement(
          "table",
          { className: "min-w-full divide-y divide-gray-200" },
          React.createElement(
            "thead",
            { className: "bg-gray-50" },
            React.createElement(
              "tr",
              null,
              requiredFields.map((field, index) =>
                React.createElement(
                  "th",
                  {
                    key: `req-${index}`,
                    className:
                      "border-r border-gray-200 bg-green-50 px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-700 uppercase last:border-r-0",
                  },
                  field.key,
                  React.createElement("span", { className: "font-normal text-green-600" }, " *"),
                ),
              ),
              optionalFields.map((field, index) =>
                React.createElement(
                  "th",
                  {
                    key: `opt-${index}`,
                    className:
                      "border-r border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-medium tracking-wider text-gray-500 uppercase last:border-r-0",
                  },
                  field.key,
                ),
              ),
            ),
          ),
          React.createElement(
            "tbody",
            null,
            React.createElement(
              "tr",
              { className: "bg-white text-sm text-gray-600" },
              allFields.map((field, index) => {
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
                  sampleValue = ContributionType.REWARD;
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

                return React.createElement(
                  "td",
                  {
                    key: `cell-${index}`,
                    className: "border-r border-gray-200 px-3 py-2 whitespace-nowrap last:border-r-0",
                  },
                  sampleValue,
                );
              }),
            ),
          ),
        ),
      ),

      // カラム説明
      React.createElement(
        "div",
        { className: "space-y-1.5 text-sm" },
        React.createElement("p", { className: "font-medium text-gray-700" }, "カラム説明:"),
        React.createElement(
          "ul",
          { className: "list-disc space-y-1 pl-5" },
          allFields.map((field, index) =>
            React.createElement(
              "li",
              { key: `desc-${index}`, className: "text-gray-600" },
              React.createElement("span", { className: "font-medium" }, field.key),
              ": ",
              field.description,
              index < requiredFields.length
                ? React.createElement("span", { className: "ml-1 text-red-500" }, "（必須）")
                : null,
            ),
          ),
        ),
      ),

      // 注意事項
      info.note &&
        React.createElement(
          "div",
          { className: "mt-2 text-sm" },
          React.createElement(
            "p",
            { className: "text-gray-700" },
            React.createElement("span", { className: "font-medium text-red-600" }, "注意:"),
            " ",
            info.note,
          ),
        ),

      // 記入例
      React.createElement(
        "div",
        { className: "mt-2 text-sm" },
        React.createElement(
          "p",
          { className: "text-gray-700" },
          React.createElement("span", { className: "font-medium" }, "記入例:"),
          " ",
          React.createElement("span", { className: "italic" }, info.example),
        ),
      ),
    );
  }, [uploadType]) as () => React.ReactNode;

  // ---------------------------------------------------------------------------

  /**
   * 戻り値
   */
  return {
    // state
    uploadType,
    isUploading,
    uploadProgress,
    currentFiles,
    isFileOver,
    isAuthorized,
    fileCards,
    dropzoneProps: { getRootProps, getInputProps, isDragActive, open },

    // action
    setUploadType,
    handleRemoveFile,
    handleRemoveAll,
    handleUpload,
    onCancel,
    renderFileFormatInfo,
    hasPermissionForUploadType,
  };
}
