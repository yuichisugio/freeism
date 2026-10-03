import type { SVGProps } from "react";

import type { LoginProviderId } from "../../../../shared/providers";

/**
 * アイコンの属性。
 * 大きさは既定で文字の大きさ（`1em`）にし、`className`（`size-4`など）で変える。
 */
export type IconProps = SVGProps<SVGSVGElement>;

/**
 * 装飾用のSVGアイコンの枠。
 * 意味は隣の文字か`aria-label`で伝えるため、アイコン自体は読み上げない。
 */
function Icon({ viewBox = "0 0 24 24", children, ...props }: IconProps) {
  return (
    <svg viewBox={viewBox} width="1em" height="1em" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

// --------------------------------------------------
// ロゴ・ブランド
// --------------------------------------------------

/**
 * Freeism Accountsのロゴ（主色の角丸四角に「A」と強調色の点）。
 * 色はテーマのトークンに従う。
 * ファビコン（`public/favicon.svg`）はライトの色で同じ形。
 */
export function LogoIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 32 32" {...props}>
      <rect width="32" height="32" rx="8" style={{ fill: "var(--accent)" }} />
      <path
        d="M9 25 16 7l7 18M11.6 18.5h8.8"
        {...stroke}
        style={{ stroke: "var(--accent-foreground)" }}
        strokeWidth="3.2"
      />
      <circle cx="25" cy="8" r="3.5" style={{ fill: "var(--highlight)" }} />
    </Icon>
  );
}

export function GoogleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <g fill="none" strokeWidth="3.6">
        <path d="M17.3 6.7A7.5 7.5 0 0 0 4.95 9.43" style={{ stroke: "var(--brand-google-red)" }} />
        <path d="M4.95 9.43a7.5 7.5 0 0 0 0 5.14" style={{ stroke: "var(--brand-google-yellow)" }} />
        <path d="M4.95 14.57A7.5 7.5 0 0 0 17.3 17.3" style={{ stroke: "var(--brand-google-green)" }} />
        <path d="M17.3 17.3A7.5 7.5 0 0 0 19.5 12H12" style={{ stroke: "var(--brand-google-blue)" }} />
      </g>
    </Icon>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <Icon viewBox="0 0 16 16" {...props}>
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </Icon>
  );
}

export function OrcidIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="11" style={{ fill: "var(--brand-orcid)" }} />
      <rect x="6.6" y="9.6" width="2" height="7.4" rx=".4" style={{ fill: "var(--brand-on)" }} />
      <circle cx="7.6" cy="7.3" r="1.25" style={{ fill: "var(--brand-on)" }} />
      <path
        d="M11.2 9.9h2.3a3.55 3.55 0 0 1 0 7.1h-2.3z"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
        style={{ stroke: "var(--brand-on)" }}
      />
    </Icon>
  );
}

const loginProviderIcons = { google: GoogleIcon, github: GitHubIcon, orcid: OrcidIcon } as const;

/**
 * ログイン・追加連携に使うProvider（Google・GitHub・ORCID）のアイコン。
 */
export function LoginProviderIcon({ provider, ...props }: IconProps & { provider: LoginProviderId }) {
  const ProviderIcon = loginProviderIcons[provider];
  return <ProviderIcon {...props} />;
}

// --------------------------------------------------
// 操作・状態
// --------------------------------------------------

export function PersonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.8" {...stroke} strokeWidth="1.8" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" {...stroke} strokeWidth="1.8" />
    </Icon>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} strokeWidth="1.8" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4" {...stroke} strokeWidth="1.8" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" {...stroke} strokeWidth="2.6" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} strokeWidth="2" />
      <path d="M12 7.5v5.5" {...stroke} strokeWidth="2.2" />
      <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} strokeWidth="2" />
      <path d="M12 11v5.5" {...stroke} strokeWidth="2.2" />
      <circle cx="12" cy="7.8" r="1.2" fill="currentColor" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" {...stroke} strokeWidth="2" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" {...stroke} strokeWidth="2" />
    </Icon>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"
        {...stroke}
        strokeWidth="1.8"
      />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="8" y="8" width="12" height="12" rx="3" {...stroke} strokeWidth="1.8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" {...stroke} strokeWidth="1.8" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" {...stroke} strokeWidth="2" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" {...stroke} strokeWidth="1.8" />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v11M7.5 11.5 12 16l4.5-4.5M5 19h14" {...stroke} strokeWidth="1.8" />
    </Icon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h9" {...stroke} strokeWidth="1.8" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" {...stroke} strokeWidth="2" />
    </Icon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" {...stroke} strokeWidth="1.6" />
      <ellipse cx="12" cy="12" rx="4" ry="9" {...stroke} strokeWidth="1.6" />
      <path d="M3 12h18M4.5 7.5h15M4.5 16.5h15" {...stroke} strokeWidth="1.4" />
    </Icon>
  );
}
