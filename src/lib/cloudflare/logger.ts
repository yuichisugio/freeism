/**
 * クラウドストレージ関連のロガー
 */
export const logger = {
  warn: (message: string) => console.warn(message),
  error: (message: string, error?: any) => console.error(message, error),
};
