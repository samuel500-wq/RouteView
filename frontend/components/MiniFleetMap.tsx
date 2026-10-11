'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

const dot = (color: string, pulse = false) =>
  L.divIcon({
    className: '',
    html: pulse
      ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};box-shadow:0 0 0 0 ${color}cc;animation:rv-pulse 1.8s infinite;"></span>`
      : `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};"></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });

const STOP_ICON = dot('#94a3b8');

export default function MiniFleetMap({
  vehicles, stops
}: { vehicles: any[]; stops: any[] }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/20 bg-slate-950 shadow-inner">
      <style jsx global>{`
        @keyframes rv-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(56,189,248,0.6); }
          70%  { box-shadow: 0 0 0 12px rgba(56,189,248,0); }
          100% { box-shadow: 0 0 0 0 rgba(56,189,248,0); }
        }
        .leaflet-container { background: #0f172a !important; }
        /* Subtle dark filter so the standard OSM tiles match the dark UI */
        .rv-dark-tiles .leaflet-tile-pane {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3) brightness(0.7);
        }
      `}</style>

      <MapContainer
        center={[-1.9441, 30.0619]}
        zoom={12}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
        className="rv-dark-tiles"
        style={{ height: '100%', width: '100%' }}
      >
        {/* Free OpenStreetMap tiles — no API key required */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {stops.map((s) => (
          <Marker key={`s-${s.id}`}
                  position={[Number(s.lat), Number(s.lng)]}
                  icon={STOP_ICON} />
        ))}

        {vehicles.map((v) => (
          <Marker
            key={`v-${v.vehicle_id}`}
            position={[Number(v.lat), Number(v.lng)]}
            icon={dot(v.simulated ? '#f59e0b' : '#38bdf8', true)}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white backdrop-blur">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        LIVE
      </div>
    </div>
  );
}