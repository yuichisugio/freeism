import { env } from "@/library-setting/env";
import { Resend } from "resend";

// ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

/**
 * Resendのインスタンス
 */
export const resend = new Resend(env.RESEND_API_KEY);
