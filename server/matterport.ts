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
  if (!token) return null;
  const endpoint =
    process.env.MATTERPORT_API_URL?.trim() ||
    `https://api.matterport.com/api/models/graph?query=${encodeURIComponent(
      `{ model(id: "${modelId}") { id name floorCount } }`,
    )}`;
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Matterport HTTP ${res.status}`);
  const body = (await res.json()) as {
    data?: { model?: { id?: string; name?: string; floorCount?: number } };
    id?: string;
    name?: string;
    floorCount?: number;
  };
  const model = body.data?.model ?? {
    id: body.id,
    name: body.name,
    floorCount: body.floorCount,
  };
  return {
    modelId: String(model.id ?? modelId),
    name: model.name ? String(model.name) : undefined,
    floorCount: typeof model.floorCount === "number" ? model.floorCount : undefined,
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
