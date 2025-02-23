import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";

// 列の型定義。
export type Column<T extends Record<string, unknown>> = {
  key: keyof T; // 指定オブジェクトのキーの中の文言しか受け付けないユニオン型のリテラル型をプロパティとして受け取る
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
};

// テーブル全体の型定義。columsに↑のColumn型がカラムの数だけ入った配列を格納する
export type DataTableProps<T extends Record<string, unknown>> = {
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

// DataTableコンポーネント
export function DataTable<T extends Record<string, unknown>>({
  // コンポーネントの引数
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

  // コンポーネントの型定義
}: DataTableProps<T>) {
  // データの状態管理
  const [data, setData] = useState(initialData);

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

  // ソートの状態管理。
  // stateは、必ずオブジェクト or nullのみ受け付ける。
  // key:には、テーブルのヘッダー行のどれかのみ受け付ける。
  // direction:には、ascかdescのみ受け付ける。
  // 初期値はnull
  // それにより、一つのオブジェクトで、どのカラムを、昇順or降順でsortしたいかをオブジェクトの形で、stateに保存する。
  // なので、テーブルのヘッダー行のどれか1つを基準にしてしか、sortできない。
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: "asc" | "desc" } | null>(null);

  // ソート関数
  function handleSort(key: keyof T) {
    // このsort関数ではなく、親コンポーネントが、Propsとして独自定義しているsort関数を渡してきた場合は、その独自sort関数を呼び出す
    if (onSort) {
      onSort(key);
      return;
    }

    // ソートの方向をリテラル型のユニオン型で型定義
    type direction = "asc" | "desc";

    // ソートの方向は、デフォルトではascに設定
    let direction: direction = "asc";

    // 2回連続同じカラムをクリックした時のみ、descに変更。それ以外は初回のカラムを選択ではascになる。
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }

    // 1度目のカラムの場合はkeyのみ更新で、directionは初期値のascになる。2回連続同じカラムをクリックした時のみ、directionが更新(descに)される。
    setSortConfig({ key, direction });

    // 引数で渡されたテーブル全体のデータをソートする関数を定義
    function sortData(data: T[]) {
      // JS標準関数sort()で、データをソートする。
      // aとbは、テーブルデータの各レコードのデータ。
      // 0の時は並び替えしない。1は昇順。-1は降順。
      const returnData = [...data].sort((a, b) => {
        // ソートするカラムが存在しない場合は、(key in a)は、並び替えの基準のカラム名をキーとして持つオブジェクト(レコードのデータ)が無い場合は、0を返す。
        if (!(key in a) || !(key in b)) return 0;

        // 1つ目のレコードのデータ(カラム名をキーとして持つオブジェクト)から、指定カラムの1つ目&2つ目のレコードのデータを取り出すために、a[key]とb[key]で、データ取得。
        const aValue = a[key];
        const bValue = b[key];

        // ソートするカラムの値がnullの場合は、0を返す。
        if (aValue === null || bValue === null) {
          return 0;
        }

        // セルの値がオブジェクトの場合は、特定のプロパティでソート
        if ((typeof aValue === "object" && aValue !== null) || (typeof bValue === "object" && bValue !== null)) {
          // オブジェクトの場合は、特定のプロパティでソート
          if (aValue !== null && bValue !== null && typeof aValue === "object" && typeof bValue === "object" && "name" in aValue && "name" in bValue) {
            const aName = (aValue as { name: string | null }).name;
            const bName = (bValue as { name: string | null }).name;

            if (aName === null || bName === null) {
              return 0;
            }

            if (direction === "asc") {
              return aName.localeCompare(bName);
            } else {
              return bName.localeCompare(aName);
            }
          }
          return 0;
        }

        // セルの値が文字列の場合は、localeCompare()でソート
        if (typeof aValue === "string" && typeof bValue === "string") {
          return direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }

        // セルの値が数値の場合は、数値の大小でソート
        if (typeof aValue === "number" && typeof bValue === "number") {
          return direction === "asc" ? aValue - bValue : bValue - aValue;
        }

        // セルの値が日付の場合は、日付の大小でソート
        if (aValue instanceof Date && bValue instanceof Date) {
          return direction === "asc" ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
        }

        // セルの値がbooleanの場合は、trueがfalseより大きい
        if (typeof aValue === "boolean" && typeof bValue === "boolean") {
          return direction === "asc" ? (aValue ? 1 : 0) - (bValue ? 1 : 0) : (bValue ? 1 : 0) - (aValue ? 1 : 0);
        }

        // undefined、関数、シンボル、nullなど、その他の型は変更なしとする
        if (aValue === undefined || bValue === undefined || aValue === null || bValue === null || typeof aValue === "function" || typeof bValue === "function" || typeof aValue === "symbol" || typeof bValue === "symbol") {
          return 0;
        }

        // それ以外の場合は、0を返す
        return 0;
      });

      // ソートしたデータを返す
      return returnData;
    }

    // データをソートする関数を呼び出す
    const sortedData = sortData(data);

    // ソートしたデータをstateに保存
    setData(sortedData);
  }

  return (
    <div className={cn("rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm", className)}>
      <div className={cn(maxHeight || (pagination ? "h-[calc(100vh-16rem)]" : ""), "overflow-y-auto")}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className={headerClassName}>
                {columns.map((column, index) => (
                  <th key={index} className={cn("px-5 py-3 text-left text-sm font-medium", column.className)}>
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
                    <td key={colIndex} className={cn(cellClassName, column.className)}>
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
