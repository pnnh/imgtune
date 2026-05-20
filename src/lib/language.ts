import acceptLanguage from "accept-language";

export const langEn = "en";
export const langEs = "es";
export const langFr = "fr";
export const langDe = "de-DE";
export const langPt = "pt-PT";
export const langJa = "ja";
export const langZh = "zh";
export const langZhTW = "zh-TW";

export type LangKey =
  | typeof langEn
  | typeof langEs
  | typeof langFr
  | typeof langDe
  | typeof langPt
  | typeof langJa
  | typeof langZh
  | typeof langZhTW;

export const defaultLanguage: LangKey = langEn;
export const unknownLanguage = "unknown";

export const supportedLanguages: { key: LangKey; name: string }[] = [
  { key: langEn, name: "English" },
  { key: langEs, name: "Español" },
  { key: langFr, name: "Français" },
  { key: langDe, name: "Deutsch" },
  { key: langPt, name: "Português" },
  { key: langJa, name: "日本語" },
  { key: langZh, name: "简体中文" },
  { key: langZhTW, name: "繁體中文" },
];

const supportedKeys = supportedLanguages.map((l) => l.key);

acceptLanguage.languages(supportedKeys as string[]);

export function getTargetLang(rawLang: string, fallback: string): string {
  const matched = acceptLanguage.get(rawLang);
  if (matched && supportedKeys.includes(matched as LangKey)) return matched;
  return fallback;
}

export function isValidLang(lang: string): lang is LangKey {
  return supportedKeys.includes(lang as LangKey);
}
