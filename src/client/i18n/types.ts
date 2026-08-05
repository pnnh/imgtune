// 应用层语言键（与现有 LangKey 等价）
export type AppLocale =
  | "en"
  | "es"
  | "fr"
  | "de-DE"
  | "pt-PT"
  | "ja"
  | "zh"
  | "zh-TW";

// Chrome 扩展 _locales 目录名
export type ChromeLocale =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt_PT"
  | "ja"
  | "zh_CN"
  | "zh_TW";

// AppLocale → ChromeLocale 映射（Chrome 不支持 de-DE，降级为 de）
export const LOCALE_MAP: Record<AppLocale, ChromeLocale> = {
  en: "en",
  es: "es",
  fr: "fr",
  "de-DE": "de",
  "pt-PT": "pt_PT",
  ja: "ja",
  zh: "zh_CN",
  "zh-TW": "zh_TW",
};

export const SUPPORTED_LOCALES: { key: AppLocale; name: string }[] = [
  { key: "en", name: "English" },
  { key: "es", name: "Español" },
  { key: "fr", name: "Français" },
  { key: "de-DE", name: "Deutsch" },
  { key: "pt-PT", name: "Português" },
  { key: "ja", name: "日本語" },
  { key: "zh", name: "简体中文" },
  { key: "zh-TW", name: "繁體中文" },
];

// 28 个翻译键
export type MessageKey =
  | "siteName"
  | "siteTagline"
  | "siteDescription"
  | "homeTitle"
  | "homeDescription"
  | "changeLanguage"
  | "dragDropText"
  | "supportedFormats"
  | "selectTargetFormat"
  | "conversionParameters"
  | "quality"
  | "compressionLevel"
  | "lossless"
  | "defaultSettings"
  | "convertButton"
  | "converting"
  | "conversionSuccess"
  | "conversionFailed"
  | "originalPreview"
  | "convertedPreview"
  | "downloadButton"
  | "fileSize"
  | "dimensions"
  | "closePreview"
  | "savedSize"
  | "gifFirstFrameWarning"
  | "webpNotSupported";
