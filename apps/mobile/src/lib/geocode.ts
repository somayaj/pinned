import * as Location from "expo-location";
import { Platform } from "react-native";
import { getApiBaseUrl } from "./config";

/** Nominatim requires a descriptive User-Agent per usage policy. */
const NOMINATIM_UA = "Pinned/1.0 (https://expo.dev)";

export type GeocodeResult = { latitude: number; longitude: number };

/**
 * Resolve a free-text query (street address, city, US ZIP, etc.) to coordinates.
 * Native: Apple / Google geocoder via expo-location when available, then Nominatim.
 * Web: pinned-api GET /geocode, then Photon (CORS-friendly), then direct Nominatim (often CORS-blocked).
 */
export async function geocodeSearch(
  query: string,
): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q.length) return null;

  if (Platform.OS === "web") {
    const viaApi = await geocodeViaPinnedApi(q);
    if (viaApi) return viaApi;
    const viaPhoton = await geocodePhoton(q);
    if (viaPhoton) return viaPhoton;
    return geocodeNominatim(q);
  }

  try {
    const results = await Location.geocodeAsync(q);
    if (results.length > 0) {
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
    }
  } catch {
    /* fall through to Nominatim */
  }

  return geocodeNominatim(q);
}

async function geocodeViaPinnedApi(q: string): Promise<GeocodeResult | null> {
  try {
    const base = (await getApiBaseUrl()).replace(/\/$/, "");
    const url = `${base}/geocode?q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    const ct = res.headers.get("content-type") ?? "";
    if (res.status === 404) {
      if (ct.includes("application/json")) {
        try {
          const err = (await res.json()) as { error?: string };
          if (err.error === "not_found") return null;
        } catch {
          return null;
        }
      }
      return null;
    }
    if (!res.ok) return null;
    if (!ct.includes("application/json")) return null;
    const data = (await res.json()) as {
      latitude?: number;
      longitude?: number;
    };
    const { latitude, longitude } = data;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }
    return { latitude, longitude };
  } catch {
    return null;
  }
}

/** Public search API; usable from browsers when Railway /geocode is missing or returns not_found. */
async function geocodePhoton(q: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null;
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number] } }[];
    };
    const c = data.features?.[0]?.geometry?.coordinates;
    if (!c || c.length < 2) return null;
    const [longitude, latitude] = c;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

async function geocodeNominatim(q: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": NOMINATIM_UA },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data.length) return null;
    const latitude = Number.parseFloat(data[0].lat);
    const longitude = Number.parseFloat(data[0].lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}
