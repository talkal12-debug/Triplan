import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemoLoginEnabled, takeDemoLink } from "@/lib/auth/magic-link";

export const runtime = "nodejs";

/**
 * GET /api/auth/demo-link?email=... -> { url } | 404
 * Only when no email service is configured (see magic-link.ts). Hands the
 * pending sign-in link back to the sign-in page so the flow works without keys.
 */
export async function GET(req: Request) {
  if (!isDemoLoginEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const email = z.string().email().safeParse(new URL(req.url).searchParams.get("email"));
  if (!email.success) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  const url = takeDemoLink(email.data);
  if (!url) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ url });
}
