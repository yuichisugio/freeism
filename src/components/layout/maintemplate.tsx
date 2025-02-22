import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

type MainTemplateProps = {
  title: string | boolean;
  description: string | boolean;
  component?: React.ReactNode;
  children: React.ReactNode;
};

export function MainTemplate({ title, description, component, children }: MainTemplateProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="container space-y-5 px-8 py-5 sm:space-y-0">
            {/* 説明文の横に並べて表示したいボタンがある場合は、componentを渡す */}
            <div className="flex flex-col justify-between sm:flex-row">
              {title && description && (
                <div>
                  <h1 className="page-title-custom">{title}</h1>
                  <p className="page-description-custom">{description}</p>
                </div>
              )}
              {component && component}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
