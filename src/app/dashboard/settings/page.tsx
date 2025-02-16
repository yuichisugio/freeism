import type { Metadata } from "next";
import { SetupForm } from "@/components/auth/setup-form";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata: Metadata = {
  title: "Settings - Freeism App",
  description: "User settings and preferences",
};

export default async function SettingsPage() {
  return (
    <div className="relative min-h-screen">
      <Header />
      <Sidebar />
      <main className="sm:pl-56">
        <div className="container mx-auto p-4">
          <h1 className="mb-8 text-2xl font-bold">Settings</h1>
          <div className="mx-auto max-w-2xl">
            <SetupForm />
          </div>
        </div>
      </main>
    </div>
  );
}
