import React, { ChangeEvent } from "react";
import { SUPPORTED_LOCALES, type AppLocale } from "../i18n/types.js";
import { loadMessages, getMessage } from "../i18n/adapter.js";
import { saveLocale } from "../i18n/detector.js";

export default function LanguageSelector() {
    // 触发 re-render 的简单状态（locale 变更后重新渲染）
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

    const handleChange = async (e: ChangeEvent<HTMLSelectElement>) => {
        const newLocale = e.target.value as AppLocale;
        saveLocale(newLocale);
        await loadMessages(newLocale);
        forceUpdate();
    };

    const currentLocale = (
        typeof localStorage !== "undefined"
            ? (localStorage.getItem("imgtune-locale") as AppLocale | null)
            : null
    ) ?? "en";

    return (
        <div className="relative inline-block">
            <select
                value={currentLocale}
                onChange={handleChange}
                className="appearance-none bg-white border border-gray-200 text-gray-700 py-1.5 pl-3 pr-9 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer shadow-xs transition-all hover:bg-gray-50"
            >
                {SUPPORTED_LOCALES.map((l) => (
                    <option key={l.key} value={l.key}>
                        {l.name}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
    );
}
