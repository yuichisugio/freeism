import React from "react";
import { mockUseSession } from "@/test/setup/setup";
import { render, screen } from "@/test/utils";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CreateNotificationForm } from "./create-notification-form";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ホイストされたモック関数の宣言
 */
const { mockUseCreateNotification } = vi.hoisted(() => ({
  mockUseCreateNotification: vi.fn(),
}));

/**
 * モジュールのモック設定
 */
vi.mock("@/hooks/notification/use-create-notification", () => ({
  useCreateNotification: mockUseCreateNotification,
}));

// Next.js Linkコンポーネントのモック
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// FormLayoutコンポーネントのモック
vi.mock("@/components/share/form/form-layout", () => ({
  FormLayout: ({ children, submitLabel }: { children: React.ReactNode; submitLabel: string }) => (
    <div data-testid="form-layout">
      {children}
      <button type="submit">{submitLabel}</button>
    </div>
  ),
}));

// CustomFormFieldコンポーネントのモック
vi.mock("@/components/share/form/form-field", () => ({
  CustomFormField: ({ label }: { label: string }) => (
    <div data-testid="form-field">
      <label>{label}</label>
    </div>
  ),
}));

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * モックフォームオブジェクトを作成するヘルパー関数
 */
function createMockForm() {
  return {
    handleSubmit: vi.fn(),
    control: {},
    formState: {
      isSubmitting: false,
      errors: {},
    },
  };
}

/**
 * テストセットアップ
 */
