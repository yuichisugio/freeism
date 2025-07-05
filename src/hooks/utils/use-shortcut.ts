"use client";

import { useCallback, useEffect } from "react";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * ショートカットキーの設定を表す型定義
 */
export type ShortcutConfig = {
  // 押されるべきキー（例: 's', 'Enter', 'ArrowUp'など）
  code: string;
  // Ctrlキー（Windows/Linux）またはCommandキー（Mac）が押されている必要があるか
  ctrlOrCommand?: boolean;
  // Shiftキーが押されている必要があるか
  shift?: boolean;
  // Altキー（Optionキー）が押されている必要があるか
  altOrOption?: boolean;
  // ショートカットが発動したときに実行されるコールバック関数
  callback: () => void;
  // trueの場合、イベントのデフォルトの動作（例: Ctrl+Sでのブラウザの保存ダイアログ表示）を防ぎます
  preventDefault?: boolean;
  // trueの場合、テキスト入力エリア（input, textareaなど）にフォーカスがある場合はショートカットを無効にします
  disableOnInputs?: boolean;
};

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * 複数のショートカットキーを登録し、対応するコールバックを実行するカスタムフック
 * @param configs ショートカットキーの設定の配列
 */
export const useShortcut = (configs: ShortcutConfig[]) => {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キーダウンイベントを処理するコールバック関数をメモ化
   * @param event キーダウンイベント
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 現在フォーカスされている要素を取得
      const activeElement = document.activeElement;
      // 設定された各ショートカットについて処理を行う
      for (const config of configs) {
        // disableOnInputsがtrueで、かつフォーカスがinputまたはtextareaにある場合、このショートカットは無視する
        if (
          config.disableOnInputs &&
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            (activeElement as HTMLElement).isContentEditable) // contentEditableな要素も考慮
        ) {
          continue; // 次のショートカット設定へ
        }

        // 押されたキーが設定されたキーと一致するか確認 (大文字・小文字を区別しない)
        const codeMatch = event.code?.toLowerCase() === config.code?.toLowerCase();

        // キーが一致しない場合、次のショートカット設定へ
        if (!codeMatch) {
          continue;
        }

        // CtrlキーまたはMetaキーの条件が一致するか確認
        // config.ctrlOrMetaがtrueの場合、event.ctrlKeyまたはevent.metaKeyのどちらかがtrueである必要がある
        // config.ctrlOrMetaがfalseまたは未定義の場合、event.ctrlKeyとevent.metaKeyの両方がfalseである必要がある
        const ctrlOrMetaMatch = config.ctrlOrCommand
          ? event.ctrlKey || event.metaKey
          : !event.ctrlKey && !event.metaKey;

        // Shiftキーの条件が一致するか確認
        // config.shiftがtrueの場合、event.shiftKeyがtrueである必要がある
        // config.shiftがfalseまたは未定義の場合、event.shiftKeyがfalseである必要がある
        const shiftMatch = config.shift ? event.shiftKey : !event.shiftKey;

        // Altキーの条件が一致するか確認
        // config.altがtrueの場合、event.altKeyがtrueである必要がある
        // config.altがfalseまたは未定義の場合、event.altKeyがfalseである必要がある
        const altMatch = config.altOrOption ? event.altKey : !event.altKey;

        // すべての条件（キー、Ctrl/Meta、Shift、Alt）が一致した場合
        if (codeMatch && ctrlOrMetaMatch && shiftMatch && altMatch) {
          // preventDefaultがtrueに設定されていれば、ブラウザのデフォルト動作をキャンセル
          if (config.preventDefault) {
            event.preventDefault();
          }
          // 登録されたコールバック関数を実行
          config.callback();
          // 一致するショートカットが見つかったので、他のショートカット設定の確認は不要
          return;
        }
      }
    },
    [configs], // configs配列が変更された場合のみhandleKeyDown関数を再生成
  );

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 副作用フックを使用して、コンポーネントのマウント時とアンマウント時にイベントリスナーを操作
   */
  useEffect(() => {
    // グローバルなキーダウンイベントリスナーを追加
    // 'keydown'はキーが押された瞬間に発生するイベント
    window.addEventListener("keydown", handleKeyDown);

    // クリーンアップ関数：コンポーネントがアンマウントされるとき、または
    // handleKeyDown関数（つまりconfigs）が変更される前に実行される
    return () => {
      // イベントリスナーを削除し、メモリリークを防ぐ
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]); // handleKeyDown関数が変更された場合にのみ副作用を再実行
};
