import Link from "next/link";
import type { LangKey } from "@/lib/language";
import { t } from "@/lib/i18n";
import LanguageSelector from "@/components/LanguageSelector";

type Props = { lang: LangKey };

export default function SiteHeader({ lang }: Props) {
    return (
        <header className="w-full border-b border-gray-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
                <Link href={`/${lang}/`} className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
                    {t(lang, "siteName")}
                </Link>
                <LanguageSelector currentLang={lang} />
            </div>
        </header>
    );
}
