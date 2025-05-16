import { type SortDirection } from "@/types/auction-types";
import { type contributionType } from "@prisma/client";

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
  cellClassName: string | null;
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
  pagination: {
    totalRowCount: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    itemPerPage: number;
    onItemPerPageChange: (itemPerPage: number) => void;
  };
  sort: {
    onSortChange: (field: keyof T) => void;
    sortDirection: SortDirection;
    sortField: keyof T;
  } | null;
  filter: {
    filterContents: {
      filterType: "input" | "radio";
      filterText: string;
      onFilterChange: (value: string) => void;
      placeholder: string;
      radioOptions: { value: string; label: string }[] | null;
    }[];
    onResetFilters: () => void;
    onResetSort: () => void;
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * DataTableコンポーネントのpropsの型を明示的にインターフェースとして定義
 */
export type DataTableComponentProps<T extends { id: string; isJoined?: boolean }> = {
  dataTableProps: DataTableProps<T>;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * AllUserGroupTableのテーブルの条件の型
 */
export type TableConditions<T> = {
  sort: {
    field: keyof T;
    direction: SortDirection;
  } | null;
  page: number;
  searchQuery: string | null;
  isJoined: "isJoined" | "notJoined" | "all";
  itemPerPage: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * GroupDetailTableのテーブルの条件の型
 */
export type GroupDetailTableConditions = TableConditions<GroupDetailTask> & {
  contributionType: "ALL" | contributionType;
  status: "ALL" | (string & {});
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループのデータの型
 */
export type AllUserGroupTable = {
  id: string;
  name: string;
  goal: string;
  evaluationMethod: string;
  maxParticipants: number;
  joinMembersCount: number;
  depositPeriod: number;
  isJoined: boolean;
  createdBy: string;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーシップの型定義
 */
export type MyGroupTable = {
  id: string;
  groupName: string;
  groupGoal: string;
  groupEvaluationMethod: string;
  groupDepositPeriod: number;
  groupPointBalance: number;
  groupPointFixedTotalPoints: number;
  isGroupOwner: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーシップの型定義
 */
export type GroupMembership = {
  id: string;
  userId: string;
  groupId: string;
  isGroupOwner: boolean;
  joinedAt: Date;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループメンバーの型定義（ユーザー情報を含む）
 */
export type GroupMemberWithUser = GroupMembership & {
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスク参加者の型
 */
export type TaskParticipant = {
  id: string;
  name: string | null;
  userId: string | null;
  user: {
    id: string;
    name: string | null;
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ユーザー情報の型
 */
export type User = {
  id: string;
  name: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * タスクの型
 */
export type Task = {
  id: string;
  task: string;
  reference: string | null;
  status: string;
  fixedContributionPoint: number | null;
  fixedEvaluator: string | null;
  fixedEvaluationLogic: string | null;
  contributionType: contributionType;
  // 情報・画像URL・カテゴリを追加
  info: string | null;
  imageUrl: string | null;
  category: string | null;
  // 作成者情報
  creator: {
    name: string | null;
  };
  // 報告者・実行者情報
  reporters: TaskParticipant[];
  executors: TaskParticipant[];
  group: {
    id: string;
    name: string;
    maxParticipants: number;
    goal: string;
    evaluationMethod: string;
    members: {
      userId: string;
    }[];
    depositPeriod?: number;
  };
  detail: string | null;
  createdAt: Date;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * GroupDetailTableのタスクの型
 */
export type GroupDetailTask = {
  id: string;
  taskName: string;
  taskDetail: string | null;
  taskStatus: string;
  taskContributionType: contributionType;
  taskFixedContributionPoint: number | null;
  taskFixedEvaluator: string | null;
  taskFixedEvaluationLogic: string | null;
  taskCreator: string | null;
  taskReporterUserIds: string[] | null;
  taskExecutorUserIds: string[] | null;
  taskReporterUserNames: string[] | null;
  taskExecutorUserNames: string[] | null;
  createdAt: Date;
  group: {
    id: string;
    name: string;
    maxParticipants: number;
    goal: string;
    evaluationMethod: string;
    members: {
      userId: string;
    }[];
    depositPeriod?: number;
  };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * グループの型
 */
export type Group = {
  id: string;
  name: string;
  goal: string;
  evaluationMethod: string;
  joinMemberCount: number;
  maxParticipants: number;
  depositPeriod: number;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー
