/**
 * クラウドストレージ関連のロガー
 */
export const logger = {
  warn: (message: string) => console.warn(message),
  error: (message: string, error?: unknown) => console.error(message, error),
};
