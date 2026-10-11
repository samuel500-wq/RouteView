'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@/lib/api';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const originIcon = L.divIcon({
  className: '',
  html: `<div style="background:#0ea5e9;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10]
});
const destIcon = L.divIcon({
  className: '',
  html: `<div style="background:#10b981;border:3px solid white;border-radius:50%;width:20px;height:20px;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10]
});
const vehIcon = (color: string) => L.divIcon({
  className: '',
  html: `<div style="background:${color};border:2px solid white;border-radius:50%;width:12px;height:12px;box-shadow:0 0 0 3px ${color}33"></div>`,
  iconSize: [12, 12], iconAnchor: [6, 6]
});

export default function JourneyMap({
  options, fromStop, toStop, routesMap
}: { options: any[]; fromStop: any; toStop: any; routesMap?: Record<number, any> }) {
  const [localCache, setLocalCache] = useState<Record<number, any>>({});

  // Only fetch routes we don't already have from the server
  useEffect(() => {
    if (!options?.length) return;
    const ids = new Set<number>();
    for (const o of options) {
      if (o.route?.id && !routesMap?.[o.route.id]) ids.add(o.route.id);
      if (o.legs) for (const l of o.legs) if (l.route?.id && !routesMap?.[l.route.id]) ids.add(l.route.id);
    }
    ids.forEach(async (id) => {
      if (localCache[id]) return;
      try {
        const data = await api.getRoute(id);
        setLocalCache((prev) => ({ ...prev, [id]: data }));
      } catch { /* ignore */ }
    });
  }, [options, routesMap]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fromStop || !toStop) return null;

  // Combine: server-provided routes take priority; supplement with locally-fetched
  const allRoutes: Record<number, any> = { ...localCache, ...(routesMap || {}) };

  const center: [number, number] = [Number(fromStop.lat), Number(fromStop.lng)];

  return (
    <div className="h-[380px] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <MapContainer center={center} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {Object.values(allRoutes).map((r: any) => {
          const stops = r.stops || [];
          if (stops.length < 2) return null;
          const positions: [number, number][] = stops.map(
            (s: any) => [Number(s.lat), Number(s.lng)]
          );
          const color = r.route?.color_hex || r.color || '#0ea5e9';
          return (
            <Polyline
              key={`line-${r.route?.id || r.id}`}
              positions={positions}
              pathOptions={{ color, weight: 5, opacity: 0.75 }}
            />
          );
        })}

        <Marker position={[Number(fromStop.lat), Number(fromStop.lng)]} icon={originIcon}>
          <Popup><strong>From:</strong> {fromStop.name_en}</Popup>
        </Marker>
        <Marker position={[Number(toStop.lat), Number(toStop.lng)]} icon={destIcon}>
          <Popup><strong>To:</strong> {toStop.name_en}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}