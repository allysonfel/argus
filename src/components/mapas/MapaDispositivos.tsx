'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type PontoDispositivo = {
  id: number;
  nome: string;
  colaboradorNome: string | null;
  cidade: string | null;
  online: boolean;
  latitude: number;
  longitude: number;
  ultimoPing: string | null;
};

// Marcador de círculo colorido via divIcon — evita o problema clássico
// do ícone padrão do Leaflet (caminho de imagem quebrado em bundlers
// modernos), e já comunica online/offline pela cor sem precisar de
// legenda extra.
function iconePonto(online: boolean) {
  const cor = online ? '#16a34a' : '#767676';
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${cor};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function MapaDispositivos({ pontos }: { pontos: PontoDispositivo[] }) {
  return (
    <MapContainer center={[-14.235, -51.9253]} zoom={4} className="h-full w-full">
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {pontos.map((p) => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={iconePonto(p.online)}>
          <Popup>
            <p className="font-semibold">{p.nome}</p>
            {p.colaboradorNome && <p>{p.colaboradorNome}</p>}
            <p>{p.online ? 'Online agora' : 'Offline'}</p>
            {p.cidade && <p>{p.cidade}</p>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
