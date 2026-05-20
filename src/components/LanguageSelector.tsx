"use client";

import { useRouter, usePathname } from "next/navigation";
import type { LangKey } from "@/lib/language";
import { supportedLanguages } from "@/lib/language";
import { ChangeEvent } from "react";

type Props = {
    currentLang: LangKey;
};

export default function LanguageSelector({ currentLang }: Props) {
    const router = useRouter();
    const pathname = usePathname();

    const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const newLang = e.target.value;
        const segments = pathname.split("/");
        if (segments.length > 1) {
            segments[1] = newLang;
            const newPath = segments.join("/");
            router.push(newPath);
        } else {
            router.push(`/${newLang}`);
        }
    };

    return (
        <div className="relative inline-block">
            <select
                value={currentLang}
                onChange={handleChange}
                className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-1.5 pl-3 pr-9 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer shadow-xs transition-all hover:bg-gray-50 dark:hover:bg-gray-750"
            >
                {supportedLanguages.map((l) => (
                    <option key={l.key} value={l.key} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        {l.name}
                    </option>
                ))}
            </select>
            {/* Custom dropdown arrow icon */}
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400 dark:text-gray-500">
                <svg className="fill-current h-4.5 w-4.5 transition-transform" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
    );
}
