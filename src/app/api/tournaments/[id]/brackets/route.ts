import { NextRequest, NextResponse } from "next/server";
import { ObjectId, Document } from "mongodb";
import { getCollections, toObjectId, serializeDoc, writeAudit } from "@/lib/mongo";
import { getSessionActor, canManageTournament } from "@/lib/permissions";
import { bracketRangesOverlap } from "@/lib/tournament-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });

  if (t.settingsLocked || !["draft", "registration"].includes(String(t.status))) {
    return NextResponse.json({ error: "Brackets are locked after registration closes or tournament starts." }, { status: 409 });
  }
  if (!t.bracketsEnabled) {
    return NextResponse.json({ error: "Enable brackets on this tournament first." }, { status: 400 });
  }

  const body = await req.json();
  const name = String(body.name || "").trim();
  const minPower = Number(body.minPower);
  const maxPower =
    body.maxPower === "" || body.maxPower === null || body.maxPower === undefined
      ? null
      : Number(body.maxPower);
  const allowOverlap = Boolean(body.allowOverlap);

  if (!name) return NextResponse.json({ error: "Bracket name is required." }, { status: 400 });
  if (Number.isNaN(minPower) || minPower < 0) return NextResponse.json({ error: "minPower must be >= 0." }, { status: 400 });
  if (maxPower !== null && (Number.isNaN(maxPower) || maxPower < minPower)) {
    return NextResponse.json({ error: "maxPower must be >= minPower." }, { status: 400 });
  }

  const existing: Document[] = Array.isArray(t.brackets) ? t.brackets : [];
  if (existing.some((b) => String(b.name).toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: "A bracket with that name already exists." }, { status: 409 });
  }
  if (
    !allowOverlap &&
    existing.some((b) => bracketRangesOverlap(minPower, maxPower, Number(b.minPower), b.maxPower ?? null))
  ) {
    return NextResponse.json(
      { error: "Range overlaps an existing bracket. Enable 'Allow overlap' only if intentional." },
      { status: 409 }
    );
  }

  const bracket = {
    _id: new ObjectId(),
    name,
    minPower,
    maxPower,
    placementRules: "standard",
    displayOrder: existing.length + 1,
  };
  await tournaments.updateOne({ _id: oid }, { $push: { brackets: bracket } as Document });
  await writeAudit(String(t.guildId), actor!.discordId, "bracket.add", "Tournament", oid, {
    bracket: name,
    min: minPower,
    max: maxPower,
    allowOverlap,
  });
  return NextResponse.json({ bracket: serializeDoc(bracket) }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  if (!oid) return NextResponse.json({ error: "Invalid tournament ID." }, { status: 400 });

  const { tournaments, registrations } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });
  if (t.settingsLocked) return NextResponse.json({ error: "Brackets are locked after start." }, { status: 409 });

  const body = await req.json();

  if (body.action === "move_player") {
    const userId = String(body.userId || "").trim();
    const bracketId = toObjectId(body.bracketId);
    const reason = String(body.reason || "").trim();
    if (!userId || !bracketId || !reason) {
      return NextResponse.json({ error: "userId, bracketId, and reason are required." }, { status: 400 });
    }
    const target = (t.brackets || []).find((b: Document) => String(b._id) === bracketId.toHexString());
    if (!target) return NextResponse.json({ error: "Bracket not found." }, { status: 404 });
    const reg = await registrations.findOne({ tournamentId: oid, userId, status: "registered" });
    if (!reg) return NextResponse.json({ error: "Registered player not found." }, { status: 404 });

    await registrations.updateOne(
      { _id: reg._id },
      {
        $set: {
          bracketId: target._id,
          bracketOverride: true,
          bracketOverrideBy: actor!.discordId,
          bracketOverrideReason: reason,
          bracketOverrideAt: new Date(),
        },
      }
    );
    await writeAudit(String(t.guildId), actor!.discordId, "bracket.move_player", "Registration", reg._id, {
      from: reg.bracketId ? String(reg.bracketId) : null,
      to: bracketId.toHexString(),
      reason,
    });
    return NextResponse.json({ ok: true });
  }

  const bracketId = toObjectId(body.bracketId);
  if (!bracketId) return NextResponse.json({ error: "bracketId is required." }, { status: 400 });
  const brackets: Document[] = Array.isArray(t.brackets) ? [...t.brackets] : [];
  const idx = brackets.findIndex((b) => String(b._id) === bracketId.toHexString());
  if (idx === -1) return NextResponse.json({ error: "Bracket not found." }, { status: 404 });

  const curr = brackets[idx];
  const newName = body.name !== undefined ? String(body.name).trim() : String(curr.name);
  const lo = body.minPower !== undefined ? Number(body.minPower) : Number(curr.minPower);
  const hi =
    body.maxPower === undefined
      ? curr.maxPower ?? null
      : body.maxPower === "" || body.maxPower === null
        ? null
        : Number(body.maxPower);
  const order = body.displayOrder !== undefined ? Number(body.displayOrder) : curr.displayOrder ?? idx + 1;

  if (hi !== null && hi < lo) return NextResponse.json({ error: "maxPower cannot be below minPower." }, { status: 400 });
  if (
    !body.allowOverlap &&
    brackets.some(
      (b, i) => i !== idx && bracketRangesOverlap(lo, hi, Number(b.minPower), b.maxPower ?? null)
    )
  ) {
    return NextResponse.json({ error: "Range overlaps another bracket." }, { status: 409 });
  }

  brackets[idx] = { ...curr, name: newName, minPower: lo, maxPower: hi, displayOrder: order };
  brackets.sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.minPower - b.minPower);

  await tournaments.updateOne({ _id: oid }, { $set: { brackets, updatedAt: new Date() } });
  await writeAudit(String(t.guildId), actor!.discordId, "bracket.edit", "Tournament", oid, {
    bracketId: bracketId.toHexString(),
    name: newName,
    min: lo,
    max: hi,
    order,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const oid = toObjectId(id);
  const bracketId = toObjectId(req.nextUrl.searchParams.get("bracketId"));
  if (!oid || !bracketId) return NextResponse.json({ error: "Invalid IDs." }, { status: 400 });

  const { tournaments } = await getCollections();
  const t = await tournaments.findOne({ _id: oid });
  if (!t) return NextResponse.json({ error: "Tournament not found." }, { status: 404 });

  const actor = await getSessionActor(String(t.guildId));
  const check = await canManageTournament(actor, t);
  if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });
  if (t.settingsLocked || !["draft", "registration"].includes(String(t.status))) {
    return NextResponse.json({ error: "Brackets are locked after start." }, { status: 409 });
  }

  await tournaments.updateOne({ _id: oid }, { $pull: { brackets: { _id: bracketId } } as Document });
  await writeAudit(String(t.guildId), actor!.discordId, "bracket.delete", "Tournament", oid, {
    bracketId: bracketId.toHexString(),
  });
  return NextResponse.json({ ok: true });
}
