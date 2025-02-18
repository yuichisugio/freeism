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
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="container px-8 py-8">
            <h1 className="text-2xl font-bold text-blue-600 sm:text-3xl">
              Group List
            </h1>
            <h2 className="text-xl font-bold">{session?.user?.name}</h2>
            <h2 className="text-xl font-bold">{session?.user?.email}</h2>
          </div>
        </main>
      </div>
    </div>
  );
}
