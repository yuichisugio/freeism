import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export function MainTemplate({ title, description, component, children }: { title: string; description: string; component?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="container space-y-5 px-8 py-5 sm:space-y-0">
            {/* 説明文の横に並べて表示したいボタンがある場合は、componentを渡す */}
            <div className="flex flex-col justify-between sm:flex-row">
              <div>
                <h1 className="text-app text-2xl font-bold sm:text-3xl">{title}</h1>
                <p className="mt-2 mb-5 text-neutral-600">{description}</p>
              </div>
              {component && component}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
