'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

export default function RouteMap({
  stops, color
}: { stops: { id: number; lat: number; lng: number; name_en: string; code: string }[]; color: string }) {
  if (!stops.length) return <div className="rounded-xl border border-slate-200 p-6 text-sm dark:border-slate-800">No stops to display.</div>;
  const center: [number, number] = [Number(stops[0].lat), Number(stops[0].lng)];
  const line: [number, number][] = stops.map((s) => [Number(s.lat), Number(s.lng)]);

  return (
    <div className="h-[420px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url={process.env.NEXT_PUBLIC_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'}
        />
        <Polyline positions={line} pathOptions={{ color, weight: 5, opacity: 0.75 }} />
        {stops.map((s, i) => (
          <Marker key={s.id} position={[Number(s.lat), Number(s.lng)]}>
            <Popup>
              <strong>{i + 1}. {s.name_en}</strong><br />{s.code}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}