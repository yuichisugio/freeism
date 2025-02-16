import type { Metadata } from "next";
import { auth } from "@/auth";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "dashboard",
  description: "dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  console.log("DashboardPage session：", session?.user?.name);

  return (
    <>
      <Header />
      <main className="container mx-auto p-4">
        <h1 className="text-2xl font-bold">dashboard</h1>
        <h2 className="text-xl font-bold">{session?.user?.name}</h2>
      </main>
    </>
  );
}
