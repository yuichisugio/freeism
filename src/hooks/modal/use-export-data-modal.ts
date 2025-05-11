"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { exportGroupAnalytics, exportGroupTask } from "@/lib/actions/task/task";
import { addMonths, endOfDay, format, isAfter, isBefore, startOfDay } from "date-fns";
import { zip } from "fflate";
import { saveAs } from "file-saver";
import Papa from "papaparse";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * エクスポートの種類
 */
export type ExportType = "TASK" | "ANALYTICS" | "";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * エクスポートの目的
 */
export type ExportPurpose = "ANALYSIS" | "VIEWING" | "";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モーダルの状態管理用
 */
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カスタムフックのプロパティ
 */
export type UseExportDataModalProps = {
  isOpen: boolean;
  onCloseAction: (isOpen: boolean) => void;
  groupId: string;
  groupName: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * アニメーション関連の定数
 */
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

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * カスタムフックの戻り値
 */
export type UseExportDataModalReturn = {
  state: ExportDataState;
  updateState: (updates: Partial<ExportDataState>) => void;
  dateUtils: {
    isDateRangeValid: () => boolean;
    isStartDateDisabled: (date: Date) => boolean;
    isEndDateDisabled: (date: Date) => boolean;
  };
  exportFunctions: {
    handleExport: () => Promise<void>;
    handleAnalyticsExport: () => Promise<void>;
  };
  navigationFunctions: {
    prevStep: () => void;
    nextStep: () => void;
    getCurrentStepTitle: () => string;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export function useExportDataModal({ isOpen, onCloseAction, groupId, groupName }: UseExportDataModalProps): UseExportDataModalReturn {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 状態管理
   */
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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

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

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 状態更新ヘルパー関数
  const updateState = useCallback((updates: Partial<ExportDataState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // 日付関連のユーティリティ関数
  const dateUtils = useMemo(
    () => ({
      // 日付範囲の検証
      isDateRangeValid: () => {
        if (state.exportType === "TASK") {
          // 日付が未設定の場合はエラー
          if (!state.startDate || !state.endDate) {
            toast.error("開始日と終了日を設定してください");
            return false;
          }

          // 開始日が終了日より後の場合はエラー
          if (isAfter(state.startDate, state.endDate)) {
            toast.error("開始日は終了日より前に設定してください");
            return false;
          }

          // 期間が6ヶ月を超える場合はエラー
          const maxPeriod = addMonths(state.startDate, 6);
          if (isAfter(state.endDate, maxPeriod)) {
            toast.error("期間は最大6ヶ月までです");
            return false;
          }
        }

        return true;
      },

      // 開始日の制限（過去から現在まで）
      isStartDateDisabled: (date: Date) => {
        return isAfter(date, new Date());
      },

      // 終了日の制限（開始日から6ヶ月まで）
      isEndDateDisabled: (date: Date) => {
        if (state.startDate) {
          // 開始日より前の日付は選択不可
          if (isBefore(date, state.startDate)) {
            return true;
          }

          const maxDate = addMonths(state.startDate, 6);
          return isAfter(date, maxDate);
        }
        return false;
      },
    }),
    [state],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // エクスポート関連の関数
  const exportFunctions = useMemo(
    () => ({
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
    }),
    [state, dateUtils, updateState, onCloseAction, groupId, groupName],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  // ナビゲーション関連の機能
  const navigationFunctions = useMemo(
    () => ({
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
    }),
    [state, dateUtils, updateState],
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  return {
    state,
    updateState,
    dateUtils,
    exportFunctions,
    navigationFunctions,
  };
}
