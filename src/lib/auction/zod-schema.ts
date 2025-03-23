import { z } from "zod";

// 入札データのバリデーションスキーマ
export const bidSchema = z.object({
  amount: z.number().positive().int(),
  isAutoBid: z.boolean().optional(),
  maxAmount: z.number().positive().int().optional(),
});
