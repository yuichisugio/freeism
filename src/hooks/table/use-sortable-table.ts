import { useState } from "react";

/**
 * テーブルデータのソート機能を提供するカスタムフック
 * @param initialData - 初期データ
 * @returns ソート機能を持つテーブルデータとメソッド
 */
export function useSortableTable<T extends Record<string, unknown>>(initialData: T[]) {
  // データの状態管理
  const [data, setData] = useState<T[]>(initialData);

  // ソートの状態管理
  const [sortConfig, setSortConfig] = useState<{ key: keyof T; direction: "asc" | "desc" } | null>(null);

  // ソート処理関数
  const handleSort = (key: keyof T) => {
    // ソートの方向をリテラル型のユニオン型で型定義
    type Direction = "asc" | "desc";

    // ソートの方向は、デフォルトではascに設定
    let direction: Direction = "asc";

    // 2回連続同じカラムをクリックした時のみ、descに変更。それ以外は初回のカラムを選択ではascになる。
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }

    // ソート設定を更新
    setSortConfig({ key, direction });

    // データをソート
    const sortedData = sortData(data, key, direction);
    setData(sortedData);
  };

  // データソート関数
  const sortData = (dataToSort: T[], key: keyof T, direction: "asc" | "desc"): T[] => {
    return [...dataToSort].sort((a, b) => {
      // ソートするカラムが存在しない場合は並び替えない
      if (!(key in a) || !(key in b)) return 0;

      const aValue = a[key];
      const bValue = b[key];

      // null値の場合は並び替えない
      if (aValue === null || bValue === null) {
        return 0;
      }

      // オブジェクト型の場合（name属性があれば、それでソート）
      if ((typeof aValue === "object" && aValue !== null) || (typeof bValue === "object" && bValue !== null)) {
        if (aValue !== null && bValue !== null && typeof aValue === "object" && typeof bValue === "object" && "name" in aValue && "name" in bValue) {
          const aName = (aValue as { name: string | null }).name;
          const bName = (bValue as { name: string | null }).name;

          if (aName === null || bName === null) {
            return 0;
          }

          return direction === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
        }
        return 0;
      }

      // 文字列型の場合
      if (typeof aValue === "string" && typeof bValue === "string") {
        return direction === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      // 数値型の場合
      if (typeof aValue === "number" && typeof bValue === "number") {
        return direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      // 日付型の場合
      if (aValue instanceof Date && bValue instanceof Date) {
        return direction === "asc" ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
      }

      // 真偽値の場合
      if (typeof aValue === "boolean" && typeof bValue === "boolean") {
        return direction === "asc" ? (aValue ? 1 : 0) - (bValue ? 1 : 0) : (bValue ? 1 : 0) - (aValue ? 1 : 0);
      }

      // その他の型は比較不能なので変更なし
      return 0;
    });
  };

  // データの更新処理
  const updateData = (newData: T[]) => {
    setData(newData);
  };

  return {
    data,
    sortConfig,
    handleSort,
    updateData,
    setData,
  };
}
