import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export function MainTemplate({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="container px-8 py-8">
            <h1 className="text-2xl font-bold text-blue-600 sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 mb-5 text-neutral-600">{description}</p>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
