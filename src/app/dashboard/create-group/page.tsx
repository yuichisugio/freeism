import type { Metadata } from "next";
import { CreateGroupForm } from "@/components/group/create-group-form";
import { MainTemplate } from "@/components/layout/maintemplate";

export const metadata: Metadata = {
  title: "新規Group作成",
  description: "新しいグループを作成します",
};

export default async function CreateGroupPage() {
  return (
    <MainTemplate
      title="新規Group作成"
      description="新しいグループを作成します"
    >
      <CreateGroupForm />
    </MainTemplate>
  );
}