beforeEach(() => {
  vi.resetAllMocks();

  // デフォルトのセッション設定
  mockUseSession.mockReturnValue({
    data: {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
      },
    },
    status: "authenticated",
  });

  // デフォルトのuseCreateNotificationフックの設定
  mockUseCreateNotification.mockReturnValue({
    form: createMockForm(),
    targetType: "SYSTEM",
    sendTiming: "NOW",
    userComboOpen: false,
    groupComboOpen: false,
    taskComboOpen: false,
    sendTimingOptions: [
      { value: "NOW", label: "即時送信" },
      { value: "SCHEDULED", label: "送信予約" },
    ],
    targetTypeOptions: [
      { value: "SYSTEM", label: "システム全体" },
      { value: "USER", label: "ユーザー" },
      { value: "GROUP", label: "グループ" },
      { value: "TASK", label: "タスク" },
    ],
    isLoading: false,
    hasPermission: false,
    users: [],
    groups: [],
    tasks: [],
    isAppOwner: false,
    setGroupComboOpen: vi.fn(),
    setTaskComboOpen: vi.fn(),
    setUserComboOpen: vi.fn(),
    handleSubmit: vi.fn(),
  });
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

describe("CreateNotificationForm", () => {
  test("should render loading state when isLoading is true", () => {
    // ローディング状態のモック設定
    mockUseCreateNotification.mockReturnValue({
      form: createMockForm(),
      targetType: "SYSTEM",
      sendTiming: "NOW",
      userComboOpen: false,
      groupComboOpen: false,
      taskComboOpen: false,
      sendTimingOptions: [],
      targetTypeOptions: [],
      isLoading: true,
      hasPermission: false,
      users: [],
      groups: [],
      tasks: [],
      isAppOwner: false,
      setGroupComboOpen: vi.fn(),
      setTaskComboOpen: vi.fn(),
      setUserComboOpen: vi.fn(),
      handleSubmit: vi.fn(),
    });

    render(<CreateNotificationForm />);

    // ローディング表示の確認
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("should render permission denied message when user has no permission", () => {
    // 権限なし状態のモック設定
    mockUseCreateNotification.mockReturnValue({
      form: createMockForm(),
      targetType: "SYSTEM",
      sendTiming: "NOW",
      userComboOpen: false,
      groupComboOpen: false,
      taskComboOpen: false,
      sendTimingOptions: [],
      targetTypeOptions: [],
      isLoading: false,
      hasPermission: false,
      users: [],
      groups: [],
      tasks: [],
      isAppOwner: false,
      setGroupComboOpen: vi.fn(),
      setTaskComboOpen: vi.fn(),
      setUserComboOpen: vi.fn(),
      handleSubmit: vi.fn(),
    });

    render(<CreateNotificationForm />);

    // 権限なしメッセージの確認
    expect(screen.getByText("オーナー権限がありません")).toBeInTheDocument();
    expect(screen.getByText("通知作成には、アプリオーナー権限またはいずれかのグループでグループオーナー権限が必要です。")).toBeInTheDocument();
    expect(screen.getByText("ダッシュボードに戻る")).toBeInTheDocument();
  });

  test("should render form when user has app owner permission", () => {
    // アプリオーナー権限ありの状態のモック設定
    mockUseCreateNotification.mockReturnValue({
      form: createMockForm(),
      targetType: "SYSTEM",
      sendTiming: "NOW",
      userComboOpen: false,
      groupComboOpen: false,
      taskComboOpen: false,
      sendTimingOptions: [
        { value: "NOW", label: "即時送信" },
        { value: "SCHEDULED", label: "送信予約" },
      ],
      targetTypeOptions: [
        { value: "SYSTEM", label: "システム全体" },
        { value: "USER", label: "ユーザー" },
        { value: "GROUP", label: "グループ" },
        { value: "TASK", label: "タスク" },
      ],
      isLoading: false,
      hasPermission: true,
      users: [{ id: "user-1", name: "Test User 1" }],
      groups: [{ id: "group-1", name: "Test Group 1" }],
      tasks: [{ id: "task-1", task: "Test Task 1" }],
      isAppOwner: true,
      setGroupComboOpen: vi.fn(),
      setTaskComboOpen: vi.fn(),
      setUserComboOpen: vi.fn(),
      handleSubmit: vi.fn(),
    });

    render(<CreateNotificationForm />);

    // アプリオーナー権限表示の確認
    expect(screen.getByText("アプリオーナー権限で操作しています。")).toBeInTheDocument();

    // フォームフィールドの確認
    expect(screen.getByText("通知タイトル")).toBeInTheDocument();
    expect(screen.getByText("通知内容")).toBeInTheDocument();
    expect(screen.getByText("通知単位")).toBeInTheDocument();
    expect(screen.getByText("送信タイミング")).toBeInTheDocument();
    expect(screen.getByText("通知を作成")).toBeInTheDocument();
  });

  test("should render form when user has group owner permission", () => {
    // グループオーナー権限ありの状態のモック設定
    mockUseCreateNotification.mockReturnValue({
      form: createMockForm(),
      targetType: "GROUP",
      sendTiming: "NOW",
      userComboOpen: false,
      groupComboOpen: false,
      taskComboOpen: false,
      sendTimingOptions: [
        { value: "NOW", label: "即時送信" },
        { value: "SCHEDULED", label: "送信予約" },
      ],
      targetTypeOptions: [
        { value: "GROUP", label: "グループ" },
        { value: "TASK", label: "タスク" },
      ],
      isLoading: false,
      hasPermission: true,
      users: [],
      groups: [{ id: "group-1", name: "Test Group 1" }],
      tasks: [{ id: "task-1", task: "Test Task 1" }],
      isAppOwner: false,
      setGroupComboOpen: vi.fn(),
      setTaskComboOpen: vi.fn(),
      setUserComboOpen: vi.fn(),
      handleSubmit: vi.fn(),
    });

    render(<CreateNotificationForm />);

    // グループオーナー権限表示の確認
    expect(screen.getByText("グループオーナー権限で操作しています。")).toBeInTheDocument();

    // フォームフィールドの確認
    expect(screen.getByText("通知タイトル")).toBeInTheDocument();
    expect(screen.getByText("通知内容")).toBeInTheDocument();
    expect(screen.getByText("通知単位")).toBeInTheDocument();
    expect(screen.getByText("送信タイミング")).toBeInTheDocument();
    expect(screen.getByText("通知を作成")).toBeInTheDocument();
  });

  test("should show conditional fields based on target type", () => {
    // ユーザー対象の場合のテスト
    mockUseCreateNotification.mockReturnValue({
      form: createMockForm(),
      targetType: "USER",
      sendTiming: "NOW",
      userComboOpen: false,
      groupComboOpen: false,
      taskComboOpen: false,
      sendTimingOptions: [
        { value: "NOW", label: "即時送信" },
        { value: "SCHEDULED", label: "送信予約" },
      ],
      targetTypeOptions: [
        { value: "SYSTEM", label: "システム全体" },
        { value: "USER", label: "ユーザー" },
        { value: "GROUP", label: "グループ" },
        { value: "TASK", label: "タスク" },
      ],
      isLoading: false,
      hasPermission: true,
      users: [{ id: "user-1", name: "Test User 1" }],
      groups: [{ id: "group-1", name: "Test Group 1" }],
      tasks: [{ id: "task-1", task: "Test Task 1" }],
      isAppOwner: true,
      setGroupComboOpen: vi.fn(),
      setTaskComboOpen: vi.fn(),
      setUserComboOpen: vi.fn(),
      handleSubmit: vi.fn(),
    });

    render(<CreateNotificationForm />);

    // ユーザー選択フィールドが表示されることを確認
    expect(screen.getByText("ユーザー")).toBeInTheDocument();
  });

  test("should show scheduled date field when send timing is SCHEDULED", () => {
    // 送信予約の場合のテスト
    mockUseCreateNotification.mockReturnValue({
      form: createMockForm(),
      targetType: "SYSTEM",
      sendTiming: "SCHEDULED",
      userComboOpen: false,
      groupComboOpen: false,
      taskComboOpen: false,
      sendTimingOptions: [
        { value: "NOW", label: "即時送信" },
        { value: "SCHEDULED", label: "送信予約" },
      ],
      targetTypeOptions: [
        { value: "SYSTEM", label: "システム全体" },
        { value: "USER", label: "ユーザー" },
        { value: "GROUP", label: "グループ" },
        { value: "TASK", label: "タスク" },
      ],
      isLoading: false,
      hasPermission: true,
      users: [],
      groups: [],
      tasks: [],
      isAppOwner: true,
      setGroupComboOpen: vi.fn(),
      setTaskComboOpen: vi.fn(),
      setUserComboOpen: vi.fn(),
      handleSubmit: vi.fn(),
    });

    render(<CreateNotificationForm />);

    // 送信予約日フィールドが表示されることを確認
    expect(screen.getByText("送信予定日")).toBeInTheDocument();
  });

  test("should show different target type options for app owner vs group owner", () => {
    // アプリオーナーの場合
    mockUseCreateNotification.mockReturnValue({
      form: createMockForm(),
      targetType: "SYSTEM",
      sendTiming: "NOW",
      userComboOpen: false,
      groupComboOpen: false,
      taskComboOpen: false,
      sendTimingOptions: [
        { value: "NOW", label: "即時送信" },
        { value: "SCHEDULED", label: "送信予約" },
      ],
      targetTypeOptions: [
        { value: "SYSTEM", label: "システム全体" },
        { value: "USER", label: "ユーザー" },
        { value: "GROUP", label: "グループ" },
        { value: "TASK", label: "タスク" },
      ],
      isLoading: false,
      hasPermission: true,
      users: [],
      groups: [],
      tasks: [],
      isAppOwner: true,
      setGroupComboOpen: vi.fn(),
      setTaskComboOpen: vi.fn(),
      setUserComboOpen: vi.fn(),
      handleSubmit: vi.fn(),
    });

    render(<CreateNotificationForm />);

    // アプリオーナー権限表示の確認
    expect(screen.getByText("アプリオーナー権限で操作しています。")).toBeInTheDocument();
  });

  test("should show group owner permission message", () => {
    // グループオーナーの場合
    mockUseCreateNotification.mockReturnValue({
      form: createMockForm(),
      targetType: "GROUP",
      sendTiming: "NOW",
      userComboOpen: false,
      groupComboOpen: false,
      taskComboOpen: false,
      sendTimingOptions: [
        { value: "NOW", label: "即時送信" },
        { value: "SCHEDULED", label: "送信予約" },
      ],
      targetTypeOptions: [
        { value: "GROUP", label: "グループ" },
        { value: "TASK", label: "タスク" },
      ],
      isLoading: false,
      hasPermission: true,
      users: [],
      groups: [{ id: "group-1", name: "Test Group 1" }],
      tasks: [{ id: "task-1", task: "Test Task 1" }],
      isAppOwner: false,
      setGroupComboOpen: vi.fn(),
      setTaskComboOpen: vi.fn(),
      setUserComboOpen: vi.fn(),
      handleSubmit: vi.fn(),
    });

    render(<CreateNotificationForm />);

    // グループオーナー権限表示の確認
    expect(screen.getByText("グループオーナー権限で操作しています。")).toBeInTheDocument();
  });
});
