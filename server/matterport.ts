/**
 * Matterport model metadata — live Model API when MATTERPORT_TOKEN is set,
 * otherwise showcase embed URLs from listing matterportModelId.
 */
import type { PropertyListing } from "../shared/types.ts";

type SourceOpening = { id: string; lowerElevation?: number | null };
type SourceRoom = { id: string; label?: string | null; classifications?: { label?: string | null }[]; dimensionEstimates?: { height?: number | null; lowerElevation?: number | null } };
type SourceMetadata = { id: string; floors: { id: string; edges: { id: string; openings: SourceOpening[] }[] }[]; rooms: SourceRoom[]; fetchedAt: number };
const metadataCache = new Map<string, { until: number; result: Promise<SourceMetadata | null> }>();
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function sourceRoomLabel(room: SourceRoom): { label: string; labelSource: "user-label" | "detected-classification" } | undefined {
  if (typeof room.label === "string" && room.label.trim()) return { label: room.label.trim().slice(0, 160), labelSource: "user-label" };
  const labels = [...new Set((Array.isArray(room.classifications) ? room.classifications : [])
    .map((item) => typeof item?.label === "string" ? item.label.trim() : "")
    .filter((label) => label && !/^(unknown|other|unclassified|room)$/i.test(label)))];
  return labels.length === 1 ? { label: labels[0].slice(0, 160), labelSource: "detected-classification" } : undefined;
}

async function boundedMetadataBody(res: Response): Promise<string | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, text = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return text + decoder.decode();
    bytes += chunk.value.byteLength;
    if (bytes > 1_000_000) { await reader.cancel(); return null; }
    text += decoder.decode(chunk.value, { stream: true });
  }
}

