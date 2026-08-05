import type { AppLocale } from "./types.js";
import { LOCALE_MAP } from "./types.js";

const STORAGE_KEY = "imgtune-locale";

/** 从 navigator.language 规范化匹配到 AppLocale */
function normalizeNavigatorLocale(raw: string): AppLocale | null {
  const lower = raw.toLowerCase();
  if (lower.startsWith("zh-tw") || lower.startsWith("zh_tw")) return "zh-TW";
  if (lower.startsWith("zh")) return "zh";
  if (lower.startsWith("de")) return "de-DE";
  if (lower.startsWith("pt")) return "pt-PT";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("fr")) return "fr";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("en")) return "en";
  return null;
}

/** 语言检测（4 级优先级） */
export function detectLocale(): AppLocale {
  // ① Chrome 扩展：chrome.i18n.getUILanguage()
  if (typeof chrome !== "undefined" && typeof chrome?.i18n?.getUILanguage === "function") {
    const locale = normalizeNavigatorLocale(chrome.i18n.getUILanguage());
    if (locale) return locale;
  }

  // ② 用户上次手动选择
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
    if (stored && stored in LOCALE_MAP) return stored;
  } catch {
    // localStorage 不可用（如 file:// 或隐私模式）
  }

  // ③ 浏览器语言
  const navLocale = normalizeNavigatorLocale(navigator.language ?? "");
  if (navLocale) return navLocale;

  // ④ 默认 en
  return "en";
}

/** 持久化用户选择的语言 */
export function saveLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // 静默失败
  }
}
