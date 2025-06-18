import type { UseQueryResult } from "@tanstack/react-query";
import { mockUseSession } from "@/test/setup/setup";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { EditGroupForm } from "./edit-group-form";

const mockUseQuery = vi.mocked(useQuery);

// モック設定
vi.mock("@/lib/actions/group", () => ({
  checkGroupExistByName: vi.fn(),
  updateGroup: vi.fn(),
}));

vi.mock("@/lib/actions/permission", () => ({
  checkIsOwner: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

vi.mock("@/components/share/form/form-field", () => ({
  CustomFormField: ({ name, label }: { name: string; label: string }) => (
    <div data-testid={`form-field-${name}`}>
      <label>{label}</label>
      <input name={name} />
    </div>
  ),
}));

vi.mock("@/components/share/form/form-layout", () => ({
  FormLayout: ({
    children,
    onSubmit,
    submitLabel,
  }: {
    children: React.ReactNode;
    onSubmit: () => void;
    submitLabel: string;
  }) => (
    <form onSubmit={onSubmit} data-testid="form-layout">
      {children}
      <button type="submit">{submitLabel}</button>
    </form>
  ),
}));

// テストデータ
const mockGroup = {
  id: "group-1",
  name: "テストグループ",
  goal: "テスト目標",
  evaluationMethod: "テスト評価方法",
  maxParticipants: 10,
  depositPeriod: 30,
};

const mockSession = {
  user: {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
  },
};

describe("EditGroupForm", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // モックをリセット
    vi.clearAllMocks();

    // デフォルトのモック設定
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: "authenticated",
    });
  });

  function renderWithProviders(component: React.ReactElement) {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  }

  test("should render form fields when user is group owner", async () => {
    // グループオーナー権限をtrueに設定
    mockUseQuery.mockReturnValue({
      data: true,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<boolean, unknown>);

    renderWithProviders(<EditGroupForm group={mockGroup} />);

    await waitFor(() => {
      expect(screen.getByTestId("form-field-name")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-goal")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-evaluationMethod")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-maxParticipants")).toBeInTheDocument();
      expect(screen.getByTestId("form-field-depositPeriod")).toBeInTheDocument();
    });
  });

  test("should show permission denied message when user is not group owner", async () => {
    // グループオーナー権限をfalseに設定
    mockUseQuery.mockReturnValue({
      data: false,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<boolean, unknown>);

    renderWithProviders(<EditGroupForm group={mockGroup} />);

    await waitFor(() => {
      expect(
        screen.getByText("グループオーナー権限がないため、グループ情報を編集する権限がありません"),
      ).toBeInTheDocument();
      expect(screen.getByText("閉じる")).toBeInTheDocument();
    });
  });

  test("should render submit button when user is group owner", async () => {
    // グループオーナー権限をtrueに設定
    mockUseQuery.mockReturnValue({
      data: true,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<boolean, unknown>);

    renderWithProviders(<EditGroupForm group={mockGroup} />);

    await waitFor(() => {
      expect(screen.getByText("変更を保存")).toBeInTheDocument();
    });
  });

  test("should render with onCloseAction prop", async () => {
    const mockOnCloseAction = vi.fn();

    // グループオーナー権限をtrueに設定
    mockUseQuery.mockReturnValue({
      data: true,
      isLoading: false,
      error: null,
    } as unknown as UseQueryResult<boolean, unknown>);

    renderWithProviders(<EditGroupForm group={mockGroup} onCloseAction={mockOnCloseAction} />);

    await waitFor(() => {
      expect(screen.getByTestId("form-field-name")).toBeInTheDocument();
    });
  });

  test("should render loading state", async () => {
    // ローディング状態を設定
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as UseQueryResult<boolean, unknown>);

    renderWithProviders(<EditGroupForm group={mockGroup} />);

    // ローディング中は権限エラーメッセージが表示される
    await waitFor(() => {
      expect(
        screen.getByText("グループオーナー権限がないため、グループ情報を編集する権限がありません"),
      ).toBeInTheDocument();
    });
  });
});
