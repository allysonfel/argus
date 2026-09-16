'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export type PontoMarcacao = {
  id: number;
  colaboradorNome: string;
  tipo: string;
  registradoEm: string;
  latitude: number;
  longitude: number;
};

export function MapaPonto({ pontos }: { pontos: PontoMarcacao[] }) {
  return (
    <MapContainer center={[-8.28, -35.97]} zoom={7} className="h-full w-full">
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {pontos.map((p) => (
        <CircleMarker key={p.id} center={[p.latitude, p.longitude]} radius={6} pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.6 }}>
          <Popup>
            <p className="font-semibold">{p.colaboradorNome}</p>
            <p>{p.tipo}</p>
            <p>{new Date(p.registradoEm).toLocaleString('pt-BR')}</p>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
