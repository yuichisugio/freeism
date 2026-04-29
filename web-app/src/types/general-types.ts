/**
 * サーバー側の関数の戻り値の型
 * 成功時はPromise<{ success: true, message: string, data: T }>
 * 失敗時はPromise<{ success: false, message: string,data: null }>
 */
export type PromiseResult<T> = Promise<{ success: boolean; message: string; data: T }>;

/**
 * サーバー側の関数の戻り値の型
 * 成功時は{ success: true, message: string, data: T }
 * 失敗時は{ success: false, message: string, data: null }
 */
export type Result<T> = { success: boolean; message: string; data: T };
