import { loginProviderIds } from "./providers";
import type { LoginProviderId } from "./providers";

/**
 * 外部アカウントのサービスアイコンの出所。
 * `provider`はログインボタンと同じブランドのアイコン、`favicon`はホストのファビコンにする。
 */
export type ServiceIconSource = { type: "provider"; provider: LoginProviderId } | { type: "favicon"; host: string };

/**
 * 外部アカウントのサービスアイコンの出所を選ぶ。
 * OAuth Provider（Google・GitHub・ORCID）の行はブランドのアイコンにし、Googleのファビコン配信を使わない（配信はORCIDにも16pxの画像を返すため）。
 * それ以外の行は主URLのホストのファビコンにし、URLも無ければアイコンを出さない。
 * @see ../../docs/specification/v0.1/design-system.ja.md
 */
export function selectServiceIcon(service: string | null, url: string | undefined): ServiceIconSource | undefined {
  const provider = loginProviderIds.find((loginProviderId) => loginProviderId === service);
  if (provider !== undefined) return { type: "provider", provider };
  return url === undefined ? undefined : { type: "favicon", host: new URL(url).hostname };
}