/** One bounded read per model per five minutes, including failures; no retry loop. */
async function sourceMetadata(modelId: string): Promise<SourceMetadata | null> {
  const token = process.env.MATTERPORT_TOKEN?.trim() || process.env.MATTERPORT_SDK_TOKEN?.trim();
  const key = process.env.MATTERPORT_API_KEY?.trim();
  if (!token || !key) return null;
  const cached = metadataCache.get(modelId);
  if (cached && cached.until > Date.now()) return cached.result;
  const result = (async (): Promise<SourceMetadata | null> => {
    try {
      const endpoint = new URL(process.env.MATTERPORT_API_URL?.trim() || "https://api.matterport.com/api/models/graph");
      if (endpoint.protocol !== "https:") return null;
      const res = await fetch(endpoint.toString(), {
        method: "POST", redirect: "error",
        headers: { Authorization: `Basic ${Buffer.from(`${key}:${token}`).toString("base64")}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: "query($id:ID!) { model(id:$id) { id floors { id edges { id openings { id lowerElevation } } } rooms { id label classifications { label } dimensionEstimates(units:metric) { height lowerElevation } } } }", variables: { id: modelId } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok || Number(res.headers.get("content-length")) > 1_000_000) return null;
      const text = await boundedMetadataBody(res);
      if (text === null) return null;
      const body = JSON.parse(text) as { errors?: unknown[]; data?: { model?: SourceMetadata } };
      const model = body.data?.model;
      if (body.errors?.length || !model || model.id !== modelId || !Array.isArray(model.floors) || !Array.isArray(model.rooms)) return null;
      return { ...model, fetchedAt: Date.now() };
    } catch { return null; } // Keep source geometry usable; never expose provider/auth errors.
  })();
  if (metadataCache.size >= 8 && !metadataCache.has(modelId)) metadataCache.delete(metadataCache.keys().next().value!);
  metadataCache.set(modelId, { until: Date.now() + 300_000, result });
  return result;
}

/** Enrich an authorized measured floor without replacing its topology or source IDs. */
export async function enrichMeasuredProperty(listing: PropertyListing): Promise<PropertyListing> {
  const plan = listing.floorPlan;
  if (listing.source !== "costar-extract" || !listing.provenance || !plan || plan.modelId !== listing.matterportModelId) return listing;
  const source = await sourceMetadata(plan.modelId);
  if (!source) return listing;
  try {
    if (source.floors.length !== 1 || source.floors[0].id !== plan.floorId) return listing;
    const rooms = new Map(source.rooms.map((room) => [room.id, room]));
    if (source.rooms.length !== plan.rooms.length || rooms.size !== plan.rooms.length || !plan.rooms.every((room) => rooms.has(room.id))) return listing;
    const edges = new Map(source.floors[0].edges.map((edge) => [edge.id, edge]));
    // A changed room/opening set indicates stale topology, not permission to guess a match.
    for (const wall of plan.walls) {
      const edge = edges.get(wall.id);
      if (!edge || !Array.isArray(edge.openings) || edge.openings.length !== wall.openings.length ||
        !wall.openings.every((o) => edge.openings.some((match) => match.id === o.id))) return listing;
    }
    const elevations = source.rooms.map((room) => room.dimensionEstimates?.lowerElevation).filter(finite);
    const baseline = elevations.length ? Math.min(...elevations) : undefined;
    return { ...listing,
      provenance: { ...listing.provenance, assumptions: listing.provenance.assumptions.flatMap((item) => item === "Standardized wall height and cozy materials"
        ? ["Game finishes approximate the walkthrough; original furnishings and duct geometry are not captured", "Room/opening heights used where available; missing sill and ceiling elevations remain estimates"] : [item]) },
      floorPlan: {
      ...plan, metadataSource: "matterport-live", metadataFetchedAt: source.fetchedAt,
      ...(baseline === undefined ? {} : { sourceFloorElevation: baseline }),
      rooms: plan.rooms.map((room) => {
        const match = rooms.get(room.id)!;
        const height = match.dimensionEstimates?.height;
        const { label: _oldLabel, labelSource: _oldLabelSource, ...geometry } = room;
        return { ...geometry,
          ...sourceRoomLabel(match),
          ...(finite(height) && height > 0 && height < 100 ? { height } : {}),
        };
      }),
      walls: plan.walls.map((wall) => ({ ...wall, openings: wall.openings.map((opening) => {
        const elevation = edges.get(wall.id)!.openings.find((o) => o.id === opening.id)!.lowerElevation;
        return { ...opening, ...(finite(elevation) ? { sourceLowerElevation: elevation,
          ...(baseline === undefined ? {} : { lowerElevation: elevation - baseline }) } : {}) };
      }) })),
    } };
  } catch { return listing; }
}

export interface MatterportModel {
  propertyId: string;
  modelId: string;
  embedUrl: string;
  source: "matterport-live" | "matterport-showcase";
  name?: string;
  floorCount?: number;
  scanAreaM2?: number;
  detail?: string;
}

const DEMO_MODELS: Record<string, string> = {
  // Public Matterport showcase models used as stand-ins for café twins
  "hou-midtown-1204": "SxQL3iGyoDo",
  "hou-heights-88": "2EZxqZ6vV3s",
  "hou-eaado-41": "eSVT9Q2cG8R",
  "la-silverlake-9": "SxQL3iGyoDo",
  "la-arts-district-302": "2EZxqZ6vV3s",
  "la-koreatown-55": "eSVT9Q2cG8R",
};

function embedFor(modelId: string) {
  return `https://my.matterport.com/show/?m=${encodeURIComponent(modelId)}&play=1&qs=1&hr=0`;
}

async function fetchLiveModel(modelId: string): Promise<Partial<MatterportModel> | null> {
  const token = process.env.MATTERPORT_TOKEN?.trim() || process.env.MATTERPORT_SDK_TOKEN?.trim();
  const key = process.env.MATTERPORT_API_KEY?.trim();
  if (!token || !key) return null;
  const endpoint =
    process.env.MATTERPORT_API_URL?.trim() ||
    "https://api.matterport.com/api/models/graph";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${token}`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: "query($id:ID!) { model(id:$id) { id name floors { id } dimensionEstimates(units:metric) { area } } }", variables: { id: modelId } }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Matterport HTTP ${res.status}`);
  const body = (await res.json()) as {
    errors?: unknown[];
    data?: { model?: { id?: string; name?: string; floors?: { id: string }[]; dimensionEstimates?: { area?: number } } };
    id?: string;
    name?: string;
    floorCount?: number;
  };
  const model = body.data?.model;
  if (body.errors?.length || !model || model.id !== modelId) throw new Error("Matterport model query failed validation");
  return {
    modelId: String(model.id ?? modelId),
    name: model.name ? String(model.name) : undefined,
    floorCount: model.floors?.length,
    scanAreaM2: model.dimensionEstimates?.area,
    source: "matterport-live",
    detail: "Live Matterport Model API",
  };
}

export async function resolveMatterport(listing: PropertyListing): Promise<MatterportModel> {
  const modelId = listing.matterportModelId || DEMO_MODELS[listing.id] || "SxQL3iGyoDo";
  const embedUrl = listing.matterportEmbedUrl || embedFor(modelId);
  try {
    const live = await fetchLiveModel(modelId);
    if (live) {
      return {
        propertyId: listing.id,
        modelId: live.modelId || modelId,
        embedUrl: embedFor(live.modelId || modelId),
        source: "matterport-live",
        name: live.name,
        floorCount: live.floorCount,
        scanAreaM2: live.scanAreaM2,
        detail: live.detail,
      };
    }
  } catch (err) {
    return {
      propertyId: listing.id,
      modelId,
      embedUrl,
      source: "matterport-showcase",
      detail: `Live Matterport unavailable (${err instanceof Error ? err.message : "error"}) — showcase embed`,
    };
  }
  return {
    propertyId: listing.id,
    modelId,
    embedUrl,
    source: "matterport-showcase",
    detail: "Showcase embed (set MATTERPORT_TOKEN for Model API)",
  };
}

/** Attach default Matterport model ids onto bundled listings. */
export function withMatterportDefaults(listings: PropertyListing[]): PropertyListing[] {
  return listings.map((p) => ({
    ...p,
    matterportModelId: p.matterportModelId || DEMO_MODELS[p.id],
    matterportEmbedUrl: p.matterportEmbedUrl || (DEMO_MODELS[p.id] ? embedFor(DEMO_MODELS[p.id]) : undefined),
  }));
}
