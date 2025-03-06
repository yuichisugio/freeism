import { useEffect, useState } from "react";
import { exportGroupTask } from "@/app/actions/task";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { addMonths, endOfDay, format, isAfter, isBefore, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart as BarChartIcon,
  CalendarIcon,
  Check as CheckIcon,
  Download as DownloadIcon,
  FileIcon,
  Loader2 as Loader2Icon,
  X as XIcon,
} from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

// エクスポートの種類
type ExportType = "TASK" | "ANALYTICS";

// モーダルのプロパティ
type ExportDataModalProps = {
  isOpen: boolean;
  onCloseAction: (isOpen: boolean) => void;
  groupId: string;
  groupName: string;
};

// アニメーションバリアント
const cardVariants = {
  selected: {
    scale: 1,
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
    transition: { type: "spring", stiffness: 300, damping: 15 },
  },
  unselected: {
    scale: 0.98,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    transition: { type: "spring", stiffness: 300, damping: 15 },
  },
  hover: {
    scale: 1.02,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
    transition: { type: "spring", stiffness: 400, damping: 10 },
  },
  tap: {
    scale: 0.98,
    backgroundColor: "#f9fafb",
    transition: { type: "spring", stiffness: 400, damping: 17 },
  },
};

// ステップアニメーション
const stepVariants = {
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
};

// 円のアニメーション
const circleVariants = {
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
};

/**
 * データエクスポート用のモーダル
 * @param {ExportDataModalProps} props - モーダルのプロパティ
 * @returns {React.ReactNode} - モーダルのコンポーネント
 */
