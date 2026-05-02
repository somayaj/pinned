import L from "leaflet";
import React, { useEffect, useRef } from "react";
import type { AddPinMapProps } from "./AddPinMap.types";

const LEAFLET_CSS_ID = "pinned-leaflet-css";
const LEAFLET_CSS_HREF =
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

/** Load Leaflet CSS from CDN so Metro web does not parse leaflet.css url() assets. */
function useLeafletStylesheet() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(LEAFLET_CSS_ID)) return;
    const link = document.createElement("link");
    link.id = LEAFLET_CSS_ID;
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS_HREF;
    document.head.appendChild(link);
    return () => {
      document.getElementById(LEAFLET_CSS_ID)?.remove();
    };
  }, []);
}

/** Leaflet default marker assets (bundler-safe). */
function useDefaultMarkerIcon() {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
      iconUrl: require("leaflet/dist/images/marker-icon.png"),
      shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
    });
  }, []);
}

export default function AddPinMap({
  latitude,
  longitude,
  onCoordinateChange,
  recenterKey,
}: AddPinMapProps) {
  useLeafletStylesheet();
  useDefaultMarkerIcon();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const readyRef = useRef(false);
  const onCoordRef = useRef(onCoordinateChange);
  onCoordRef.current = onCoordinateChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof document === "undefined") return;

    const map = L.map(host, {
      zoomControl: true,
      attributionControl: true,
    }).setView([latitude, longitude], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    const marker = L.marker([latitude, longitude], { draggable: true }).addTo(
      map,
    );
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onCoordRef.current(p.lat, p.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onCoordRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    readyRef.current = true;

    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per mount
  }, []);

  useEffect(() => {
    if (!readyRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([latitude, longitude]);
  }, [latitude, longitude]);

  useEffect(() => {
    if (!mapRef.current || !readyRef.current) return;
    const map = mapRef.current;
    map.setView([latitude, longitude], 14, { animate: true });
    // ScrollView layout: tiles sometimes stay gray until size is recomputed after pan/zoom.
    requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [recenterKey, latitude, longitude]);

  return (
    <div
      ref={hostRef}
      style={{
        height: 280,
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "#e2e8f0",
      }}
    />
  );
}
