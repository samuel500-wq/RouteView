'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';

const userIcon = L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: 22px; height: 22px;">
      <span style="position:absolute;inset:-10px;border-radius:50%;background:#3b82f6;opacity:0.3;animation:rv-pulse 1.8s infinite;"></span>
      <div style="position:absolute;inset:0;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.7);"></div>
    </div>
  `,
  iconSize: [22, 22], iconAnchor: [11, 11]
});

const placeIcon = (emoji: string, selected: boolean) => L.divIcon({
  className: '',
  html: `
    <div style="position: relative; width: ${selected ? 40 : 32}px; height: ${selected ? 40 : 32}px;">
      ${selected ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:#0ea5e944;animation:rv-pulse 1.6s infinite;"></span>` : ''}
      <div style="
        position: absolute; inset: 0;
        background: white;
        border: 3px solid ${selected ? '#0ea5e9' : '#10b981'};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        display: grid; place-items: center;
      ">
        <span style="transform: rotate(45deg); font-size: ${selected ? 16 : 13}px;">${emoji}</span>
      </div>
    </div>
  `,
  iconSize: [selected ? 40 : 32, selected ? 40 : 32],
  iconAnchor: [selected ? 20 : 16, selected ? 40 : 32]
});

function ReCenter({ target, zoom }: { target: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, zoom ?? Math.max(map.getZoom(), 14), { animate: true });
  }, [target, zoom, map]);
  return null;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 });
    } else if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [points.length, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function PlacesMap({
  userLocation,
  places,
  selectedPlace,
  onSelectPlace,
  mapStyle = 'streets'
}: {
  userLocation: { lat: number; lng: number; accuracy?: number } | null;
  places: any[];
  selectedPlace: any | null;
  onSelectPlace: (p: any) => void;
  mapStyle?: 'streets' | 'satellite';
}) {
  const points = useMemo<[number, number][]>(() => {
    const out: [number, number][] = [];
    if (userLocation) out.push([userLocation.lat, userLocation.lng]);
    for (const p of places) out.push([p.lat, p.lng]);
    return out;
  }, [userLocation, places]);

  const routePoints = useMemo<[number, number][]>(() => {
    if (!userLocation || !selectedPlace) return [];
    // Straight line for now — replaces with real route if the place has bus route polyline
    return [
      [userLocation.lat, userLocation.lng],
      [selectedPlace.lat, selectedPlace.lng]
    ];
  }, [userLocation, selectedPlace]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
      <style jsx global>{`
        @keyframes rv-pulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
      `}</style>

      <MapContainer center={[-1.9441, 30.0619]} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        {mapStyle === 'streets' && (
          <TileLayer
            key="s"
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {mapStyle === 'satellite' && (
          <>
            <TileLayer
              key="sat"
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
            <TileLayer
              key="satl"
              url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              opacity={0.85}
            />
          </>
        )}

        {/* Auto-fit when places change and nothing is selected yet */}
        {!selectedPlace && points.length > 0 && <FitBounds points={points} />}
        {selectedPlace && <ReCenter target={[selectedPlace.lat, selectedPlace.lng]} zoom={15} />}

        {/* Straight line from user to selected place */}
        {routePoints.length === 2 && (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: '#0ea5e9', weight: 4, opacity: 0.75, dashArray: '8, 6' }}
          />
        )}

        {/* User */}
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

        {/* Places */}
        {places.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={placeIcon(emojiOf(p.category), selectedPlace?.id === p.id)}
            eventHandlers={{ click: () => onSelectPlace(p) }}
          >
            <Popup>
              <div style={{ minWidth: 180, fontSize: 12 }}>
                <p style={{ fontWeight: 600 }}>{p.name}</p>
                {p.distance_m != null && (
                  <p style={{ color: '#64748b', marginTop: 2 }}>
                    {p.distance_m < 1000 ? `${p.distance_m} m` : `${(p.distance_m / 1000).toFixed(1)} km`}
                    {p.walking_min != null ? ` · ~${p.walking_min} min walk` : ''}
                  </p>
                )}
                {p.moto && (
                  <p style={{ color: '#b45309', marginTop: 2 }}>
                    🛵 Moto ~{p.moto.fare_rwf} RWF
                  </p>
                )}
                {p.bus && (
                  <p style={{ color: '#047857', marginTop: 2 }}>
                    🚌 {p.bus.route_code} · ~{p.bus.fare_rwf} RWF
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-medium shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-slate-700 dark:text-slate-300">You</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-700 dark:text-slate-300">Nearby place</span>
        </div>
      </div>

      {/* Empty state */}
      {places.length === 0 && !userLocation && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
          <p className="mx-auto max-w-xs rounded-xl bg-white/95 px-4 py-3 text-sm text-slate-600 shadow-lg backdrop-blur dark:bg-slate-900/95 dark:text-slate-300">
            Ask the assistant a question, then tap <strong>My location</strong> to see places on the map.
          </p>
        </div>
      )}
    </div>
  );
}

function emojiOf(cat: string): string {
  const m: Record<string, string> = {
    restaurant: '🍽️', cafe: '☕', fast_food: '🍔', bar: '🍺',
    supermarket: '🛒', market: '🏪', pharmacy: '💊', hospital: '🏥',
    bank: '🏦', atm: '🏧', fuel: '⛽', hotel: '🏨', school: '🎓',
    place_of_worship: '⛪', place: '📍'
  };
  return m[cat] || '📍';
}