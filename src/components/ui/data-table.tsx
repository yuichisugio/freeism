import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

type Column<T extends Record<string, unknown>> = {
  key: keyof T;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
};

type DataTableProps<T extends Record<string, unknown>> = {
  data: T[];
  columns: Column<T>[];
  className?: string;
  pagination?: boolean;
  onSort?: (key: keyof T) => void;
  onDataChange?: (data: T[]) => void;
  maxHeight?: string;
  rowClassName?: string;
  headerClassName?: string;
  cellClassName?: string;
};

export function DataTable<T extends Record<string, unknown>>({
  data: initialData,
  columns,
  className = "",
  pagination = false,
  onSort,
  onDataChange,
  maxHeight,
  rowClassName = "border-b border-blue-50 hover:bg-blue-50/50",
  headerClassName = "border-b border-blue-100 bg-blue-50/50",
  cellClassName = "px-5 py-3 text-sm whitespace-nowrap text-neutral-600",
}: DataTableProps<T>) {
  const [data, setData] = useState(initialData);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: "asc" | "desc";
  } | null>(null);

  // データが変更されたときにコールバックを呼び出す
  useEffect(() => {
    if (onDataChange) {
      onDataChange(data);
    }
  }, [data, onDataChange]);

  // 外部からデータが更新されたときに内部のstateを更新
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // ソート関数
  function handleSort(key: keyof T) {
    if (onSort) {
      onSort(key);
      return;
    }

    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sortedData = [...data].sort((a, b) => {
      if (!(key in a) || !(key in b)) return 0;

      const aValue = a[key];
      const bValue = b[key];

      if (aValue === null || bValue === null) return 0;
      if (typeof aValue === "object" || typeof bValue === "object") {
        // オブジェクトの場合は、特定のプロパティでソート
        if (aValue && bValue && "name" in aValue && "name" in bValue) {
          const aName = (aValue as { name: string | null }).name;
          const bName = (bValue as { name: string | null }).name;
          if (aName === null || bName === null) return 0;
          return direction === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
        }
        return 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    setData(sortedData);
  }

  return (
    <div className={`rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm ${className}`}>
      <div className={`${maxHeight || (pagination ? "h-[calc(100vh-16rem)]" : "")} overflow-y-auto`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className={headerClassName}>
                {columns.map((column, index) => (
                  <th key={index} className={`px-5 py-3 text-left text-sm font-medium ${column.className || ""}`}>
                    {column.sortable ? (
                      <button onClick={() => handleSort(column.key)} className="text-app inline-flex flex-nowrap items-center whitespace-nowrap hover:text-blue-600">
                        {column.header}
                        <ArrowUpDown className="ml-1 h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-app inline-flex flex-nowrap items-center whitespace-nowrap">{column.header}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowClassName}>
                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className={`${cellClassName} ${column.className || ""}`}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && (
        <div className="flex items-center justify-between border-t border-blue-100 px-4 py-1">
          <div className="text-sm text-neutral-600">
            Showing 1-{data.length} of {data.length}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="text-neutral-600" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="text-neutral-600" disabled>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
