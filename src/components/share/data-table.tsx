import type { TaskParticipant } from "@/hooks/table/use-task-editor";
import { useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSortableTable } from "@/hooks/table/use-sortable-table";
import { useTaskEditor } from "@/hooks/table/use-task-editor";
import { taskStatuses, useTaskStatus } from "@/hooks/table/use-task-status";
import { cn } from "@/lib/utils";
import { type contributionType } from "@prisma/client";
import { ArrowUpDown, Check, ChevronsUpDown, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { TaskEditModal } from "../task/task-edit-modal";

// TaskStatus型の定義をuse-task-statusからインポートするので削除

export type TaskStatus = {
  label: string;
  value: string;
};

// taskStatusesはuse-task-statusからインポートするので削除

// 列の型定義。
export type Column<T extends Record<string, unknown>> = {
  key: keyof T; // 指定オブジェクトのキーの中の文言しか受け付けないユニオン型のリテラル型をプロパティとして受け取る
  header: string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  // Statusのコンボボックスの設定
  statusCombobox?: boolean;
  // モーダルの設定
  modalList?: {
    title: string;
    description: string;
    action: (rowId: string) => Promise<void>;
    actionLabel: string;
    triggerIcon?: React.ReactNode;
    triggerContent: string[];
    triggerClassName?: string;
    joinModal?: boolean;
  }[];
  // タスク編集ボタンの設定
  editTask?: boolean;
  // タスク削除ボタンの設定
  deleteTask?: {
    canDelete: (row: T) => boolean;
    onDelete: (rowId: string) => Promise<void>;
  };
};

// テーブル全体の型定義。columsに↑のColumn型がカラムの数だけ入った配列を格納する
export type DataTableProps<T extends Record<string, unknown>> = {
  data: T[];
  columns: Column<T>[];
  className?: string;
  pagination?: boolean;
  onSort?: (key: keyof T) => void;
  onDataChange?: (data: T[]) => void;
  maxHeight?: string;
  rowClassName?: string;
  headerClassName?: string;
  cellClassName?: string;
  stickyHeader?: boolean;
  // タスク編集用のプロパティ
  editTask?: {
    canEdit: (row: T) => boolean;
    onEdit: (row: T) => void;
    users?: { id: string; name: string }[]; // ユーザー一覧を追加
  };
  // 削除用の確認モーダルのプロパティ
  deleteModal?: {
    title: string;
    description: string;
    actionLabel: string;
  };
};

// DataTableコンポーネント
export function DataTable<T extends Record<string, unknown>>(props: { dataTableProps: DataTableProps<T> }) {
  // コンポーネントの引数
  const {
    data: initialData,
    columns: columns,
    className = "",
    pagination = true,
    onDataChange,
    maxHeight = "h-[calc(100vh-16rem)]",
    rowClassName = "border-b border-blue-50 hover:bg-blue-50/50",
    headerClassName = "border-b border-blue-100 bg-blue-50",
    cellClassName = "px-5 py-3 text-sm whitespace-nowrap text-neutral-600",
    stickyHeader = true,
    editTask,
    deleteModal = {
      title: "タスクを削除",
      description: "このタスクを削除してもよろしいですか？この操作は元に戻せません。",
      actionLabel: "削除する",
    },
  } = props.dataTableProps;

  // カスタムフックを使用してデータとソート機能を管理
  const { data, handleSort } = useSortableTable<T>(initialData);

  // タスクステータス管理フック
  const { openStatus, setOpenStatus, handleStatusChange } = useTaskStatus<T>(onDataChange);

  // タスク編集フック
  const { editingTask, editModalOpen, setEditModalOpen, handleEditTask: handleEditTaskBase, prepareTaskForEdit } = useTaskEditor<T>();

  // タスク編集ハンドララッパー
  const handleEditTask = (row: T) => {
    if (editTask?.canEdit) {
      handleEditTaskBase(row, editTask.canEdit);
    }
  };

  // タスク更新後のハンドラ
  const handleTaskUpdated = () => {
    if (editTask?.onEdit && editingTask) {
      editTask.onEdit(editingTask);
    }
  };

  // 外部からデータが更新されたときの処理
  useEffect(() => {
    if (onDataChange) {
      onDataChange(data);
    }
  }, [data, onDataChange]);

  return (
    <div className={cn("w-full rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm", className)}>
      <div
        className={cn(
          "relative w-full table-auto overflow-x-auto overflow-y-auto",
          // maxHeightの値をそのままmax-heightに設定。h-[calc(...)]形式をmax-h-[calc(...)]に変換
          maxHeight ? maxHeight.replace(/^h-/, "max-h-") : pagination ? "max-h-[calc(100vh-16rem)]" : "",
        )}
      >
        <table>
          <thead className={cn(headerClassName, "bg-white")}>
            <tr>
              {columns.map((column, index) => (
                <th key={index} className={cn("w-full px-5 py-3 text-left text-sm font-medium", headerClassName, stickyHeader && "sticky top-0 z-20 border-b border-blue-100 shadow-md")}>
                  {column.sortable ? (
                    <button onClick={() => handleSort(column.key)} className="text-app sticky top-0 z-20 inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
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

          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowClassName}>
                {columns.map((column, colIndex) => (
                  <td key={colIndex} className={cn(cellClassName, column.className)}>
                    {column.statusCombobox
                      ? (() => {
                          const safeList = Array.isArray(taskStatuses) ? taskStatuses : [];
                          const selectedLabel = safeList.find((option) => option.value === String(row[column.key]))?.label ?? "ステータスを選択";

                          return (
                            <Popover open={openStatus === (row.id as string)} onOpenChange={(isOpen: boolean) => setOpenStatus(isOpen ? (row.id as string) : null)}>
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
                                            handleStatusChange(row.id as string, option.value, data)
                                              .catch((error) => {
                                                console.error(error);
                                              })
                                              .finally(() => {
                                                setOpenStatus(null);
                                              });
                                          }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", String(row[column.key]) === option.value ? "opacity-100" : "opacity-0")} />
                                          {option.label}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          );

                          // combobox ブロックは 即時実行関数(IIFE)を用いて、ブロック内の変数定義と JSX をひとまとめにすることで、可読性と局所的な変数管理を向上させています。
                        })()
                      : column.editTask && editTask
                        ? (() => {
                            // 編集可能かどうかを判定
                            const canEdit = editTask.canEdit(row);

                            return (
                              <Button variant="outline" size="sm" onClick={() => handleEditTask(row)} disabled={!canEdit} className={cn("flex items-center gap-1", !canEdit && "cursor-not-allowed opacity-50")}>
                                <Edit className="h-4 w-4" />
                                編集
                              </Button>
                            );
                          })()
                        : column.deleteTask
                          ? (() => {
                              // 削除可能かどうかを判定
                              const canDelete = column.deleteTask?.canDelete(row);

                              return (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" disabled={!canDelete} className={cn("flex items-center gap-1 text-red-500 hover:bg-red-50", !canDelete && "cursor-not-allowed opacity-50")}>
                                      <Trash2 className="h-4 w-4" />
                                      削除
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{deleteModal.title}</AlertDialogTitle>
                                      <AlertDialogDescription>{deleteModal.description}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => {
                                          column.deleteTask
                                            ?.onDelete(row.id as string)
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
                                        {deleteModal.actionLabel}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              );
                            })()
                          : column.modalList
                            ? column.modalList.map((modal, modalIndex) => {
                                // 参加モーダルの場合のみ、ボタンを無効化する。ここでは join モーダルが modalList の最初の要素（modalIndex === 0）であると仮定しています
                                const isJoinModal = modal.joinModal;
                                // row.members が配列で、かつ1件以上あれば「参加中」とみなす
                                const hasMembers = row && typeof row === "object" && "members" in row && Array.isArray(row.members) && row.members.length > 0;
                                // 参加モーダルなら、参加中の場合は [0] を、未参加の場合は [1] を表示。それ以外（編集・削除）の場合は常に [0] を表示する例（必要に応じて変更可）
                                const buttonText = isJoinModal ? (hasMembers ? modal.triggerContent[0] : modal.triggerContent[1]) : modal.triggerContent[0];
                                // 参加モーダーの場合、参加中の場合はボタンを無効化する
                                const isDisabled = isJoinModal && hasMembers;
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
                                          <Button onClick={() => modal.action(row.id as string)} className="button-default-custom" disabled={isDisabled}>
                                            {modal.actionLabel}
                                          </Button>
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                );
                              })
                            : column.cell
                              ? column.cell(row)
                              : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between border-t border-blue-100 px-4 py-1">
          <div className="text-sm text-neutral-600">
            Showing 1-{data.length} of {data.length}
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
      )}

      {/* タスク編集モーダル */}
      {editingTask && (
        <TaskEditModal
          open={editModalOpen}
          onOpenChangeAction={setEditModalOpen}
          task={
            prepareTaskForEdit(editingTask) as {
              id: string;
              task: string;
              detail: string | null;
              reference: string | null;
              info: string | null;
              status: string;
              contributionType: contributionType;
              reporters: TaskParticipant[];
              executors: TaskParticipant[];
              imageUrl: string | null;
              group: {
                id: string;
                name: string;
              };
            }
          }
          users={editTask?.users ?? []}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </div>
  );
}
