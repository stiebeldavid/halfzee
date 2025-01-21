import { Map as MapboxMap, Marker } from 'mapbox-gl';

export interface MapRef {
  findMidpoint: () => void;
}

export interface MapProps {
  transportMode: string;
  onMidpointFound?: (midpoint: [number, number]) => void;
}

export interface MarkerManagerProps {
  map: MapboxMap;
  transportMode: string;
  onMidpointFound?: (midpoint: [number, number]) => void;
}

export interface LocationState {
  start: [number, number] | null;
  end: [number, number] | null;
  midpoint: [number, number] | null;
  currentMarker: Marker | null;
}