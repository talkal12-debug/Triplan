import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { profileDefaultsSchema, profileSchema, type Profile } from "@/lib/profile/schema";

export const runtime = "nodejs";

async function loadProfile(userId: string): Promise<Profile> {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.travelerProfile.findUnique({ where: { userId } }),
  ]);
  const defaults = profile ? profileDefaultsSchema.safeParse(JSON.parse(profile.defaults)) : null;
  return { name: user?.name ?? null, defaults: defaults?.success ? defaults.data : {} };
}

/** GET /api/profile -> { profile } */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ profile: await loadProfile(user.id) });
}

/** PUT /api/profile { profile } -> { profile } */
export async function PUT(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = profileSchema.safeParse((await req.json().catch(() => ({})))?.profile);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  const { name, defaults } = parsed.data;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name } }),
    prisma.travelerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, defaults: JSON.stringify(defaults) },
      update: { defaults: JSON.stringify(defaults) },
    }),
  ]);
  return NextResponse.json({ profile: await loadProfile(user.id) });
}
