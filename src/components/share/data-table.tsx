"use client";

import { memo, useEffect } from "react";
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
import { useSortableTable } from "@/hooks/table/use-sortable-table";
import { taskStatuses, useTaskStatus } from "@/hooks/task/use-task-status";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Check, ChevronsUpDown, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ModalList型
 */
export type ModalListType = {
  title: string;
  description: string;
  action: (rowId: string) => Promise<void>;
  actionLabel: string;
  triggerIcon: React.ReactNode | null;
  triggerContent: string[];
  triggerClassName: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 列の型定義
 */
export type Column<T> = {
  key: keyof T;
  header: string;
  cell: (row: T) => React.ReactNode | null;
  sortable: boolean;
  statusCombobox: boolean;
  joinGroupModal: boolean;
  leaveGroupModal: boolean;
  modalList: ModalListType[] | null;
  editTask: boolean;
  deleteTask: {
    canDelete: (row: T) => boolean;
    onDelete: (rowId: string) => Promise<void>;
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * テーブル全体の型定義
 * extends { id: string }を記載して、Tがidを持つことを保証
 */
export type DataTableProps<T> = {
  initialData: T[];
  columns: Column<T>[];
  onDataChange: (data: T[]) => void | null;
  editTask: {
    canEdit: (row: T) => boolean;
    onEdit: (row: T) => void;
    users: { id: string; name: string }[] | null;
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// DataTableコンポーネントのpropsの型を明示的にインターフェースとして定義
type DataTableComponentProps<T extends { id: string; isJoined?: boolean }> = {
  dataTableProps: DataTableProps<T>;
};

// memo化する前の純粋な関数コンポーネント
function DataTableInner<T extends { id: string; isJoined?: boolean }>(props: DataTableComponentProps<T>) {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * コンポーネントの引数
   */
  const { initialData, columns, onDataChange, editTask } = props.dataTableProps;

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * カスタムフックを使用してデータとソート機能を管理
   */
  const { sortedData, handleSort } = useSortableTable<T>(initialData);

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
      onDataChange(sortedData);
    }
  }, [sortedData, onDataChange]);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * テーブルのレンダリング
   */
  return (
    <>
      {/* テーブルの外側のdiv */}
      <div className={cn("w-full rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm")}>
        {/* テーブルの内側のdiv */}
        <div className="relative h-[calc(100vh-16rem)] w-full table-auto overflow-x-auto overflow-y-auto">
          <table>
            {/* テーブルのヘッダー */}
            <thead className="border-b border-blue-100 bg-blue-50">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={index}
                    className="sticky top-0 z-20 w-full border-b border-blue-100 bg-blue-50 px-5 py-3 text-left text-sm font-medium shadow-md"
                  >
                    {column.sortable ? (
                      <button
                        onClick={() => handleSort(column.key)}
                        className="text-app sticky top-0 z-20 inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600"
                      >
                        {column.header}
                        <ArrowUpDown className="ml-1 h-4 w-4" />
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
              {sortedData.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-blue-50 hover:bg-blue-50/50">
                  {/* 列ごとにデータを作成(セルを作成) */}
                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className={cn("px-5 py-3 text-sm whitespace-nowrap text-neutral-600")}>
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
                                              handleStatusChange(rowId, option.value, sortedData)
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
        <div className="flex items-center justify-between border-t border-blue-100 px-4 py-1">
          <div className="text-sm text-neutral-600">
            Showing 1-{sortedData.length} of {sortedData.length}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="text-neutral-600" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="text-neutral-600" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// memo化し、型アサーションでジェネリック型を明示
export const DataTable = memo(DataTableInner) as <T extends { id: string; isJoined?: boolean }>(props: DataTableComponentProps<T>) => JSX.Element;
