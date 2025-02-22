import { Skeleton } from "@/components/ui/skeleton";

export function GroupDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* グループ情報のスケルトン */}
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* アクションボタンのスケルトン */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* タスク一覧のスケルトン */}
      <div>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-blue-100 bg-blue-50/50">
                  <th className="px-5 py-3">
                    <Skeleton className="h-4 w-20" />
                  </th>
                  <th className="px-5 py-3">
                    <Skeleton className="h-4 w-20" />
                  </th>
                  <th className="px-5 py-3">
                    <Skeleton className="h-4 w-32" />
                  </th>
                  <th className="px-5 py-3">
                    <Skeleton className="h-4 w-20" />
                  </th>
                  <th className="px-5 py-3">
                    <Skeleton className="h-4 w-24" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...Array(3)].map((_, index) => (
                  <tr key={index} className="border-b border-blue-50">
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 報酬一覧のスケルトン */}
      <div>
        <Skeleton className="mb-4 h-6 w-32" />
        <div className="rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-blue-100 bg-blue-50/50">
                  <th className="px-5 py-3">
                    <Skeleton className="h-4 w-20" />
                  </th>
                  <th className="px-5 py-3">
                    <Skeleton className="h-4 w-20" />
                  </th>
                  <th className="px-5 py-3">
                    <Skeleton className="h-4 w-32" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...Array(3)].map((_, index) => (
                  <tr key={index} className="border-b border-blue-50">
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