export function ExportDataModal({ isOpen, onCloseAction, groupId, groupName }: ExportDataModalProps) {
  // エクスポートの種類。初期値はタスク
  const [exportType, setExportType] = useState<ExportType>("TASK");
  // エクスポート中かどうか
  const [isExporting, setIsExporting] = useState(false);
  // 期間（開始日）
  const [startDate, setStartDate] = useState<Date | undefined>(
    addMonths(new Date(), -6), // デフォルトは現在から6ヶ月前
  );
  // 期間（終了日）
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  // カレンダーの開閉状態
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  // 現在のステップ
  const [step, setStep] = useState(1);
  // アニメーションのための方向
  const [direction, setDirection] = useState(0);

  // モーダルが閉じられたら状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep(1);
        setIsExporting(false);
      }, 300);
    }
  }, [isOpen]);

  // 期間の妥当性チェック
  const isDateRangeValid = (): boolean => {
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
  };

  // エクスポート処理
  async function handleExport() {
    if (!isDateRangeValid()) return;

    try {
      setIsExporting(true);

      // 日付範囲の設定（開始日は0時0分、終了日は23時59分59秒）
      const start = startDate ? startOfDay(startDate) : undefined;
      const end = endDate ? endOfDay(endDate) : undefined;

      let data;
      let filename;

      if (exportType === "TASK") {
        // タスクデータのエクスポート
        data = await exportGroupTask(groupId, start, end);
        filename = `${groupName}_tasks_${format(new Date(), "yyyyMMdd")}.csv`;
      } else {
        // 分析結果データのエクスポート
        // 注: 実際のロジックは実装しない（今回は単純にエラーメッセージを表示）
        toast.info("分析結果のエクスポート機能は現在準備中です");
        setIsExporting(false);
        return;

        // 将来的な実装例：
        // data = await exportGroupAnalytics(groupId, start, end);
        // filename = `${groupName}_analytics_${format(new Date(), 'yyyyMMdd')}.csv`;
      }

      // CSVに変換してダウンロード
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();

      // 少し待ってから一時的なURLを解放する
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast.success("データを正常にエクスポートしました");
      onCloseAction(false); // モーダルを閉じる
    } catch (error) {
      console.error("エクスポートエラー:", error);
      toast.error("データのエクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  }

  // 次のステップに進む
  const nextStep = () => {
    if (step < 2) {
      setDirection(1);
      setStep(step + 1);
    } else {
      handleExport();
    }
  };

  // 前のステップに戻る
  const prevStep = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCloseAction}>
      <DialogContent className="overflow-hidden rounded-xl border-none bg-white p-0 shadow-xl sm:max-w-[550px]" closeButton={false}>
        <div className="relative bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
          <button
            onClick={() => onCloseAction(false)}
            className="absolute top-4 right-4 rounded-full p-1.5 text-white transition-colors hover:bg-white/20 focus:outline-none"
            disabled={isExporting}
            aria-label="閉じる"
          >
            <XIcon className="h-5 w-5" />
          </button>

          <DialogTitle className="pr-8 text-2xl font-bold tracking-tight">データをエクスポート</DialogTitle>
          <p className="mt-1 text-sm text-blue-100">{groupName} のデータをCSV形式でダウンロードします</p>

          {/* ステッププログレス */}
          <div className="mt-5 mb-1 flex items-center">
            <div className="flex w-full items-center space-x-3">
              <motion.div
                className={cn(
                  "ml-4 flex h-7 w-7 items-center justify-center rounded-full border border-white text-xs font-medium",
                  step === 1 ? "text-blue-600" : "text-white",
                )}
                variants={circleVariants}
                animate={step === 1 ? "active" : "inactive"}
              >
                <motion.div
                  animate={
                    step === 1
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
                  1
                </motion.div>
              </motion.div>
              <motion.div
                className="h-[2px] flex-1 origin-left bg-blue-300"
                animate={{
                  scaleX: step > 1 ? 1 : 0.5,
                  backgroundColor: step > 1 ? "rgba(255, 255, 255, 0.8)" : "rgba(219, 234, 254, 0.8)",
                }}
                transition={{
                  scaleX: {
                    duration: 0.5,
                  },
                  backgroundColor: { duration: 0.3 },
                }}
              />
              <motion.div
                className={cn(
                  "mr-3.5 flex h-7 w-7 items-center justify-center rounded-full border border-white text-xs font-medium",
                  step === 2 ? "text-blue-600" : "text-white",
                )}
                variants={circleVariants}
                animate={step === 2 ? "active" : "inactive"}
              >
                <motion.div
                  animate={
                    step === 2
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
                  2
                </motion.div>
              </motion.div>
            </div>
          </div>
          <div className="flex justify-between text-sm text-blue-100">
            <span className="pt-2">データ選択</span>
            <span className="pt-2">期間指定</span>
          </div>
        </div>

        {/* コンテンツエリア */}
        <div className="relative overflow-hidden p-6">
          <AnimatePresence custom={direction} mode="wait">
            {step === 1 && (
              <motion.div key="step1" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">エクスポートするデータを選択</h3>
                  <p className="text-sm text-gray-500">エクスポートしたいデータの種類を選択してください</p>

                  <RadioGroup value={exportType} onValueChange={(value) => setExportType(value as ExportType)} className="pt-2">
                    <div className="grid grid-cols-1 gap-4">
                      <motion.div
                        variants={cardVariants}
                        animate={exportType === "TASK" ? "selected" : "unselected"}
                        whileHover="hover"
                        whileTap="tap"
                        className="relative cursor-pointer rounded-lg border-2 p-4"
                        onClick={() => setExportType("TASK")}
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
                            </p>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        variants={cardVariants}
                        animate={exportType === "ANALYTICS" ? "selected" : "unselected"}
                        whileHover="hover"
                        whileTap="tap"
                        className="relative cursor-pointer rounded-lg border-2 p-4"
                        onClick={() => setExportType("ANALYTICS")}
                      >
                        <div className="flex items-start">
                          <RadioGroupItem
                            value="ANALYTICS"
                            id="analytics"
                            className="absolute mt-1 mr-4 opacity-0 data-[state=checked]:text-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center">
                              <BarChartIcon className="mr-2 h-5 w-5 text-purple-500" />
                              <span className="font-medium text-gray-900">分析結果データ</span>
                              <Badge variant="outline" className="ml-2 border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                                準備中
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              グループの分析結果をCSV形式でエクスポートします。各タスクの評価結果や集計データが含まれます。
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </RadioGroup>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">エクスポート期間を指定</h3>
                  <p className="text-sm text-gray-500">エクスポートするデータの期間を指定します（最大6ヶ月間）</p>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {/* 開始日 */}
                    <div className="space-y-2">
                      <Label htmlFor="start-date" className="text-sm text-gray-700">
                        開始日
                      </Label>
                      <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                        <PopoverTrigger asChild>
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !startDate && "text-gray-400",
                                startDate && "border-gray-300 text-gray-900",
                              )}
                              id="start-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                              {startDate ? format(startDate, "yyyy年MM月dd日", { locale: ja }) : "日付を選択"}
                            </Button>
                          </motion.div>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto rounded-lg border p-0 shadow-lg" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={(date) => {
                              setStartDate(date);
                              setIsStartDateOpen(false);
                            }}
                            initialFocus
                            locale={ja}
                            className="rounded-md border-0"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* 終了日 */}
                    <div className="space-y-2">
                      <Label htmlFor="end-date" className="text-sm text-gray-700">
                        終了日
                      </Label>
                      <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                        <PopoverTrigger asChild>
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !endDate && "text-gray-400",
                                endDate && "border-gray-300 text-gray-900",
                              )}
                              id="end-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
                              {endDate ? format(endDate, "yyyy年MM月dd日", { locale: ja }) : "日付を選択"}
                            </Button>
                          </motion.div>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto rounded-lg border p-0 shadow-lg" align="start">
                          <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={(date) => {
                              setEndDate(date);
                              setIsEndDateOpen(false);
                            }}
                            initialFocus
                            locale={ja}
                            className="rounded-md border-0"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <AnimatePresence>
                    {startDate && endDate && (
                      <motion.div
                        className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"
                        initial={{ opacity: 0, y: 5, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        transition={{ type: "spring", damping: 25 }}
                      >
                        <div className="flex items-start">
                          <CheckIcon className="mt-0.5 mr-2 h-5 w-5 flex-shrink-0 text-blue-500" />
                          <div>
                            <p className="font-medium">
                              選択された期間: {format(startDate, "yyyy年MM月dd日", { locale: ja })} 〜{" "}
                              {format(endDate, "yyyy年MM月dd日", { locale: ja })}
                            </p>
                            {isAfter(endDate, addMonths(startDate, 3)) && (
                              <p className="mt-1 text-xs text-blue-600">
                                * 選択された期間のデータ量によっては、エクスポート処理に時間がかかる場合があります
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* アクションボタン */}
        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
          {step > 1 ? (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outline" onClick={prevStep} disabled={isExporting} className="text-gray-700">
                前へ戻る
              </Button>
            </motion.div>
          ) : (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outline" onClick={() => onCloseAction(false)} disabled={isExporting} className="text-gray-700">
                キャンセル
              </Button>
            </motion.div>
          )}

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={nextStep}
              disabled={isExporting || (step === 2 && (!startDate || !endDate))}
              className={cn("relative min-w-[120px] text-white", step === 2 ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-500 hover:bg-blue-600")}
            >
              {isExporting && (
                <motion.div className="mr-2" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Loader2Icon className="h-4 w-4" />
                </motion.div>
              )}
              {!isExporting && step < 2 && "次へ進む"}
              {!isExporting && step === 2 && (
                <>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  エクスポートする
                </>
              )}
              {isExporting && "処理中..."}
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
