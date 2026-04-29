# エラーハンドリングの仕様

## 概要

1. `throw new Error(...)`
   - 想定外の動作をした時に使用する
   - システム的な欠陥(バグや想定外の値が入力されたなど)の時に使用する
2. `return { succes: boolean, message: string }`
   - 想定内のユーザー操作の間違いの時に使用する
   - システム的に欠陥は無いが、ユーザー操作の操作が間違っている場合に使用する
3. エラーメッセージは、以下のように`error.message`を出力する
   - `OO中のエラー: ${error instanceof Error ? error.message : "不明なエラー"}`
4. サーバー側・クライアント側の両方で、それぞれ上記のエラーハンドリングを行う
   - 単体の関数ごとに、上記のルールに従い、サーバー側とクライアント側の両方で実施して、実装漏れがあってもダブルチェックでカバーできるようにしたい
5. try-catchを使用する
   - システム的な欠陥を、try-catchで握りつぶさないように、再度catch内で`throw new Error()`する
   - try-catchする理由は、Prisma
     ORMの重複エラー、zodの`parse`バリデーションエラーなどを検知して、システム的なバグではなく、ユーザー操作の間違いであることを伝えるため、
   - `PrismaClientKnownRequestError`などを`instanceof`で捕捉し、`return { success:false, message:'メールが重複しています' }`に変換。

## コード例

- 引数が足りないのは、システム的な欠陥のためエラーのため`throw new Error(...)`
- 権限がないのは、ユーザー操作の欠陥のため、`return { succes: boolean, message: string }`

```typescript
export async function deleteTask(taskId: string, userId: string): Promise<{ success: boolean; message: string }> {
  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクIDとユーザーIDの基本検証
   */
  if (
    !taskId ||
    typeof taskId !== "string" ||
    taskId.trim() === "" ||
    !userId ||
    typeof userId !== "string" ||
    userId.trim() === ""
  ) {
    throw new Error("タスクID or ユーザーIDが指定されていません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 権限チェック
   */
  const isOwner = await checkIsPermission(userId, undefined, taskId, true);
  if (!isOwner.success) {
    return { success: false, message: "このタスクを削除する権限がありません" };
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクを取得
   */
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      groupId: true,
    },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクが見つからない場合はエラーを返す
   */
  if (!task) {
    throw new Error("タスクが見つかりません");
  }

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * タスクを削除
   */
  await prisma.task.delete({
    where: { id: taskId },
  });

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * キャッシュを再検証
   */
  revalidatePath(`/groups/${task.groupId}`);
  revalidatePath(`/dashboard/group/${task.groupId}`);

  // ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

  /**
   * 成功を返却
   */
  return { success: true, message: "タスクを削除しました" };
}
```
