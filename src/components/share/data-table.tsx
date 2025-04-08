"use client";

import type { Task } from "@/types/group";
import { memo, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSortableTable } from "@/hooks/table/use-sortable-table";
import { useTaskEditor } from "@/hooks/table/use-task-editor";
import { taskStatuses, useTaskStatus } from "@/hooks/table/use-task-status";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Check, ChevronsUpDown, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

// 必要なコンポーネントのインポート
import { TaskEditModal } from "../task/task-edit-modal";

// 基本的なインターフェース
export type BaseRecord = Record<string, unknown> & {
  id: string;
  task?: string;
  status?: string;
  contributionType?: string;
  reference?: string | null;
  fixedContributionPoint?: number | null;
  fixedEvaluator?: string | null;
  fixedEvaluationLogic?: string | null;
  reporters?: unknown[];
  executors?: unknown[];
  group?: {
    id: string;
    name: string;
    [key: string]: unknown;
  };
  creator?: {
    id: string;
    name: string | null;
    [key: string]: unknown;
  };
  members?: unknown[];
};

export type TaskStatus = {
  label: string;
  value: string;
};

// ModalList型
export type ModalListType = {
  title: string;
  description: string;
  action: (rowId: string) => Promise<void>;
  actionLabel: string;
  triggerIcon?: React.ReactNode;
  triggerContent: string[];
  triggerClassName?: string;
  joinModal?: boolean;
};

// 列の型定義を修正
export type Column<T extends BaseRecord> = {
  key: keyof T;
  header: string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  statusCombobox?: boolean;
  modalList?: ModalListType[];
  editTask?: boolean;
  deleteTask?: {
    canDelete: (row: T) => boolean;
    onDelete: (rowId: string) => Promise<void>;
  };
  [key: string]: unknown;
};

// テーブル全体の型定義も修正
export type DataTableProps<T extends BaseRecord> = {
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
  editTask?: {
    canEdit: (row: T) => boolean;
    onEdit: (row: T) => void;
    users?: { id: string; name: string }[];
  };
  deleteModal?: {
    title: string;
    description: string;
    actionLabel: string;
  };
  // 任意の型情報を保持するためのプロパティ
  renderEditModal?: (props: { editingTask: T | null; modalOpen: boolean; setModalOpen: (open: boolean) => void; onTaskUpdated: () => void; users?: { id: string; name: string }[] }) => React.ReactNode;
};

// 編集可能なレコードのインターフェース
export type EditableRecord = {
  status?: string;
  [key: string]: unknown;
} & BaseRecord;

// DataTableコンポーネントのジェネリック型制約を修正
export const DataTable = memo(function DataTable<T extends BaseRecord>(props: { dataTableProps: DataTableProps<T> }) {
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
    renderEditModal,
  } = props.dataTableProps;

  // カスタムフックを使用してデータとソート機能を管理
  const { data, handleSort } = useSortableTable<T>(initialData);

  // タスクステータス管理フック
  const { openStatus, setOpenStatus, handleStatusChange } = useTaskStatus<T>(onDataChange ? (updatedData) => onDataChange(updatedData) : undefined);

  // タスク編集フック
  const { editingTask, editModalOpen, setEditModalOpen, handleEditTask: handleEditTaskBase } = useTaskEditor<T>();

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
      <div className={cn("relative w-full table-auto overflow-x-auto overflow-y-auto", maxHeight ? maxHeight.replace(/^h-/, "max-h-") : pagination ? "max-h-[calc(100vh-16rem)]" : "")}>
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
                                            handleStatusChange(rowId, option.value, data)
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
                              const rowId = row.id;

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
                                        {deleteModal.actionLabel}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              );
                            })()
                          : column.modalList
                            ? column.modalList.map((modal, modalIndex) => {
                                // 参加モーダルの場合のみ、ボタンを無効化する
                                const isJoinModal = modal.joinModal;
                                // members を型安全に取得
                                const members = row.members;
                                const hasMembers = members !== undefined && Array.isArray(members) && members.length > 0;
                                // 参加モーダルなら、参加中の場合は [0] を、未参加の場合は [1] を表示
                                const buttonText = isJoinModal ? (hasMembers ? modal.triggerContent[0] : modal.triggerContent[1]) : modal.triggerContent[0];
                                // 参加モーダーの場合、参加中の場合はボタンを無効化する
                                const isDisabled = isJoinModal && hasMembers;
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

      {/* カスタム編集モーダル */}
      {renderEditModal &&
        editingTask &&
        renderEditModal({
          editingTask,
          modalOpen: editModalOpen,
          setModalOpen: setEditModalOpen,
          onTaskUpdated: handleTaskUpdated,
          users: editTask?.users,
        })}

      {/* デフォルトの編集モーダル（renderEditModalが提供されていない場合） */}
      {!renderEditModal && editingTask && editTask?.users && <TaskEditModal open={editModalOpen} onOpenChangeAction={setEditModalOpen} task={editingTask as unknown as Task} users={editTask.users} onTaskUpdated={handleTaskUpdated} />}
    </div>
  );
});
