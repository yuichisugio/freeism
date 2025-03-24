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
import {
  ArrowLeft,
  ArrowRight,
  BarChart as BarChartIcon,
  CalendarIcon,
  Check as CheckIcon,
  Download as DownloadIcon,
  Eye as EyeIcon,
  FileIcon,
  Loader2 as Loader2Icon,
  PackageCheck,
  X as XIcon,
} from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

// file-saverの型定義
declare module "file-saver";

// エクスポートの種類
type ExportType = "TASK" | "ANALYTICS" | "";

// エクスポートの目的
type ExportPurpose = "ANALYSIS" | "VIEWING" | "";

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
        "flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-sm font-semibold",
        step === currentStep ? "bg-white text-blue-600" : "bg-blue-400/30 text-white",
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
      className="h-[2px] flex-1 origin-left"
      animate={{
        scaleX: isActive ? 1 : 0.5,
        backgroundColor: isActive ? "rgba(255, 255, 255, 0.9)" : "rgba(219, 234, 254, 0.5)",
      }}
      transition={{
        scaleX: { duration: 0.5 },
        backgroundColor: { duration: 0.3 },
      }}
    />
  );

  // サブコンポーネント: ステップラベル
  const StepLabels = () => (
    <div className="flex justify-between text-sm font-medium text-blue-100">
      <span className="ml-4 pt-2">データ選択</span>
      <span className="mr-4 pt-2">{state.exportType === "TASK" ? "期間指定" : "ページ指定"}</span>
    </div>
  );

  // サブコンポーネント: データ選択ステップ
  const ExportTypeSelectionStep = () => (
    <div className="flex flex-col gap-5 pb-2">
      <div className="mb-4 text-center">
        <h3 className="text-lg font-semibold text-gray-900">エクスポートするデータを選択</h3>
        <p className="text-muted-foreground text-sm">どのデータをエクスポートしますか？</p>
      </div>
      <RadioGroup value={state.exportType} onValueChange={(value) => updateState({ exportType: value as ExportType })}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TaskDataCard />
          <AnalyticsDataCard />
        </div>
      </RadioGroup>

      {/* 分析結果データを選択した場合のフィルターオプションを表示 */}
      <AnalyticsFilterOptions />

      {/* タスクデータを選択した場合のみ表示 */}
      {state.exportType === "TASK" && (
        <div className="mt-2">
          <div className="mb-4 text-center">
            <h3 className="text-lg font-semibold text-gray-900">エクスポートの目的を選択</h3>
            <p className="text-muted-foreground text-sm">どのような目的でエクスポートしますか？</p>
          </div>
          <RadioGroup value={state.exportPurpose} onValueChange={(value) => updateState({ exportPurpose: value as ExportPurpose })}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ExportPurposeCard value="ANALYSIS" label="分析用" description="データ分析用にTASK_COMPLETEDステータスのタスクのみをエクスポートします" icon="chart" />
              <ExportPurposeCard value="VIEWING" label="閲覧用" description="全てのステータスのタスクをエクスポートします" icon="eye" />
            </div>
          </RadioGroup>
        </div>
      )}
    </div>
  );

  // サブコンポーネント: タスクデータカード
  const TaskDataCard = () => (
    <motion.div
      variants={ANIMATION_VARIANTS.card}
      animate={state.exportType === "TASK" ? "selected" : "unselected"}
      whileHover="hover"
      whileTap="tap"
      className="relative cursor-pointer rounded-lg border-2 p-4 shadow-sm transition-all"
      onClick={() => updateState({ exportType: "TASK" })}
    >
      <div className="flex items-start">
        <RadioGroupItem value="TASK" id="task" className="absolute mt-1 mr-4 opacity-0 data-[state=checked]:text-blue-500" />
        <div className="flex-1">
          <div className="flex items-center">
            <div className={cn("mr-3 flex h-8 w-8 items-center justify-center rounded-full", state.exportType === "TASK" ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500")}>
              <FileIcon className="h-4 w-4" />
            </div>
            <span className="font-medium text-gray-900">タスクデータ</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">グループ内のすべてのタスク情報をCSV形式でエクスポートします。タスク内容や貢献ポイントなどが含まれます。</p>
          <div className="mt-2 flex items-center text-xs text-blue-600">
            <CalendarIcon className="mr-1 h-3.5 w-3.5" />
            <span className="italic">期間指定が必要です</span>
          </div>
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
      className="relative cursor-pointer rounded-lg border-2 p-4 shadow-sm transition-all"
      onClick={() => updateState({ exportType: "ANALYTICS" })}
    >
      <div className="flex items-start">
        <RadioGroupItem value="ANALYTICS" id="analytics" className="absolute mt-1 mr-4 opacity-0 data-[state=checked]:text-blue-500" />
        <div className="flex-1">
          <div className="flex items-center">
            <div className={cn("mr-3 flex h-8 w-8 items-center justify-center rounded-full", state.exportType === "ANALYTICS" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500")}>
              <BarChartIcon className="h-4 w-4" />
            </div>
            <span className="font-medium text-gray-900">分析結果データ</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            グループの分析結果をCSV形式でエクスポートします。各タスクの評価結果や集計データが含まれます。 評価者ごとにCSVファイルが分けられ、ZIPファイルとしてダウンロードされます。
          </p>
          <div className="mt-2 flex items-center text-xs text-purple-600">
            <PackageCheck className="mr-1 h-3.5 w-3.5" />
            <span className="italic">ページ指定のみ必要です（期間指定は不要）</span>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // サブコンポーネント: 分析結果フィルタオプション
  const AnalyticsFilterOptions = () => {
    if (state.exportType !== "ANALYTICS") return null;

    return (
      <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50 p-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="onlyFixed"
            checked={state.onlyFixed}
            onCheckedChange={(checked) => updateState({ onlyFixed: checked === true })}
            className="border-purple-300 text-purple-600 data-[state=checked]:bg-purple-600"
          />
          <label htmlFor="onlyFixed" className="text-sm leading-none font-medium text-purple-800 peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            <p>FIX済みの分析結果のみエクスポート</p>
            <p className="mt-1 text-xs text-purple-600">ステータスが「POINTS_AWARDED」のタスクのみエクスポートされます</p>
          </label>
        </div>
      </div>
    );
  };

  // サブコンポーネント: エクスポート目的カード
  const ExportPurposeCard = ({ value, label, description, icon }: { value: ExportPurpose; label: string; description: string; icon: "eye" | "chart" }) => (
    <motion.div
      variants={ANIMATION_VARIANTS.card}
      animate={state.exportPurpose === value ? "selected" : "unselected"}
      whileHover="hover"
      whileTap="tap"
      className="relative cursor-pointer rounded-lg border-2 p-3 shadow-sm transition-all"
      onClick={() => updateState({ exportPurpose: value })}
    >
      <div className="flex items-start">
        <RadioGroupItem value={value} id={`purpose-${value}`} className="absolute mt-1 mr-4 opacity-0" />
        <div className="flex-1">
          <div className="flex items-center">
            <div
              className={cn(
                "mr-2 flex h-6 w-6 items-center justify-center rounded-full",
                state.exportPurpose === value ? (icon === "eye" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600") : "bg-gray-100 text-gray-500",
              )}
            >
              {icon === "eye" ? <EyeIcon className="h-3.5 w-3.5" /> : <BarChartIcon className="h-3.5 w-3.5" />}
            </div>
            <span className="font-medium text-gray-900">{label}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
      </div>
    </motion.div>
  );

  // サブコンポーネント: 期間指定ステップ
  const DateRangeSelectionStep = () => (
    <motion.div key="step2" custom={state.direction} variants={ANIMATION_VARIANTS.step} initial="enter" animate="center" exit="exit" className="space-y-6">
      <div className="space-y-4">
        <div className="mb-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900">エクスポート期間を指定</h3>
          <p className="text-sm text-gray-500">エクスポートするデータの期間を指定します（最大6ヶ月間）</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
      <Label htmlFor={`${label}-date`} className="text-sm font-medium text-gray-700">
        {label}
      </Label>
      <Popover open={isOpen} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              variant="outline"
              className={cn("w-full justify-start text-left font-normal shadow-sm transition-all", !date && "text-gray-400", date && "border-blue-200 bg-blue-50 text-blue-800")}
              id={`${label}-date`}
            >
              <CalendarIcon className={cn("mr-2 h-4 w-4", date ? "text-blue-500" : "text-gray-400")} />
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
          className="mt-6 rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-start">
            <CheckIcon className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-blue-500" />
            <div>
              <p className="font-medium">
                選択された期間: {format(state.startDate, "yyyy年MM月dd日", { locale: ja })} 〜 {format(state.endDate, "yyyy年MM月dd日", { locale: ja })}
              </p>
              <p className="mt-1 text-blue-600">この期間のタスクデータをエクスポートします</p>
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
        <div className="mb-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900">ページを指定</h3>
          <p className="text-sm text-gray-500">データは1ページあたり200件ずつ表示されます。取得したいデータのページを選択してください。</p>
        </div>

        <div className="mx-auto max-w-md pt-2">
          <Label htmlFor="page-select" className="mb-2 block text-sm font-medium text-gray-700">
            ページ番号
          </Label>
          <Select value={state.page.toString()} onValueChange={(value) => updateState({ page: parseInt(value) })}>
            <SelectTrigger className="w-full border-blue-200 bg-blue-50 shadow-sm">
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
      className="mt-6 rounded-md border border-purple-100 bg-purple-50 p-4 text-sm text-purple-800"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start">
        <PackageCheck className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-purple-500" />
        <div>
          <p className="font-medium">
            選択されたページ: {state.page}ページ目 ({(state.page - 1) * 200 + 1}〜{state.page * 200}件)
          </p>
          <p className="mt-1">エクスポートされたデータは評価者ごとに分割され、ZIPファイルとしてダウンロードされます。</p>
          {state.onlyFixed && <p className="mt-2 border-t border-purple-200 pt-2 font-medium text-purple-700">FIX済みの分析結果のみ（ステータス「POINTS_AWARDED」）がエクスポートされます。</p>}
        </div>
      </div>
    </motion.div>
  );

  // サブコンポーネント: アクションボタン
  const ActionButtons = () => (
    <div className="border-t border-gray-200 bg-gray-50 p-4 sm:px-6">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          type="button"
          onClick={navigationFunctions.prevStep}
          disabled={state.step === 1}
          className={cn("flex items-center gap-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900", state.step === 1 && "pointer-events-none opacity-0")}
        >
          <ArrowLeft className="h-4 w-4" />
          前へ戻る
        </Button>

        {state.step === 1 ? (
          <Button
            type="button"
            onClick={navigationFunctions.nextStep}
            disabled={
              // タスクデータ選択時は、タイプと目的の両方を選択する必要がある
              !state.exportType || (state.exportType === "TASK" && !state.exportPurpose)
            }
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            次へ進む
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={exportFunctions.handleExport}
              disabled={state.isExporting || (state.exportType === "TASK" && (!state.startDate || !state.endDate))}
              className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700"
            >
              {state.isExporting ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  エクスポート中...
                </>
              ) : (
                <>
                  <DownloadIcon className="h-4 w-4" />
                  エクスポート
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      {/* カレンダーを常にした表示にするために、translate-y-[-40vh]で、モーダルごと少し上に表示 */}
      <DialogContent className="h-[95vh] overflow-hidden rounded-xl border-none bg-white p-0 shadow-xl sm:max-w-[600px]" closeButton={false}>
        <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white">
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
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence custom={state.direction} mode="wait">
              {/* ステップに応じたコンポーネントを直接レンダリング */}
              {state.step === 1 && <ExportTypeSelectionStep />}
              {state.step === 2 && state.exportType === "TASK" && <DateRangeSelectionStep />}
              {state.step === 2 && state.exportType === "ANALYTICS" && <PageSelectionStep />}
            </AnimatePresence>
          </div>

          {/* アクションボタン */}
          <ActionButtons />
        </div>
      </DialogContent>
    </Dialog>
  );
}
