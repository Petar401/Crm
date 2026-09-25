"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface MapPoint {
  id: string;
  kind: "company" | "lead";
  name: string;
  href: string;
  lat: number;
  lng: number;
  status: string;
  postcode: string;
}

export interface RecordsMapProps {
  points: MapPoint[];
  /** Companies/leads with no usable UK postcode — shown as a note below the map. */
  notPlacedCount: number;
}

// East Anglia — sensible default when there's nothing to fit bounds to.
const FALLBACK_CENTER: L.LatLngTuple = [52.4, 0.9];
const FALLBACK_ZOOM = 8;

const COLOR: Record<MapPoint["kind"], string> = {
  company: "#2563eb", // blue
  lead: "#f97316", // orange
};

/** Builds a popup DOM node without ever touching innerHTML with record data. */
function buildPopup(point: MapPoint): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "text-sm";

  const name = document.createElement("div");
  name.className = "font-medium";
  name.textContent = point.name; // textContent — never innerHTML with record data
  wrapper.appendChild(name);

  const link = document.createElement("a");
  link.href = point.href;
  link.className = "text-xs text-blue-600 hover:underline";
  link.textContent = point.kind === "company" ? "View company" : "View lead";
  wrapper.appendChild(link);

  return wrapper;
}

/**
 * Plain Leaflet map (no react-leaflet). Rendered only on the client via a
 * `next/dynamic(..., { ssr: false })` wrapper — Leaflet touches `window` at
 * import time and can't run during SSR.
 */
export function RecordsMap({ points, notPlacedCount }: RecordsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{ company: L.LayerGroup; lead: L.LayerGroup } | null>(null);
  const [showCompanies, setShowCompanies] = useState(true);
  const [showLeads, setShowLeads] = useState(true);

  // Build the map once on mount; markers are created from the initial
  // `points` prop and the layer-visibility effect below toggles them.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const companyLayer = L.layerGroup().addTo(map);
    const leadLayer = L.layerGroup().addTo(map);
    layersRef.current = { company: companyLayer, lead: leadLayer };

    for (const point of points) {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 7,
        weight: 1.5,
        color: COLOR[point.kind],
        fillColor: COLOR[point.kind],
        fillOpacity: 0.85,
      });
      marker.bindPopup(buildPopup(point));
      (point.kind === "company" ? companyLayer : leadLayer).addLayer(marker);
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [24, 24] });
    } else {
      map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
    // Markers are built once from the points the page loaded with; toggling
    // which layer is visible is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    if (showCompanies && !map.hasLayer(layers.company)) layers.company.addTo(map);
    if (!showCompanies && map.hasLayer(layers.company)) map.removeLayer(layers.company);
    if (showLeads && !map.hasLayer(layers.lead)) layers.lead.addTo(map);
    if (!showLeads && map.hasLayer(layers.lead)) map.removeLayer(layers.lead);
  }, [showCompanies, showLeads]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <div className="flex items-center gap-2">
          <Checkbox
            id="map-toggle-companies"
            checked={showCompanies}
            onCheckedChange={(checked) => setShowCompanies(!!checked)}
          />
          <Label htmlFor="map-toggle-companies" className="flex items-center gap-1.5 font-normal">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: COLOR.company }}
            />
            Companies
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="map-toggle-leads"
            checked={showLeads}
            onCheckedChange={(checked) => setShowLeads(!!checked)}
          />
          <Label htmlFor="map-toggle-leads" className="flex items-center gap-1.5 font-normal">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: COLOR.lead }}
            />
            Leads
          </Label>
        </div>
      </div>

      <div ref={containerRef} className="h-[70vh] w-full rounded-lg border" />

      {notPlacedCount > 0 && (
        <p className="text-muted-foreground text-sm">
          {notPlacedCount} record{notPlacedCount === 1 ? "" : "s"} couldn&apos;t be placed
          (missing or non-UK postcode).
        </p>
      )}
    </div>
  );
}
