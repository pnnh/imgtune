import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTargetLang, defaultLanguage } from "@/lib/language";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const headersList = await headers();
  const acceptLang = headersList.get("Accept-Language") ?? "";
  const lang = getTargetLang(acceptLang, defaultLanguage);
  redirect(`/${lang}/`);
}
