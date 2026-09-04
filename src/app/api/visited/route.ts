import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { placeSeedSchema } from "@/lib/data/schemas";
import type { VisitedPlace } from "@/lib/profile/schema";

export const runtime = "nodejs";

async function listVisited(userId: string): Promise<VisitedPlace[]> {
  const rows = await prisma.visitedPlace.findMany({ where: { userId }, include: { place: true }, orderBy: { id: "desc" } });
  return rows.map((r) => {
    const names = JSON.parse(r.place.names) as Record<string, string>;
    return { placeId: r.placeId, name: names.he ?? names.en ?? r.place.nameLocal, countryCode: r.place.countryCode, city: r.place.city, when: r.when?.toISOString().slice(0, 10) ?? null };
  });
}

/** GET /api/visited -> { visited } */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ visited: await listVisited(user.id) });
}

const postSchema = z.object({
  /** Full snapshot from the plan, so the Place row can be created when it is not in the DB (OSM places). */
  place: placeSeedSchema,
  when: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
});

/** POST /api/visited { place, when? } -> { visited } */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  const { place, when } = parsed.data;
  await prisma.place.upsert({
    where: { id: place.id },
    update: {},
    create: {
      id: place.id,
      externalId: place.externalId,
      countryCode: place.countryCode,
      city: place.city,
      nameLocal: place.nameLocal,
      names: JSON.stringify(place.names),
      category: place.category,
      tags: JSON.stringify(place.tags),
      lat: place.lat,
      lng: place.lng,
      elevationM: place.elevationM,
      openingHours: place.openingHours,
      visitMinutes: place.visitMinutes,
      iconicity: place.iconicity,
      priceLevel: place.priceLevel,
      website: place.website,
      dataQuality: place.dataQuality,
      source: place.source,
    },
  });
  await prisma.visitedPlace.upsert({
    where: { userId_placeId: { userId: user.id, placeId: place.id } },
    create: { userId: user.id, placeId: place.id, when: when ? new Date(`${when}T00:00:00Z`) : null },
    update: { when: when ? new Date(`${when}T00:00:00Z`) : null },
  });
  return NextResponse.json({ visited: await listVisited(user.id) });
}

/** DELETE /api/visited?placeId=... -> { visited } */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const placeId = new URL(req.url).searchParams.get("placeId");
  if (!placeId) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  await prisma.visitedPlace.deleteMany({ where: { userId: user.id, placeId } });
  return NextResponse.json({ visited: await listVisited(user.id) });
}
