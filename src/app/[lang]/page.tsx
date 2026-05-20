import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ImageConverter from "@/components/ImageConverter";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string }> };

export default async function HomePage({ params }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-center">
                <div className="mb-8 text-center space-y-3">
                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm select-none">
                        {t(l, "siteName")}
                    </h1>
                    <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto font-medium leading-relaxed">
                        {t(l, "siteTagline")}
                    </p>
                </div>
                <ImageConverter lang={l} />
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
