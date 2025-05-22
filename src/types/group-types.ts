import { type SortDirection as AuctionSortDirection } from "@/types/auction-types";
import { type contributionType, type TaskStatus } from "@prisma/client";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ソート方向の型
 */
export type SortDirection = AuctionSortDirection;

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モーダルリストの型
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
  key: Extract<keyof T, string>;
  header: string;
  cell: (row: T) => React.ReactNode | null;
  cellClassName: string | null;
  sortable: boolean;
  statusCombobox: boolean;
  joinGroupModal: boolean;
  leaveGroupModal: boolean;
  modalList: ModalListType[] | null;
  editTask: boolean;
  deleteTask?: {
    canDelete: (row: T) => boolean;
    onDelete: (rowId: string) => Promise<void>;
  } | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * EditTaskのためのProps型定義
 */
type EditTaskProps<T> = {
  canEdit: (row: T) => boolean;
  onEdit: (row: T) => void;
  editingTaskId: string | null;
  isTaskEditModalOpen: boolean;
  onCloseTaskEditModal: () => void;
  onTaskEdited: () => void;
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
  editTask: EditTaskProps<T> | null;
  pagination: {
    totalRowCount: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    itemPerPage: number;
    onItemPerPageChange: (itemPerPage: number) => void;
  };
  sort: {
    onSortChange: (field: Extract<keyof T, string>) => void;
    sortDirection: SortDirection;
    sortField: Extract<keyof T, string>;
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
  appUserName: string | null;
  appUserId: string | null;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * GroupDetailTableのタスクの型
 */
export type GroupDetailTask = {
  id: string;
  auctionId: string | null;
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
  members: {
    userId: string;
  }[];
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * MyTasksTableの型
 */
export type MyTaskTable = {
  id: string;
  taskName: string;
  taskDetail: string | null;
  taskStatus: TaskStatus;
  taskContributionType: contributionType;
  taskFixedContributionPoint: number | null;
  taskFixedEvaluator: string | null;
  taskFixedEvaluationLogic: string | null;
  taskCreatorName: string | null;
  taskReporterUserIds: string[] | null;
  taskExecutorUserIds: string[] | null;
  taskReporterUserNames: string | null;
  taskExecutorUserNames: string | null;
  reporters: {
    appUserName: string | null;
    appUserId: string | null;
  }[];
  executors: {
    appUserName: string | null;
    appUserId: string | null;
  }[];
  groupId: string;
  groupName: string;
  auctionId: string | null;
  group: { id: string; name: string };
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * MyTaskTableのテーブルの条件の型
 */
export type MyTaskTableConditions = Omit<TableConditions<MyTaskTable>, "isJoined"> & {
  taskStatus: "ALL" | TaskStatus;
  contributionType: "ALL" | contributionType;
};
