import { useEffect, useState } from "react";
import { exportGroupAnalytics, exportGroupTask } from "@/lib/actions/task";
import { addMonths, endOfDay, format, isAfter, isBefore, startOfDay, subMonths } from "date-fns";
import { zip } from "fflate";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { toast } from "sonner";

// エクスポートの種類
export type ExportType = "TASK" | "ANALYTICS" | "";

// エクスポートの目的
export type ExportPurpose = "ANALYSIS" | "VIEWING" | "";

// モーダルの状態管理用
export type ExportDataState = {
  exportType: ExportType;
  exportPurpose: ExportPurpose;
  isExporting: boolean;
  startDate?: Date;
  endDate?: Date;
  isStartDateOpen: boolean;
  isEndDateOpen: boolean;
  step: number;
  direction: number;
  page: number;
  onlyFixed: boolean;
};

// カスタムフックのプロパティ
export type UseExportDataModalProps = {
  isOpen: boolean;
  onCloseAction: (isOpen: boolean) => void;
  groupId: string;
  groupName: string;
};

// アニメーション関連の定数
export const ANIMATION_VARIANTS = {
  card: {
    selected: {
      scale: 1,
      borderColor: "#3b82f6",
      backgroundColor: "#eff6ff",
      transition: { stiffness: 300, damping: 15 },
    },
    unselected: {
      scale: 0.98,
      borderColor: "#e5e7eb",
      backgroundColor: "#ffffff",
      transition: { stiffness: 300, damping: 15 },
    },
    hover: {
      scale: 1.02,
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
      transition: { stiffness: 400, damping: 10 },
    },
    tap: {
      scale: 0.98,
      backgroundColor: "#f9fafb",
      transition: { stiffness: 400, damping: 17 },
    },
  },
  step: {
    enter: {
      opacity: 0,
      y: 20,
      scale: 0.95,
    },
    center: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        y: { type: "spring", stiffness: 300, damping: 25 },
        opacity: { duration: 0.3 },
        scale: { type: "spring", stiffness: 300, damping: 20 },
      },
    },
    exit: {
      y: -20,
      opacity: 0,
      scale: 0.95,
      transition: {
        y: { duration: 0.2 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      },
    },
  },
  circle: {
    inactive: {
      scale: 1,
      backgroundColor: "rgba(0, 0, 0, 0)",
    },
    active: {
      scale: 1.1,
      backgroundColor: "rgba(255, 255, 255, 1)",
      transition: {
        scale: {
          type: "spring",
          stiffness: 300,
          damping: 10,
        },
        backgroundColor: { duration: 0.3 },
      },
    },
  },
};

export function useExportDataModal({ isOpen, onCloseAction, groupId, groupName }: UseExportDataModalProps) {
  // 状態管理
  const [state, setState] = useState<ExportDataState>({
    exportType: "",
    exportPurpose: "",
    isExporting: false,
    startDate: undefined,
    endDate: undefined,
    isStartDateOpen: false,
    isEndDateOpen: false,
    step: 1,
    direction: 1,
    page: 1,
    onlyFixed: false,
  });

  // モーダルが閉じられたら状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          step: 1,
          isExporting: false,
          exportPurpose: "",
          page: 1,
          onlyFixed: false,
        }));
      }, 300);
    }
  }, [isOpen]);

  // 状態更新ヘルパー関数
  const updateState = (updates: Partial<ExportDataState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  // 日付関連のユーティリティ関数
  const dateUtils = {
    // 期間の妥当性チェック
    isDateRangeValid: (): boolean => {
      const { startDate, endDate } = state;
      if (!startDate || !endDate) return false;

      // 終了日が開始日より前の場合はエラー
      if (isBefore(endDate, startDate)) {
        toast.error("終了日は開始日より後の日付を選択してください");
        return false;
      }

      // 期間が6ヶ月を超える場合はエラー
      const sixMonthsLater = addMonths(startDate, 6);
      if (isAfter(endDate, sixMonthsLater)) {
        toast.error("エクスポート期間は最大6ヶ月までです");
        return false;
      }

      return true;
    },

    // 開始日カレンダーの無効日付を定義
    isStartDateDisabled: (date: Date): boolean => {
      const { endDate } = state;
      // カレンダーが未来の日付を選択できないようにする
      if (isAfter(date, new Date())) {
        return true;
      }

      // 終了日が設定されている場合、終了日から6ヶ月以上前の日付は選択不可
      if (endDate) {
        // 終了日より後の日付は選択不可
        if (isAfter(date, endDate)) {
          return true;
        }

        const minDate = subMonths(endDate, 6);
        return isBefore(date, minDate);
      }
      return false;
    },

    // 終了日カレンダーの無効日付を定義
    isEndDateDisabled: (date: Date): boolean => {
      const { startDate } = state;
      // カレンダーが未来の日付を選択できないようにする
      if (isAfter(date, new Date())) {
        return true;
      }

      // 開始日が設定されている場合、開始日から6ヶ月以上後の日付は選択不可
      if (startDate) {
        // 開始日より前の日付は選択不可
        if (isBefore(date, startDate)) {
          return true;
        }

        const maxDate = addMonths(startDate, 6);
        return isAfter(date, maxDate);
      }
      return false;
    },
  };

  // エクスポート関連の関数
  const exportFunctions = {
    // エクスポート処理のメイン関数
    handleExport: async () => {
      try {
        updateState({ isExporting: true });

        if (state.exportType === "TASK") {
          // タスクデータはdateUtilsを使って期間チェック
          if (!dateUtils.isDateRangeValid()) {
            updateState({ isExporting: false });
            return;
          }

          // 日付範囲の設定
          const start = state.startDate ? startOfDay(state.startDate) : undefined;
          const end = state.endDate ? endOfDay(state.endDate) : undefined;

          // タスクデータのエクスポート（分析用の場合はTASK_COMPLETEDのみ対象に）
          const onlyTaskCompleted = state.exportPurpose === "ANALYSIS";
          const taskData = await exportGroupTask(groupId, start, end, onlyTaskCompleted);

          if (taskData) {
            const filename = `${groupName}_tasks_${state.exportPurpose === "ANALYSIS" ? "analysis" : "all"}_${format(new Date(), "yyyyMMdd")}.csv`;

            // CSVに変換してダウンロード
            const csv = Papa.unparse(taskData);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            saveAs(blob, filename);

            toast.success(`タスクデータを正常にエクスポートしました${state.exportPurpose === "ANALYSIS" ? "（分析用、完了済みタスクのみ）" : ""}`);
            onCloseAction(false); // モーダルを閉じる
          }
        } else if (state.exportType === "ANALYTICS") {
          // 分析結果データは期間指定なし
          await exportFunctions.handleAnalyticsExport();
        }
      } catch (error) {
        console.error("エクスポートエラー:", error);
        toast.error(error instanceof Error ? error.message : "エクスポート中にエラーが発生しました");
      } finally {
        updateState({ isExporting: false });
      }
    },

    // 分析データのエクスポート
    handleAnalyticsExport: async () => {
      try {
        // APIからデータを取得
        const result = await exportGroupAnalytics(groupId, state.page, state.onlyFixed);

        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        // データを取得
        const resultData = result.data;

        // ファイル名を構築（日付形式: YYYYMMDD）
        const baseFilename = `${groupName}_analytics_${format(new Date(), "yyyyMMdd")}`;

        // 単一のCSVとして保存するか、Zipファイルとして保存するかを判断
        const evaluatorNames = Object.keys(resultData);
        if (evaluatorNames.length === 1) {
          // 単一の評価者のデータの場合は、そのままCSVとして保存
          const singleEvaluatorName = evaluatorNames[0];
          const singleEvaluatorData = resultData[singleEvaluatorName];
          const filename = `${baseFilename}_${singleEvaluatorName}.csv`;

          // CSVに変換してダウンロード
          const csv = Papa.unparse(singleEvaluatorData);
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
          saveAs(blob, filename);
        } else {
          // 複数の評価者のデータの場合は、Zipファイルとして保存
          const zipFilename = `${baseFilename}.zip`;
          const zipData: Record<string, Uint8Array> = {};

          // 各評価者のデータをCSVに変換して、Zipファイルに追加
          for (const evaluatorName of evaluatorNames) {
            const evaluatorData = resultData[evaluatorName];
            const filename = `${evaluatorName}.csv`;
            const csv = Papa.unparse(evaluatorData);
            // TextEncoderを使ってUTF-8でエンコード
            zipData[filename] = new TextEncoder().encode(csv);
          }

          // Zipファイルを作成
          zip(zipData, {}, (err, data) => {
            if (err) {
              console.error("Zipファイルの作成エラー:", err);
              toast.error("Zipファイルの作成中にエラーが発生しました");
              return;
            }

            // Zipファイルをダウンロード
            const blob = new Blob([data], { type: "application/zip" });
            saveAs(blob, zipFilename);
          });
        }

        toast.success(`分析結果データを正常にエクスポートしました${state.onlyFixed ? "（FIX済みのみ）" : ""}`);
        onCloseAction(false); // モーダルを閉じる
      } catch (error) {
        console.error("分析結果エクスポートエラー:", error);
        toast.error(error instanceof Error ? error.message : "分析結果のエクスポート中にエラーが発生しました");
      }
    },
  };

  // ナビゲーション関連の機能
  const navigationFunctions = {
    // 前のステップに戻る
    prevStep: () => {
      if (state.step > 1) {
        updateState({ step: state.step - 1, direction: -1 });
      }
    },

    // 次のステップに進む
    nextStep: () => {
      // ステップごとの検証
      if (state.step === 1) {
        // タスクデータの場合は目的の選択が必須
        if (state.exportType === "TASK" && !state.exportPurpose) {
          toast.error("エクスポートの目的を選択してください");
          return;
        }
        // 分析データの場合は目的の選択は不要
      } else if (state.step === 2) {
        // 日付範囲のチェック
        if (!dateUtils.isDateRangeValid()) {
          return;
        }
      }

      // 次のステップに進む
      if (state.step < 3) {
        updateState({ step: state.step + 1, direction: 1 });
      }
    },

    // 現在のステップタイトルを取得
    getCurrentStepTitle: () => {
      if (state.step === 1) {
        return "データ選択";
      } else if (state.exportType === "TASK") {
        return "期間指定";
      } else {
        return "ページ指定";
      }
    },
  };

  return {
    state,
    updateState,
    dateUtils,
    exportFunctions,
    navigationFunctions,
  };
}
