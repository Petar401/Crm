import "server-only";

export interface OpenRouterModelOption {
  id: string;
  name: string;
}

interface OpenRouterModelsResponse {
  data?: {
    id: string;
    name?: string;
    pricing?: { prompt?: string; completion?: string };
  }[];
}

/**
 * Fetches OpenRouter's public model catalog and returns only the free-tier
 * models (e.g. Nvidia Nemotron, Llama, and other $0/token entries). Returns
 * an empty list on any failure so Settings still renders without it.
 */
export async function listOpenRouterFreeModels(): Promise<
  OpenRouterModelOption[]
> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as OpenRouterModelsResponse;
    return (json.data ?? [])
      .filter(
        (m) => m.pricing?.prompt === "0" && m.pricing?.completion === "0"
      )
      .map((m) => ({ id: m.id, name: m.name ?? m.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
