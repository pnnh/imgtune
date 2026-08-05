import React from "react";
import SiteHeader from "../components/SiteHeader.js";
import SiteFooter from "../components/SiteFooter.js";
import ImageConverter from "../components/ImageConverter.js";

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
            <SiteHeader />
            <main className="flex-1 flex flex-col items-center justify-start py-8">
                <ImageConverter />
            </main>
            <SiteFooter />
        </div>
    );
}
