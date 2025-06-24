/**
 * オークション実行者のJSON形式データ（データベースから取得）
 */
export type ExecutorJsonItemFromDB = {
  id: string | null;
  user_id: string | null;
  user_image: string | null;
  username: string | null;
  rating: number | null;
};

/**
 * オークション実行者のJSON形式データ（フロントエンド用）
 */
export type ExecutorJsonItem = {
  id: string | null;
  rating: number | null;
  userId: string | null;
  userImage: string | null;
  userSettingsUsername: string | null;
};

/**
 * オブジェクトがExecutorJsonItemFromDB型かどうかを判定する関数
 * @param obj - 判定対象のオブジェクト
 * @returns オブジェクトがExecutorJsonItemFromDB型かどうか
 */
export function isExecutorObjectFromDB(obj: unknown): obj is ExecutorJsonItemFromDB {
  // オブジェクトでない場合は、falseを返却
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  // オブジェクトの場合は、id, user_id, user_image, username, ratingがあるかどうかをチェック。ある場合はtrueを返却
  const potentialExec = obj as Record<string, unknown>;

  const result =
    // idがあるかどうかをチェック。ある場合は、stringかnullかどうかをチェック
    "id" in potentialExec &&
    (typeof potentialExec.id === "string" || potentialExec.id === null) &&
    // user_idがあるかどうかをチェック。ある場合は、stringかnullかどうかをチェック
    "user_id" in potentialExec &&
    (typeof potentialExec.user_id === "string" || potentialExec.user_id === null) &&
    // user_imageがあるかどうかをチェック。ある場合は、stringかnullかどうかをチェック
    "user_image" in potentialExec &&
    (typeof potentialExec.user_image === "string" || potentialExec.user_image === null) &&
    // usernameがあるかどうかをチェック。ある場合は、stringかnullかどうかをチェック
    "username" in potentialExec &&
    (typeof potentialExec.username === "string" || potentialExec.username === null) &&
    // ratingがあるかどうかをチェック。ある場合は、numberかnullかどうかをチェック
    "rating" in potentialExec &&
    (typeof potentialExec.rating === "number" || potentialExec.rating === null);

  // オブジェクトがExecutorJsonItemFromDB型かどうかを返却。ある場合はtrueを返却
  return result;
}
