import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLang, supportedLanguages } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { t } from "@/lib/i18n";
import "../globals.css";

type Props = {
    params: Promise<{ lang: string }>;
    children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang } = await params;
    if (!isValidLang(lang)) return {};
    const l = lang as LangKey;
    return {
        title: t(l, "homeTitle"),
        description: t(l, "homeDescription"),
        openGraph: {
            title: t(l, "homeTitle"),
            description: t(l, "homeDescription"),
            type: "website",
        },
    };
}

export function generateStaticParams() {
    return supportedLanguages.map((l) => ({ lang: l.key }));
}

export default async function LangLayout({ params, children }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();

    return (
        <html lang={lang} className="h-full">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </head>
            <body className="min-h-full flex flex-col bg-gray-50 text-gray-900 antialiased">
                {children}
            </body>
        </html>
    );
}
