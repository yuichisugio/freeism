import { notFound } from "next/navigation";
import { getGroup } from "@/app/actions";
import { EditGroupForm } from "@/components/group/edit-group-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EditGroupPageProps = {
  params: {
    id: string;
  };
};

export default async function EditGroupPage({ params }: EditGroupPageProps) {
  const group = await getGroup(params.id);

  if (!group) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-app text-xl font-bold sm:text-2xl">
            グループを編集
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditGroupForm group={group} />
        </CardContent>
      </Card>
    </div>
  );
}
