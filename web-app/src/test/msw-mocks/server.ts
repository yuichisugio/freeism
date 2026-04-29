import { setupServer } from "msw/node";

import { handlers } from "./handlers";

// テスト環境用のMSWサーバーを設定
export const server = setupServer(...handlers);
