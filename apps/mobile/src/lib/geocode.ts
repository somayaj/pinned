import * as Location from "expo-location";
import { Platform } from "react-native";

/** Nominatim requires a descriptive User-Agent per usage policy. */
const NOMINATIM_UA = "Pinned/1.0 (https://expo.dev)";

export type GeocodeResult = { latitude: number; longitude: number };

/**
 * Resolve a free-text query (street address, city, US ZIP, etc.) to coordinates.
 * Native: Apple / Google geocoder via expo-location when available.
 * Web + fallback: OpenStreetMap Nominatim.
 */
export async function geocodeSearch(
  query: string,
): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q.length) return null;

  if (Platform.OS !== "web") {
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
  }

  return geocodeNominatim(q);
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
