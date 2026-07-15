export type FixedPageLanguage = "ja" | "en";

export const FIXED_PAGE_LANGUAGE_STORAGE_KEY = "freeism.fixed-page-language.v1";

export const FIXED_PAGE_PRE_HYDRATION_SCRIPT = `(function(){try{var key="${FIXED_PAGE_LANGUAGE_STORAGE_KEY}";var saved=localStorage.getItem(key);var selected=saved==="ja"||saved==="en"?saved:null;if(!selected){var languages=navigator.languages||[];for(var index=0;index<languages.length;index+=1){var base=String(languages[index]).toLowerCase().split("-")[0];if(base==="ja"||base==="en"){selected=base;break;}}}document.documentElement.dataset.fixedPageLanguage=selected||"ja";}catch(error){}})();`;

export function resolveFixedPageLanguage(
  savedLanguage: string | null,
  browserLanguages: readonly string[],
): FixedPageLanguage {
  if (savedLanguage === "ja" || savedLanguage === "en") {
    return savedLanguage;
  }

  for (const language of browserLanguages) {
    const baseLanguage = language.toLowerCase().split("-")[0];
    if (baseLanguage === "ja" || baseLanguage === "en") {
      return baseLanguage;
    }
  }

  return "ja";
}
