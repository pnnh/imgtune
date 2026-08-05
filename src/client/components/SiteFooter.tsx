import React from "react";
import { getMessage } from "../i18n/adapter.js";

export default function SiteFooter() {
    return (
        <footer className="w-full border-t border-gray-200 bg-white mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-center">
                <p className="text-sm text-gray-400">
                    © {new Date().getFullYear()} {getMessage("siteName")}
                </p>
            </div>
        </footer>
    );
}
