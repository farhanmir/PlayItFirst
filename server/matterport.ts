/**
 * Matterport model metadata — live Model API when MATTERPORT_TOKEN is set,
 * otherwise showcase embed URLs from listing matterportModelId.
 */
import type { PropertyListing } from "../shared/types.ts";

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
