import React from "react";
import { getMessage } from "../i18n/adapter.js";
import LanguageSelector from "./LanguageSelector.js";

export default function SiteHeader() {
    return (
        <header className="w-full border-b border-gray-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
                <span className="text-lg font-bold text-gray-900">
                    {getMessage("siteName")}
                </span>
                <LanguageSelector />
            </div>
        </header>
    );
}
