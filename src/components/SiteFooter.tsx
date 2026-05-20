import type { LangKey } from "@/lib/language";
import { t } from "@/lib/i18n";

type Props = { lang: LangKey };

export default function SiteFooter({ lang }: Props) {
    return (
        <footer className="w-full border-t border-gray-200 bg-white mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-center gap-4">
                <p className="text-sm text-gray-400">
                    © {new Date().getFullYear()} {t(lang, "siteName")}
                </p>
            </div>
        </footer>
    );
}
