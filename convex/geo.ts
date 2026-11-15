import { v } from "convex/values";
import { action } from "./_generated/server";

const place = v.object({
  label: v.string(),
  lat: v.number(),
  lng: v.number(),
  source: v.string(),
  fetchedAt: v.number(),
});

type OpenMeteoResult = {
  name: string;
  admin1?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
};

async function searchOpenMeteo(name: string) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=" +
    encodeURIComponent(name);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo geocoding failed (${res.status})`);
  const data = (await res.json()) as { results?: OpenMeteoResult[] };
  const g = data.results?.[0];
  if (!g) return null;
  return {
    label: [g.name, g.admin1, g.country_code].filter(Boolean).join(", "),
    lat: g.latitude,
    lng: g.longitude,
    source: url,
    fetchedAt: Date.now(),
  };
}

/**
 * Resolve a typed or spoken location to a real place: a 5-digit US ZIP goes to
 * Zippopotam, anything else to Open-Meteo's geocoder. Returns null when the
 * place can't be found; every hit carries its source URL and fetch time.
 */
export const geocode = action({
  args: { query: v.string() },
  returns: v.union(place, v.null()),
  handler: async (_ctx, args) => {
    const query = args.query.trim();
    if (query.length < 3) return null;

    if (/^\d{5}$/.test(query)) {
      const url = `https://api.zippopotam.us/us/${query}`;
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Zippopotam lookup failed (${res.status})`);
      const data = (await res.json()) as {
        places?: Array<Record<string, string>>;
      };
      const p = data.places?.[0];
      if (!p) return null;
      return {
        label: `${p["place name"]}, ${p["state abbreviation"]} ${query}`,
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        source: url,
        fetchedAt: Date.now(),
      };
    }

    const exact = await searchOpenMeteo(query);
    if (exact || !query.includes(",")) return exact;
    return await searchOpenMeteo(query.split(",")[0].trim());
  },
});
