import type { GeoJSON } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { baseStyle } from './mapData';

/** Creates a MapLibre map once the base style is known; returns it after 'load'. */
export function useMap(center: [number, number], zoom: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const init = useRef({ center, zoom });

  useEffect(() => {
    let m: maplibregl.Map | null = null;
    let dead = false;
    baseStyle().then((style) => {
      if (dead || !ref.current) return;
      m = new maplibregl.Map({
        container: ref.current,
        style,
        center: init.current.center,
        zoom: init.current.zoom,
        attributionControl: { compact: true },
      });
      m.on('load', () => !dead && setMap(m));
    });
    return () => {
      dead = true;
      m?.remove();
    };
  }, []);

  return { ref, map };
}

export function setGeo(map: maplibregl.Map, id: string, data: GeoJSON): void {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData(data);
  else map.addSource(id, { type: 'geojson', data });
}
