import type { AppLocale, ChromeLocale, MessageKey } from "./types.js";
import { LOCALE_MAP } from "./types.js";

type MessagesFile = Record<string, { message: string }>;

// en 文案编译时内嵌，确保网络失败时仍有 fallback
import enMessages from "../../../_locales/en/messages.json";

const cache: Partial<Record<ChromeLocale, MessagesFile>> = {
  en: enMessages as MessagesFile,
};

let activeLocale: ChromeLocale = "en";

const isExtension =
  typeof chrome !== "undefined" && typeof chrome?.runtime?.id === "string";

/** 加载指定语言的翻译文件（非扩展环境使用） */
export async function loadMessages(locale: AppLocale): Promise<void> {
  const chromeLocale = LOCALE_MAP[locale] ?? "en";
  activeLocale = chromeLocale;
  if (cache[chromeLocale]) return;

  try {
    const res = await fetch(`/_locales/${chromeLocale}/messages.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache[chromeLocale] = (await res.json()) as MessagesFile;
  } catch {
    // 网络失败降级到 en
    activeLocale = "en";
  }
}

/** 获取翻译文本 */
export function getMessage(key: MessageKey): string {
  if (isExtension) {
    const msg = chrome.i18n.getMessage(key);
    return msg || key;
  }
  return (
    cache[activeLocale]?.[key]?.message ??
    cache.en?.[key]?.message ??
    key
  );
}
