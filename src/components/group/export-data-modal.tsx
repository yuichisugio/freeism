import { useEffect, useState } from "react";
import { exportGroupAnalytics, exportGroupTask } from "@/app/actions/task";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { addMonths, endOfDay, format, isAfter, isBefore, startOfDay, subMonths } from "date-fns";
import { ja } from "date-fns/locale";
import { zip } from "fflate";
import { saveAs } from "file-saver";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart as BarChartIcon, CalendarIcon, Check as CheckIcon, Download as DownloadIcon, FileIcon, Loader2 as Loader2Icon, PackageCheck, X as XIcon } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

// file-saverの型定義
declare module "file-saver";

// エクスポートの種類
type ExportType = "TASK" | "ANALYTICS";

// 分析データの型
type AnalyticsData = {
  [evaluatorName: string]: Array<{
    分析ID: string;
    タスクID: string;
    貢献ポイント: number;
    評価ロジック: string;
    評価者ID: string;
    評価者名: string;
    タスク内容: string;
    参照情報: string;
    証拠情報: string;
    ステータス: string;
    貢献タイプ: string;
    タスク作成者: string;
    グループ目標: string;
    評価方法: string;
    作成日: string;
  }>;
};

// モーダルのプロパティ
type ExportDataModalProps = {
  isOpen: boolean;
  onCloseAction: (isOpen: boolean) => void;
  groupId: string;
  groupName: string;
};

