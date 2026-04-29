// lib/schemas/createGroupSchema.ts
import { ContributionType } from "@prisma/client";
import { z } from "zod";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// グループ作成フォームのバリデーションスキーマ
export const createGroupSchema = z.object({
  name: z.string().min(1, "グループ名を入力してください").max(50, "グループ名は50文字以内で入力してください").trim(),
  // trimを以下のように使用することで、文字列の前後のスペースが削除されるため、スペースのみ入力された際にエラーとなります。
  goal: z.string().min(1, "目標を入力してください").max(500, "目標は500文字以内で入力してください").trim(),
  evaluationMethod: z
    .string()
    .min(1, "評価方法を入力してください")
    .max(1000, "評価方法は1000文字以内で入力してください")
    .trim(),
  maxParticipants: z
    .number()
    .min(1, "参加人数上限を入力してください")
    .max(1000, "参加人数上限は1000人以内で設定してください"),
  depositPeriod: z
    .number()
    .min(1, "ポイント預け入れ期間は最低1日以上必要です")
    .max(9999, "ポイント預け入れ期間は最大9999日以内で設定してください"),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// セットアップフォームのバリデーションスキーマ
export const setupSchema = z.object({
  username: z
    .string()
    .min(2, { message: "2文字以上で入力してください" })
    .max(40, { message: "40文字以内で入力してください" }),
  lifeGoal: z
    .string()
    .min(2, { message: "2文字以上で入力してください" })
    .max(200, { message: "200文字以内で入力してください" }),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 報告者・実行者のスキーマ
export const taskPersonSchema = z
  .object({
    name: z.string().optional(),
    userId: z.string().optional(),
  })
  .refine((data) => data.name ?? data.userId, {
    message: "名前またはユーザーIDのいずれかを指定してください",
  });

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export const taskFormSchema = z.object({
  task: z.string().min(1, "タスク内容を入力してください"),
  detail: z.string().optional(),
  reference: z.string().optional(),
  info: z.string().optional(),
  imageUrl: z.string().optional(),
  contributionType: z.nativeEnum(ContributionType, { required_error: "貢献の種類を選択してください" }),
  reporters: z.array(taskPersonSchema).optional(),
  executors: z.array(taskPersonSchema).optional(),
  auctionStartTime: z.date().optional(),
  auctionEndTime: z.date().optional(),
  deliveryMethod: z.string().optional(),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

// 通知作成フォームのバリデーションスキーマ
export const createNotificationSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(100, "タイトルは100文字以内で入力してください"),
  message: z.string().min(1, "メッセージ内容は必須です").max(1000, "メッセージは1000文字以内で入力してください"),
  targetType: z.enum(["SYSTEM", "USER", "GROUP", "TASK"], {
    errorMap: () => ({ message: "通知対象タイプを選択してください" }),
  }),
  sendTiming: z.enum(["NOW", "SCHEDULED"], {
    errorMap: () => ({ message: "送信タイミングを選択してください" }),
  }),
  sendScheduledDate: z.date().nullable().optional(),
  expiresAt: z.date().nullable().optional(),
  actionUrl: z.string().url("有効なURLを入力してください").nullable().optional(),
  userId: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  sendPushNotification: z.boolean().default(false),
  sendEmailNotification: z.boolean().default(false),
});

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

export type CreateNotificationFormData = z.infer<typeof createNotificationSchema>;

/*
HMR(ホットリロード)の仕組み的に、Client Componentで定義したzodスキーマをexportして、Server Componentsで参照できない時がある
なので、zod-schemaファイルを専用で作成して、まとめてexportすると使えるようになることがあるらしい

モジュールのトップレベルで定義された createGroupSchema は、useForm の初期化時に zodResolver(createGroupSchema) の引数として渡され、その時点で内部的に使われています。結果として、フォームの状態やバリデーションのために内部に保持されるだけで、onSubmit のクロージャ内で直接参照しようとすると、バンドラの最適化やクロージャのキャプチャのタイミングの問題から「undefined」となってしまう場合があります。
つまり、onSubmit 内での参照は「内部的に取り込まれた（キャプチャされた）値が最適化などの影響で消えてしまった」状態になっているのに対し、他の場所で参照するとモジュールの定義そのものにアクセスできるため、undefined にならないということです。
この問題は、クライアント側（onSubmit など）とサーバー側（use server で定義した関数）のコードで同じ定義を参照する際、モジュールの分離が必要になるためです。
解決策としては、スキーマ（createGroupSchema）の定義を現在のコンポーネント内から切り出し、たとえば lib/schemas/createGroupSchema.ts のような別モジュールに移動します。そして、クライアント側（onSubmit 内）もサーバー側の use server で定義したコードもそのモジュールからインポートすれば、どちらでも同じ値を参照でき、undefined になる問題が解消されます。

このようにすることで、モジュール間で定義が一元化され、どこから参照しても同じ内容が利用できるため、onSubmit 内や use server のコード内でも undefined になることなく正しく動作します。
なお、Next.js の「use server」関数はサーバー専用にバンドルされるため、クライアント側でキャプチャされた変数と分離されます。そのため、共有したい値（今回の場合はスキーマ）は必ず共通のモジュールに切り出すのがベストプラクティスです。
*/
