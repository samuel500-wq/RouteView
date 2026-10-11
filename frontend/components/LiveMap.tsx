'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, Polyline,
  CircleMarker, Tooltip, useMap
} from 'react-leaflet';
import L from 'leaflet';

/* ---------------- icons ---------------- */

const busIcon = (color: string, selected = false) => L.divIcon({
  className: 'rv-bus-marker',
  html: `
    <div style="position: relative; width: ${selected ? 32 : 24}px; height: ${selected ? 32 : 24}px;">
      ${selected ? `<span style="position:absolute;inset:-8px;border-radius:50%;background:${color}44;animation:rv-pulse 1.6s infinite;"></span>` : ''}
      <div style="
        position: absolute; inset: 0;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 3px 8px rgba(0,0,0,0.45);
        display: grid; place-items: center;
        font-size: ${selected ? 14 : 11}px;
      ">🚌</div>
    </div>
  `,
  iconSize: [selected ? 32 : 24, selected ? 32 : 24],
  iconAnchor: [selected ? 16 : 12, selected ? 16 : 12]
});

const stopDotIcon = (color: string) => L.divIcon({
  className: '',
  html: `<div style="
    width: 12px; height: 12px; border-radius: 50%;
    background: ${color}; border: 3px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const routeBadgeIcon = (code: string, color: string) => L.divIcon({
  className: '',
  html: `<div style="
    padding: 3px 9px; border-radius: 999px;
    background: ${color}; color: white;
    font-size: 11px; font-weight: 700;
    font-family: system-ui, -apple-system, Segoe UI, sans-serif;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    white-space: nowrap;
  ">${code}</div>`,
  iconSize: [40, 22],
  iconAnchor: [20, 11]
});

const userIcon = L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: 22px; height: 22px;">
      <span style="position:absolute;inset:-10px;border-radius:50%;background:#3b82f6;opacity:0.3;animation:rv-pulse 1.8s infinite;"></span>
      <div style="position:absolute;inset:0;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.7);"></div>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

/* ---------------- helpers ---------------- */

function ReCenter({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), 15), { animate: true });
  }, [target, map]);
  return null;
}

function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [bounds, map]);
  return null;
}

type MapStyle = 'streets' | 'satellite';

/* ---------------- component ---------------- */

