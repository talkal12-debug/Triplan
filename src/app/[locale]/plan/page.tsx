import { redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

/** /plan always opens the first step; the wizard shell restores the saved draft. */
export default async function PlanIndexPage({ params }: Props) {
  const { locale } = await params;
  redirect({ href: "/plan/destination", locale });
}
