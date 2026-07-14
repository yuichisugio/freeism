declare module "virtual:fixed-pages" {
  export interface FixedPageSource {
    markdown: string;
    sourceSha256: string;
  }

  export interface FixedPageData {
    en: FixedPageSource;
    ja: FixedPageSource;
    route: "terms" | "privacy" | "help" | "docs";
  }

  export const fixedPages: Record<FixedPageData["route"], FixedPageData>;
}