// モーダルの状態管理用
type ExportDataState = {
  exportType: ExportType;
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

// アニメーション関連の定数
const ANIMATION_VARIANTS = {
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

/**
 * データエクスポート用のモーダル
 * @param {ExportDataModalProps} props - モーダルのプロパティ
 * @returns {React.ReactNode} - モーダルのコンポーネント
 */
export function ExportDataModal({ isOpen, onCloseAction, groupId, groupName }: ExportDataModalProps) {
  // 状態管理
  const [state, setState] = useState<ExportDataState>({
    exportType: "TASK",
    isExporting: false,
    startDate: addMonths(new Date(), -6), // デフォルトは現在から6ヶ月前
    endDate: new Date(),
    isStartDateOpen: false,
    isEndDateOpen: false,
    step: 1,
    direction: 0,
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
    // エクスポート処理
    handleExport: async () => {
      try {
        updateState({ isExporting: true });

        if (state.exportType === "TASK") {
          // タスクデータはdateUtilsを使って期間チェック
          if (!dateUtils.isDateRangeValid()) {
            updateState({ isExporting: false });
            return;
          }

          // 日付範囲の設定（開始日は0時0分、終了日は23時59分59秒）
          const start = state.startDate ? startOfDay(state.startDate) : undefined;
          const end = state.endDate ? endOfDay(state.endDate) : undefined;

          await exportFunctions.handleTaskExport(start, end);
        } else {
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

    // タスクデータのエクスポート
    handleTaskExport: async (start?: Date, end?: Date) => {
      const data = await exportGroupTask(groupId, start, end);
      const filename = `${groupName}_tasks_${format(new Date(), "yyyyMMdd")}.csv`;

      // CSVに変換してダウンロード
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      saveAs(blob, filename);

      toast.success("タスクデータを正常にエクスポートしました");
      onCloseAction(false); // モーダルを閉じる
    },

    // 分析結果データのエクスポート
    handleAnalyticsExport: async () => {
      try {
        const data = (await exportGroupAnalytics(groupId, state.page, state.onlyFixed)) as AnalyticsData;

        // データなしの場合の処理を追加
        if (Object.keys(data).length === 1 && Object.keys(data)[0] === "データなし") {
          toast.info(`${state.page}ページ目にエクスポート可能な分析結果がありません。別のページを選択してください。`);
          return; // これ以上処理を続けない
        }

        // 各評価者ごとにCSVファイルを作成
        const zipData: { [key: string]: Uint8Array } = {};

        // ファイル名の作成（グループ名、日付、ページ数を含む）
        const baseFilename = `${groupName}_analytics_page${state.page}_${format(new Date(), "yyyyMMdd")}`;

        // 各評価者のデータをCSV化してZIPに追加
        for (const [evaluatorName, evaluatorData] of Object.entries<any[]>(data)) {
          const csv = Papa.unparse(evaluatorData);
          // CSVファイル名を作成（評価者名とページ番号を含める）
          const fileName = `${evaluatorName}_${baseFilename}.csv`;

          // CSVデータをUint8Arrayに変換
          const encoder = new TextEncoder();
          const csvData = encoder.encode(csv);

          // ZIPファイルに追加
          zipData[fileName] = csvData;
        }

        // ZIPファイル名を作成
        const zipFilename = `${baseFilename}.zip`;

        // ZIPファイルの作成処理
        zip(zipData, (err, data) => {
          if (err) {
            console.error("ZIPファイル作成エラー:", err);
            toast.error("ZIPファイルの作成に失敗しました");
            return;
          }

          // ZIP形式でダウンロード
          const blob = new Blob([data], { type: "application/zip" });
          saveAs(blob, zipFilename);

          toast.success("分析結果データを正常にエクスポートしました");
          onCloseAction(false); // モーダルを閉じる
        });
      } catch (error) {
        // エラーの内容をそのままトーストで表示
        toast.error(error instanceof Error ? error.message : "分析結果のエクスポートに失敗しました");
        // エラーは再スローしない
      }
    },
  };

  // ナビゲーション関連の関数
  const navigationFunctions = {
    // 次のステップに進む
    nextStep: () => {
      if (state.exportType === "TASK") {
        // タスクデータの場合
        if (state.step < 2) {
          updateState({ direction: 1, step: state.step + 1 });
        } else {
          exportFunctions.handleExport();
        }
      } else {
        // 分析結果データの場合（期間指定ステップをスキップ）
        if (state.step < 2) {
          updateState({ direction: 1, step: 2 });
        } else {
          exportFunctions.handleExport();
        }
      }
    },

    // 前のステップに戻る
    prevStep: () => {
      if (state.step > 1) {
        updateState({ direction: -1, step: 1 });
      }
    },

    // モーダルのステップに応じた「次へ」ボタンの表示を決定
    renderNextButtonText: () => {
      if (state.isExporting) return "処理中...";

      if ((state.step === 2 && state.exportType === "TASK") || (state.step === 2 && state.exportType === "ANALYTICS")) {
        return (
          <>
            <DownloadIcon className="mr-2 h-4 w-4" />
            エクスポートする
          </>
        );
      }

      return "次へ進む";
    },

    // 「次へ」ボタンの無効状態を決定
    isNextButtonDisabled: () => {
      if (state.isExporting) return true;

      // タスクデータで期間選択ステップの場合のみ日付チェック
      if (state.step === 2 && state.exportType === "TASK") {
        if (!state.startDate || !state.endDate) return true;
      }

      return false;
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

    // 表示すべきステップコンポーネントを決定
    getStepComponent: () => {
      if (state.step === 1) {
        return <ExportTypeSelectionStep />;
      } else if (state.exportType === "TASK") {
        return <DateRangeSelectionStep />;
      } else {
        return <PageSelectionStep />;
      }
    },
  };

  // サブコンポーネント: ステッププログレス
  const StepProgress = () => {
    // タスクデータの場合は2ステップ、分析結果データの場合も2ステップ

    return (
      <div className="mt-5 mb-1 flex items-center">
        <div className="flex w-full items-center space-x-3">
          <StepCircle step={1} currentStep={state.step} />
          <StepLine isActive={state.step > 1} />
          <StepCircle step={2} currentStep={state.step} />
        </div>
      </div>
    );
  };

  // サブコンポーネント: ステップサークル
  const StepCircle = ({ step, currentStep }: { step: number; currentStep: number }) => (
    <motion.div
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full border border-white text-xs font-medium",
        step === currentStep ? "text-blue-600" : "text-white",
        step === 1 ? "ml-4" : "mr-4",
      )}
      variants={ANIMATION_VARIANTS.circle}
      animate={step === currentStep ? "active" : "inactive"}
    >
      <motion.div
        animate={
          step === currentStep
            ? {
                scale: [1, 1.2, 1],
                transition: {
                  duration: 1.5,
                  repeat: Infinity,
                  repeatDelay: 0.5,
                  ease: "easeInOut",
                },
              }
            : { scale: 1 }
        }
        className="flex h-full w-full items-center justify-center"
      >
        {step}
      </motion.div>
    </motion.div>
  );

  // サブコンポーネント: ステップライン
  const StepLine = ({ isActive }: { isActive: boolean }) => (
    <motion.div
      className="h-[2px] flex-1 origin-left bg-blue-300"
      animate={{
        scaleX: isActive ? 1 : 0.5,
        backgroundColor: isActive ? "rgba(255, 255, 255, 0.8)" : "rgba(219, 234, 254, 0.8)",
      }}
      transition={{
        scaleX: { duration: 0.5 },
        backgroundColor: { duration: 0.3 },
      }}
    />
  );

  // サブコンポーネント: ステップラベル
  const StepLabels = () => (
    <div className="flex justify-between text-sm text-blue-100">
      <span className="ml-4 pt-2">データ選択</span>
      <span className="mr-4 pt-2">{state.exportType === "TASK" ? "期間指定" : "ページ指定"}</span>
    </div>
  );

  // サブコンポーネント: データ選択ステップ
  const ExportTypeSelectionStep = () => (
    <motion.div key="step1" custom={state.direction} variants={ANIMATION_VARIANTS.step} initial="enter" animate="center" exit="exit" className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">エクスポートするデータを選択</h3>
        <p className="text-sm text-gray-500">エクスポートしたいデータの種類を選択してください</p>

        <RadioGroup value={state.exportType} onValueChange={(value) => updateState({ exportType: value as ExportType })} className="pt-2">
          <div className="grid grid-cols-1 gap-4">
            <TaskDataCard />
            <AnalyticsDataCard />
          </div>
        </RadioGroup>

        {/* 分析結果データが選択されている場合にのみ表示するチェックボックスオプション */}
        {state.exportType === "ANALYTICS" && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.1 }} className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="onlyFixed"
                checked={state.onlyFixed}
                onCheckedChange={(checked) => updateState({ onlyFixed: checked as boolean })}
                className="border-blue-300 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500"
              />
              <div>
                <label htmlFor="onlyFixed">
                  <p className="cursor-pointer text-sm font-medium text-blue-800">FIX済みの分析結果のみ</p>
                  <p className="text-xs text-blue-600">チェックを入れると、ステータスが「POINTS_AWARDED」のタスクのみをエクスポートします。</p>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );

  // サブコンポーネント: タスクデータカード
  const TaskDataCard = () => (
    <motion.div
      variants={ANIMATION_VARIANTS.card}
      animate={state.exportType === "TASK" ? "selected" : "unselected"}
      whileHover="hover"
      whileTap="tap"
      className="relative cursor-pointer rounded-lg border-2 p-4"
      onClick={() => updateState({ exportType: "TASK" })}
    >
      <div className="flex items-start">
        <RadioGroupItem value="TASK" id="task" className="absolute mt-1 mr-4 opacity-0 data-[state=checked]:text-blue-500" />
        <div className="flex-1">
          <div className="flex items-center">
            <FileIcon className="mr-2 h-5 w-5 text-blue-500" />
            <span className="font-medium text-gray-900">タスクデータ</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            グループ内のすべてのタスク情報をCSV形式でエクスポートします。タスク内容や貢献ポイントなどが含まれます。
            <span className="mt-1 block text-gray-400 italic">期間指定が必要です。</span>
          </p>
        </div>
      </div>
    </motion.div>
  );

  // サブコンポーネント: 分析結果データカード
  const AnalyticsDataCard = () => (
    <motion.div
      variants={ANIMATION_VARIANTS.card}
      animate={state.exportType === "ANALYTICS" ? "selected" : "unselected"}
      whileHover="hover"
      whileTap="tap"
      className="relative cursor-pointer rounded-lg border-2 p-4"
      onClick={() => updateState({ exportType: "ANALYTICS" })}
    >
      <div className="flex items-start">
        <RadioGroupItem value="ANALYTICS" id="analytics" className="absolute mt-1 mr-4 opacity-0 data-[state=checked]:text-blue-500" />
        <div className="flex-1">
          <div className="flex items-center">
            <BarChartIcon className="mr-2 h-5 w-5 text-purple-500" />
            <span className="font-medium text-gray-900">分析結果データ</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            グループの分析結果をCSV形式でエクスポートします。各タスクの評価結果や集計データが含まれます。 評価者ごとにCSVファイルが分けられ、ZIPファイルとしてダウンロードされます。
            <span className="mt-1 block text-gray-400 italic">ページ指定のみ必要です。期間指定は不要です。</span>
          </p>
        </div>
      </div>
    </motion.div>
  );

  // サブコンポーネント: 期間指定ステップ
  const DateRangeSelectionStep = () => (
    <motion.div key="step2" custom={state.direction} variants={ANIMATION_VARIANTS.step} initial="enter" animate="center" exit="exit" className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">エクスポート期間を指定</h3>
        <p className="text-sm text-gray-500">エクスポートするデータの期間を指定します（最大6ヶ月間）</p>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <DateSelector
            label="開始日"
            date={state.startDate}
            isOpen={state.isStartDateOpen}
            onOpenChange={(isOpen) => updateState({ isStartDateOpen: isOpen })}
            onSelect={(date) => updateState({ startDate: date, isStartDateOpen: false })}
            disabled={dateUtils.isStartDateDisabled}
          />
          <DateSelector
            label="終了日"
            date={state.endDate}
            isOpen={state.isEndDateOpen}
            onOpenChange={(isOpen) => updateState({ isEndDateOpen: isOpen })}
            onSelect={(date) => updateState({ endDate: date, isEndDateOpen: false })}
            disabled={dateUtils.isEndDateDisabled}
          />
        </div>

        <DateRangeSummary />
      </div>
    </motion.div>
  );

  // サブコンポーネント: 日付選択
  const DateSelector = ({
    label,
    date,
    isOpen,
    onOpenChange,
    onSelect,
    disabled,
  }: {
    label: string;
    date?: Date;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSelect: (date?: Date) => void;
    disabled: (date: Date) => boolean;
  }) => (
    <div className="space-y-2">
      <Label htmlFor={`${label}-date`} className="text-sm text-gray-700">
        {label}
      </Label>
      <Popover open={isOpen} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-gray-400", date && "border-gray-300 text-gray-900")} id={`${label}-date`}>
              <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
              {date ? format(date, "yyyy年MM月dd日", { locale: ja }) : "日付を選択"}
            </Button>
          </motion.div>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-lg border p-0 shadow-lg" align="center" side="bottom" sideOffset={5}>
          <Calendar mode="single" selected={date} onSelect={onSelect} defaultMonth={date} disabled={disabled} initialFocus locale={ja} className="rounded-md border-0" />
        </PopoverContent>
      </Popover>
    </div>
  );

  // サブコンポーネント: 期間サマリー
  const DateRangeSummary = () => (
    <AnimatePresence>
      {state.startDate && state.endDate && (
        <motion.div
          className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-start">
            <CheckIcon className="mt-0.5 mr-2 h-5 w-5 flex-shrink-0 text-blue-500" />
            <div>
              <p className="font-medium">
                選択された期間: {format(state.startDate, "yyyy年MM月dd日", { locale: ja })} 〜 {format(state.endDate, "yyyy年MM月dd日", { locale: ja })}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // サブコンポーネント: ページ選択ステップ
  const PageSelectionStep = () => (
    <motion.div key="step2" custom={state.direction} variants={ANIMATION_VARIANTS.step} initial="enter" animate="center" exit="exit" className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">ページを指定</h3>
        <p className="text-sm text-gray-500">データは1ページあたり200件ずつ表示されます。取得したいデータのページを選択してください。</p>

        <div className="pt-2">
          <Label htmlFor="page-select" className="text-sm text-gray-700">
            ページ番号
          </Label>
          <Select value={state.page.toString()} onValueChange={(value) => updateState({ page: parseInt(value) })}>
            <SelectTrigger className="mt-2 w-full">
              <SelectValue placeholder="ページを選択" />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((pageNum) => (
                <SelectItem key={pageNum} value={pageNum.toString()}>
                  {pageNum}ページ目 ({(pageNum - 1) * 200 + 1}〜{pageNum * 200}件)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PageSummary />
      </div>
    </motion.div>
  );

  // サブコンポーネント: ページサマリー
  const PageSummary = () => (
    <motion.div
      className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start">
        <PackageCheck className="mt-0.5 mr-2 h-5 w-5 flex-shrink-0 text-blue-500" />
        <div>
          <p className="font-medium">
            選択されたページ: {state.page}ページ目 ({(state.page - 1) * 200 + 1}〜{state.page * 200}件)
          </p>
          <p className="mt-1">
            エクスポートされたデータは評価者ごとに分割され、ZIPファイルとしてダウンロードされます。
            {state.onlyFixed && (
              <>
                <br />
                <span className="font-medium text-blue-700">
                  FIX済みの分析結果のみ（ステータス「POINTS_AWARDED」）がエクスポートされます。 各タスクの固定評価情報（貢献ポイント、評価ロジック、評価者、評価日、提出者）が含まれます。
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );

  // サブコンポーネント: アクションボタン
  const ActionButtons = () => (
    <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
      {state.step > 1 ? (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button variant="outline" onClick={navigationFunctions.prevStep} disabled={state.isExporting} className="text-gray-700">
            前へ戻る
          </Button>
        </motion.div>
      ) : (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button variant="outline" onClick={() => onCloseAction(false)} disabled={state.isExporting} className="text-gray-700">
            キャンセル
          </Button>
        </motion.div>
      )}

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          onClick={navigationFunctions.nextStep}
          disabled={navigationFunctions.isNextButtonDisabled()}
          className={cn("relative min-w-[120px] text-white", state.step === 2 ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600")}
        >
          {state.isExporting && (
            <motion.div className="mr-2" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <Loader2Icon className="h-4 w-4" />
            </motion.div>
          )}
          {navigationFunctions.renderNextButtonText()}
        </Button>
      </motion.div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      {/* カレンダーを常にした表示にするために、translate-y-[-40vh]で、モーダルごと少し上に表示 */}
      <DialogContent className="h-[95vh] overflow-y-auto rounded-xl border-none bg-white p-0 shadow-xl sm:max-w-[600px]" closeButton={false}>
        <div className="relative bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
          <button
            onClick={() => onCloseAction(false)}
            className="absolute top-4 right-4 rounded-full p-1.5 text-white transition-colors hover:bg-white/20 focus:outline-none"
            disabled={state.isExporting}
            aria-label="閉じる"
          >
            <XIcon className="h-5 w-5" />
          </button>

          <DialogTitle className="pr-8 text-2xl font-bold tracking-tight">データをエクスポート</DialogTitle>
          <p className="mt-1 text-sm text-blue-100">{groupName} のデータをCSV形式でダウンロードします</p>

          {/* ステッププログレス */}
          <StepProgress />
          <StepLabels />
        </div>

        {/* コンテンツエリア */}
        <div className="relative overflow-y-auto p-6">
          <AnimatePresence custom={state.direction} mode="wait">
            {navigationFunctions.getStepComponent()}
          </AnimatePresence>
        </div>

        {/* アクションボタン */}
        <ActionButtons />
      </DialogContent>
    </Dialog>
  );
}