export default function LiveMap({
  vehicles,
  routeOverlays,
  selectedVehicleId,
  onSelectVehicle,
  userLocation,
  followUser,
  showAllRoutes = true,
  mapStyle = 'streets'
}: {
  vehicles: any[];
  routeOverlays?: Array<{
    id: number;
    code: string;
    color: string;
    stops: { id: number; code: string; name_en: string; name_rw: string; lat: number; lng: number }[];
  }>;
  selectedVehicleId?: number | null;
  onSelectVehicle?: (v: any) => void;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  followUser?: boolean;
  showAllRoutes?: boolean;
  mapStyle?: MapStyle;
}) {
  const center = useMemo<[number, number]>(() => {
    if (userLocation) return [userLocation.lat, userLocation.lng];
    return [-1.9441, 30.0619];
  }, [userLocation]);

  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    const points: [number, number][] = [];
    if (routeOverlays) {
      for (const r of routeOverlays) for (const s of r.stops) points.push([s.lat, s.lng]);
    }
    for (const v of vehicles) points.push([v.lat, v.lng]);
    if (points.length === 0) return null;
    const lats = points.map((p) => p[0]);
    const lngs = points.map((p) => p[1]);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ];
  }, [routeOverlays, vehicles.length]);

  const uniqueStops = useMemo(() => {
    if (!routeOverlays) return [];
    const seen = new Map<number, any>();
    for (const r of routeOverlays) {
      for (const s of r.stops) {
        if (!seen.has(s.id)) seen.set(s.id, { ...s, color: r.color });
      }
    }
    return Array.from(seen.values());
  }, [routeOverlays]);

  const showRouteOverlays = showAllRoutes && routeOverlays && routeOverlays.length > 0;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
      <style jsx global>{`
        @keyframes rv-pulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        /* The bus markers glide smoothly between position updates.
           The duration matches the server tick so motion is continuous. */
        .leaflet-marker-icon.rv-bus-marker {
          transition: transform 2950ms linear;
          will-change: transform;
        }
        .leaflet-tooltip.rv-stop-label {
          background: rgba(255,255,255,0.96);
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 2px 7px;
          font-size: 11px;
          font-weight: 600;
          color: #0f172a;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .leaflet-tooltip.rv-stop-label::before { display: none; }
        .leaflet-tooltip.rv-stop-label-sat {
          background: rgba(15,23,42,0.85);
          color: #f8fafc;
          border-color: rgba(255,255,255,0.25);
        }
        .dark .leaflet-tooltip.rv-stop-label {
          background: rgba(15,23,42,0.96);
          color: #f1f5f9;
          border-color: #334155;
        }
      `}</style>

      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        {mapStyle === 'streets' && (
          <TileLayer
            key="streets"
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        {mapStyle === 'satellite' && (
          <>
            <TileLayer
              key="sat"
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <TileLayer
              key="sat-labels"
              url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              opacity={0.85}
            />
          </>
        )}

        {bounds && !selectedVehicleId && !userLocation && <FitBounds bounds={bounds} />}
        {followUser && userLocation && <ReCenter target={[userLocation.lat, userLocation.lng]} />}

        {/* Route polylines */}
        {showRouteOverlays && routeOverlays!.map((r) => {
          const positions = r.stops.map((s) => [s.lat, s.lng] as [number, number]);
          const mid = r.stops[Math.floor(r.stops.length / 2)];
          const dash: any = mapStyle === 'satellite'
            ? { color: 'white', weight: 7, opacity: 0.35, dashArray: '10, 6' }
            : { color: r.color, weight: 5, opacity: 0.6, dashArray: '10, 6' };
          const colored: any = { color: r.color, weight: 4, opacity: 0.9, dashArray: '10, 6' };
          return (
            <div key={`ro-${r.id}`}>
              {mapStyle === 'satellite' && <Polyline positions={positions} pathOptions={dash} />}
              <Polyline positions={positions} pathOptions={colored} />
              {mid && (
                <Marker position={[mid.lat, mid.lng]} icon={routeBadgeIcon(r.code, r.color)} interactive={false} />
              )}
            </div>
          );
        })}

        {/* Stop markers */}
        {showRouteOverlays && uniqueStops.map((s) => (
          <Marker key={`stop-${s.id}`} position={[s.lat, s.lng]} icon={stopDotIcon(s.color)}>
            <Tooltip
              permanent direction="top" offset={[0, -8]}
              className={`rv-stop-label${mapStyle === 'satellite' ? ' rv-stop-label-sat' : ''}`}
            >
              {s.name_en}
            </Tooltip>
            <Popup>
              <strong>{s.name_en}</strong>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.code}</div>
            </Popup>
          </Marker>
        ))}

        {/* Buses */}
        {vehicles.map((v) => (
          <Marker
            key={`bus-${v.vehicle_id}`}
            position={[v.lat, v.lng]}
            icon={busIcon(v.color_hex || '#0ea5e9', selectedVehicleId === v.vehicle_id)}
            eventHandlers={{ click: () => onSelectVehicle?.(v) }}
          >
            <Popup>
              <div style={{ minWidth: 180, fontSize: 12 }}>
                <p style={{ fontWeight: 600 }}>{v.plate} · {v.route_code}</p>
                <p style={{ color: '#64748b', marginTop: 2 }}>{v.passengers}/{v.capacity} passengers</p>
                {v.next_stop && (
                  <p style={{ color: '#64748b', marginTop: 2 }}>
                    Next: <strong>{v.next_stop.name_en}</strong>
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* User location */}
        {userLocation && (
          <>
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={userLocation.accuracy ? Math.min(60, userLocation.accuracy / 2) : 25}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.14, weight: 0 }}
            />
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>You are here</Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* Legend (bottom-left) */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-medium shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-700 dark:text-slate-300">GPS bus</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-700 dark:text-slate-300">Simulated bus</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-slate-700 dark:text-slate-300">You</span>
        </div>
      </div>

      {/* Live badge (top-right) */}
      <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white backdrop-blur">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        LIVE · {vehicles.length}
      </div>
    </div>
  );
}