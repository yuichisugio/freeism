"use client";

import type { DataTableComponentProps } from "@/types/group-types";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { NoResult } from "@/components/share/no-result";
import { ShareTableFilter } from "@/components/share/share-table-filter";
import { ShareTablePagination } from "@/components/share/share-table-pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { taskStatuses, useTaskStatus } from "@/hooks/task/use-task-status";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronsUpDown, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * DataTableコンポーネントの内部関数
 */
function ShareTableInner<T extends { id: string; isJoined?: boolean }>(props: DataTableComponentProps<T>) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
  console.log("src/components/share/share-table.tsx_start");

  /**
   * コンポーネントの引数
   */
  const { initialData, columns, onDataChange, editTask, sort, pagination, filter } = props.dataTableProps;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルをフルスクリーン（全画面表示）するための設定
   */
  // フルスクリーンモードの状態を管理
  const [isFullScreen, setIsFullScreen] = useState<boolean>(() => {
    // 初期マウント時にブラウザの状態を参照して決定
    if (typeof document !== "undefined") {
      return !!document.fullscreenElement;
    }
    return false;
  });

  // テーブルのコンテナを参照
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // フルスクリーンモードの切り替え
  const toggleFullScreen = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen({ navigationUI: "hide" });
        setIsFullScreen(true);
        document.body.classList.add("fullscreen-active");
      } catch (error) {
        console.error("フルスクリーンモードの取得に失敗しました", error);
        toast.error("フルスクリーンモードへの切り替えに失敗しました。");
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullScreen(false);
        document.body.classList.remove("fullscreen-active");
      } catch (error) {
        console.error("フルスクリーンモードの解除に失敗しました", error);
      }
    }
  }, [setIsFullScreen, wrapperRef]);

  // フルスクリーンモードのpropsを返す
  const filterFullScreenProps = {
    isFullScreen,
    toggleFullScreen,
  };

  // フルスクリーンモードの変更を監視
  useEffect(() => {
    setIsFullScreen(!!document.fullscreenElement);
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        document.body.classList.remove("fullscreen-active");
      } else {
        document.body.classList.add("fullscreen-active");
      }
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      if (document.body.classList.contains("fullscreen-active")) {
        document.body.classList.remove("fullscreen-active");
      }
    };
  }, [setIsFullScreen]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクステータス管理フック
   */
  const { openStatus, setOpenStatus, handleStatusChange } = useTaskStatus<T>(onDataChange ? (updatedData) => onDataChange(updatedData) : undefined);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 外部からデータが更新されたときの処理
   */
  useEffect(() => {
    if (onDataChange) {
      onDataChange(initialData);
    }
  }, [initialData, onDataChange]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルのレンダリング
   */
  return (
    <>
      {/* ラッパー開始  */}
      <div ref={wrapperRef} className={cn(isFullScreen ? "flex h-screen w-screen flex-col overflow-auto bg-white" : "")}>
        {/* ---------- フィルターバー ---------- */}
        {filter && (
          <div className={cn(isFullScreen && "bg-white")}>
            <ShareTableFilter filter={filter} fullScreenProps={filterFullScreenProps} />
          </div>
        )}

        {/* 既存の tableContainerRef → div をそのまま配置 */}
        <div
          ref={tableContainerRef}
          className={cn("w-full border border-blue-100 bg-white", isFullScreen ? "flex-1" : "rounded-lg backdrop-blur-sm")}
        >
          <div
            className={cn(
              "relative h-auto w-full",
              isFullScreen
                ? "" // フルスクリーン時は overflow を持たず、ページスクロールに依存
                : "max-h-[calc(100vh-15rem)] overflow-x-auto overflow-y-auto", // 非フルスクリーン時は従来のスクロール設定
            )}
          >
            <table className="w-full min-w-full table-auto">
              {/* テーブルのヘッダー */}
              <thead className={cn("border-b border-blue-100 bg-blue-50", isFullScreen && "sticky top-0 z-30")}>
                <tr>
                  {columns.map((column, index) => (
                    <th
                      key={index}
                      className={cn(
                        "sticky top-0 z-20 border-b border-blue-100 bg-blue-50 px-5 py-3 text-left text-sm font-medium shadow-md",
                        column.cellClassName, //大きい場面の場合に中央寄せするために必要
                      )}
                    >
                      {column.sortable ? (
                        <button
                          onClick={() => sort?.onSortChange(column.key)}
                          className="text-app sticky top-0 z-20 inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600"
                        >
                          {column.header}
                          {sort?.sortField === column.key ? (
                            sort?.sortDirection === "asc" ? (
                              <ArrowUp className="ml-1 h-4 w-4" />
                            ) : (
                              <ArrowDown className="ml-1 h-4 w-4" />
                            )
                          ) : (
                            <ArrowUpDown className="ml-1 h-4 w-4" />
                          )}
                        </button>
                      ) : (
                        <span className="text-app inline-flex flex-nowrap items-center whitespace-nowrap">{column.header}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* テーブルのボディ */}
              <tbody>
                {initialData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length}>
                      <NoResult message="データがありません" />
                    </td>
                  </tr>
                ) : (
                  initialData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-blue-50 hover:bg-blue-50/50">
                      {/* 列ごとにデータを作成(セルを作成) */}
                      {columns.map((column, colIndex) => (
                        <td key={colIndex} className={cn("px-5 py-3 text-sm whitespace-nowrap text-neutral-600", column.cellClassName)}>
                          {/* ステータスコンボボックスの場合 */}
                          {column.statusCombobox
                            ? (() => {
                                const safeList = taskStatuses ?? [];
                                const rowValue = String(row[column.key]);
                                const selectedLabel = safeList.find((option) => option.value === rowValue)?.label ?? "ステータスを選択";
                                const rowId = row.id;

                                return (
                                  <Popover open={openStatus === rowId} onOpenChange={(isOpen: boolean) => setOpenStatus(isOpen ? rowId : null)}>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" role="combobox" className="mr-3">
                                        {selectedLabel}
                                        <ChevronsUpDown />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[200px] p-0">
                                      <Command>
                                        <CommandInput placeholder="ステータスを検索..." />
                                        <CommandList>
                                          <CommandEmpty>ステータスが見つかりません</CommandEmpty>
                                          <CommandGroup>
                                            {safeList.map((option) => (
                                              <CommandItem
                                                key={option.value}
                                                value={option.label}
                                                onSelect={() => {
                                                  handleStatusChange(rowId, option.value, initialData)
                                                    .catch((error) => {
                                                      console.error(error);
                                                    })
                                                    .finally(() => {
                                                      setOpenStatus(null);
                                                    });
                                                }}
                                              >
                                                <Check className={cn("mr-2 h-4 w-4", rowValue === option.value ? "opacity-100" : "opacity-0")} />
                                                {option.label}
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                );
                              })()
                            : // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
                              // 編集可能な場合
                              column.editTask && editTask
                              ? (() => {
                                  // 編集可能かどうかを判定
                                  const canEdit = editTask.canEdit(row);

                                  return (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => editTask.onEdit(row)}
                                      disabled={!canEdit}
                                      className={cn("flex items-center gap-1", !canEdit && "cursor-not-allowed opacity-50")}
                                    >
                                      <Edit className="h-4 w-4" />
                                      編集
                                    </Button>
                                  );
                                })()
                              : // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
                                // 削除可能な場合
                                column.deleteTask
                                ? (() => {
                                    // 削除可能かどうかを判定
                                    const canDelete = column.deleteTask?.canDelete(row);
                                    const rowId = row.id;

                                    return (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={!canDelete}
                                            className={cn(
                                              "flex items-center gap-1 text-red-500 hover:bg-red-50",
                                              !canDelete && "cursor-not-allowed opacity-50",
                                            )}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            削除
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>{"タスクを削除"}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              {"このタスクを削除してもよろしいですか？この操作は元に戻せません。"}
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => {
                                                column.deleteTask
                                                  ?.onDelete(rowId)
                                                  .then(() => {
                                                    toast.success("タスクを削除しました");
                                                  })
                                                  .catch((error) => {
                                                    console.error(error);
                                                    toast.error("タスクの削除に失敗しました");
                                                  });
                                              }}
                                              className="bg-red-500 hover:bg-red-600"
                                            >
                                              {"削除する"}
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    );
                                  })()
                                : // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
                                  // 参加モーダーの場合
                                  column.modalList
                                  ? column.modalList.map((modal, modalIndex) => {
                                      // 参加モーダーの場合のみ、ボタンを無効化する
                                      const isJoinModal = column.joinGroupModal;
                                      // isJoined を型安全に取得
                                      const isJoined = row.isJoined;
                                      // 参加モーダーなら、参加中の場合は [0] を、未参加の場合は [1] を表示
                                      const buttonText = isJoinModal
                                        ? isJoined
                                          ? modal.triggerContent[0]
                                          : modal.triggerContent[1]
                                        : modal.triggerContent[0];
                                      // 参加モーダーの場合、参加中の場合はボタンを無効化する
                                      const isDisabled = isJoinModal && isJoined;
                                      const rowId = row.id;

                                      return (
                                        <AlertDialog key={modalIndex}>
                                          <AlertDialogTrigger asChild>
                                            <Button variant="outline" size="sm" className={`${modal.triggerClassName}`} disabled={isDisabled}>
                                              {buttonText}
                                              {modal?.triggerIcon}
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>{modal.title}</AlertDialogTitle>
                                              <AlertDialogDescription>{modal.description}</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                              <AlertDialogAction asChild>
                                                <Button onClick={() => modal.action(rowId)} className="button-default-custom" disabled={isDisabled}>
                                                  {modal.actionLabel}
                                                </Button>
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      );
                                    })
                                  : // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
                                    // 何も指定がない場合はセルの内容をそのまま表示
                                    column.cell
                                    ? column.cell(row)
                                    : null}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ページネーション */}
        {pagination && !isFullScreen && <ShareTablePagination pagination={pagination} />}
        {pagination && isFullScreen && (
          <div className="sticky right-0 bottom-0 left-0 z-[10000] bg-white">
            <ShareTablePagination pagination={pagination} />
          </div>
        )}
      </div>
    </>
  );
}

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * DataTableコンポーネント
 * memo化し、型アサーションでジェネリック型を明示
 * @param props - DataTableComponentProps
 * @returns JSX.Element
 */
export const ShareTable = memo(ShareTableInner) as <T extends { id: string; isJoined?: boolean }>(props: DataTableComponentProps<T>) => JSX.Element;
