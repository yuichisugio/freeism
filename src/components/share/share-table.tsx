"use client";

import type { DataTableComponentProps } from "@/types/group-types";
import { memo, useCallback, useEffect, useRef, useState } from "react";
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
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronsUpDown, Edit, Maximize, Minimize, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * DataTableコンポーネントの内部関数
 */
function ShareTableInner<T extends { id: string; isJoined?: boolean }>(props: DataTableComponentProps<T>) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * コンポーネントの引数
   */
  const { initialData, columns, onDataChange, editTask, sort, pagination, filter } = props.dataTableProps;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルをフルスクリーン（全画面表示）するための設定
   */
  // フルスクリーンモードの状態を管理
  const [isFullScreen, setIsFullScreen] = useState(false);
  // テーブルのコンテナを参照
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // フルスクリーンモードを切り替えるための関数
  const toggleFullScreen = useCallback(async () => {
    const element = tableContainerRef.current;
    if (!element) return;

    if (!document.fullscreenElement) {
      try {
        await element.requestFullscreen({ navigationUI: "hide" });
        setIsFullScreen(true);
        document.body.classList.add("fullscreen-active"); // bodyにクラスを追加
      } catch (err) {
        console.error(`Error attempting to enable full-screen mode: ${(err as Error).message} (${(err as Error).name})`);
        toast.error("フルスクリーンモードへの切り替えに失敗しました。");
      }
    } else {
      if (document.exitFullscreen) {
        try {
          await document.exitFullscreen();
          setIsFullScreen(false);
          document.body.classList.remove("fullscreen-active"); // bodyからクラスを削除
        } catch (err) {
          console.error(`Error attempting to disable full-screen mode: ${(err as Error).message} (${(err as Error).name})`);
        }
      }
    }
  }, []);

  // フルスクリーンモードの変更を監視
  useEffect(() => {
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
      // コンポーネントアンマウント時にbodyからクラスを削除（念のため）
      document.body.classList.remove("fullscreen-active");
    };
  }, []);

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
      {/* テーブルのフィルター */}
      {filter && <ShareTableFilter filtersArray={filter} />}

      {/* 追加: フルスクリーンボタン (フィルターの上に配置、フルスクリーン時は表示位置調整の可能性あり) */}
      <div className="mb-2 flex justify-end">
        <Button onClick={toggleFullScreen} variant="outline" size="sm">
          {isFullScreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}
          {isFullScreen ? "通常表示に戻す" : "フルスクリーン"}
        </Button>
      </div>

      {/* テーブルの外側のdiv */}
      <div
        ref={tableContainerRef}
        className={cn(
          "rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm",
          isFullScreen
            ? "fixed inset-0 z-[9999] h-screen w-screen overflow-auto bg-white" // フルスクリーン時のスタイル
            : "w-full", // 通常時のスタイル
        )}
      >
        {/* テーブルの内側のdiv */}
        <div
          className={cn("relative w-full overflow-x-auto overflow-y-auto", isFullScreen ? "h-full max-h-full" : "h-auto max-h-[calc(100vh-22rem)]")}
        >
          <table>
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
                    style={{ width: `${100 / columns.length}%` }} // 画面幅が大きいモニターの場合に列の幅を均等にするために必要
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
              {/* テーブルの行ごとに繰り返す */}
              {initialData.map((row, rowIndex) => (
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
              ))}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        {pagination && !isFullScreen && <ShareTablePagination pagination={pagination} />}
        {pagination &&
          isFullScreen && ( // フルスクリーン時のページネーション（必要であればスタイル調整）
            <div className="sticky bottom-0 z-10 border-t border-blue-100 bg-white/80 p-2 backdrop-blur-sm">
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
