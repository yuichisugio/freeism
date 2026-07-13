import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { en } from "../../locales/en";
import { ja, type MarketsMessageKey } from "../../locales/ja";

export type MarketsLocale = "ja" | "en";

interface MarketsLocaleValue {
  locale: MarketsLocale;
  setLocale: (locale: MarketsLocale) => void;
  t: (key: MarketsMessageKey) => string;
}

const MarketsLocaleContext = createContext<MarketsLocaleValue>({
  locale: "ja",
  setLocale: () => undefined,
  t: (key) => ja[key],
});

export function MarketsLocaleProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, setLocale] = useState<MarketsLocale>("ja");

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<MarketsLocaleValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => (locale === "ja" ? ja[key] : en[key]),
    }),
    [locale],
  );

  return <MarketsLocaleContext.Provider value={value}>{children}</MarketsLocaleContext.Provider>;
}

export function useMarketsLocale() {
  return useContext(MarketsLocaleContext);
}
