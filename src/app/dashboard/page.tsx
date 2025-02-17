import type { Metadata } from "next";
import { auth } from "@/auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata: Metadata = {
  title: "dashboard",
  description: "dashboard",
};

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {/* Sidebar (固定位置、sm以上では表示) */}
      <Sidebar />
      {/* 画面が小さい場合は pl-0、sm以上の場合は pl-64（Sidebarの幅と同じ） */}
      <main className="pl-0 sm:pl-64">
        <div className="px-8 py-8">
          <h1 className="text-3xl font-bold">dashboard</h1>
          <h2 className="text-xl">{"name：" + session?.user?.name}</h2>
          <h2 className="text-xl">{"email：" + session?.user?.email}</h2>
        </div>
      </main>
    </div>
  );
}
