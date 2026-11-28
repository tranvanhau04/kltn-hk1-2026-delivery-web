/**
 * Pure GeoJSON geometry helpers for Zones (zero Leaflet / DOM dependencies)
 * Safe for SSR and lightweight client components without pulling Leaflet into initial bundles.
 */

export function parseZoneBoundary(boundaryGeoJson: unknown): [number, number][] {
  if (!boundaryGeoJson) return [];
  try {
    let parsed: unknown = boundaryGeoJson;
    if (typeof boundaryGeoJson === 'string') {
      const trimmed = boundaryGeoJson.trim();
      if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return [];
      parsed = JSON.parse(trimmed);
    }
    if (typeof parsed !== 'object' || parsed === null) return [];

    const geo = parsed as {
      type?: string;
      coordinates?: unknown[];
    };

    let rawCoords: number[][] = [];
    const coords = geo.coordinates as unknown[];
    if (geo.type === 'Polygon' && Array.isArray(coords) && Array.isArray(coords[0])) {
      rawCoords = coords[0] as number[][];
    } else if (
      geo.type === 'MultiPolygon' &&
      Array.isArray(coords) &&
      Array.isArray(coords[0]) &&
      Array.isArray((coords[0] as unknown[])[0])
    ) {
      rawCoords = (coords[0] as unknown[])[0] as number[][];
    }

    if (!rawCoords || rawCoords.length < 3) return [];

    const positions: [number, number][] = rawCoords.map((pt) => {
      const a = Number(pt[0]);
      const b = Number(pt[1]);
      if (isNaN(a) || isNaN(b)) return [10.8012, 106.7138];

      // Vietnam Coordinate Validation:
      // Latitudes: ~8.5° to 23.5° North
      // Longitudes: ~102.0° to 110.0° East
      if (a >= 8 && a <= 25 && b >= 100 && b <= 112) {
        return [a, b];
      }
      if (b >= 8 && b <= 25 && a >= 100 && a <= 112) {
        return [b, a];
      }

      return [b, a];
    });

    return positions;
  } catch {
    return [];
  }
}

export function polygonCenter(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [10.8012, 106.7138];
  const lat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lat, lng];
}
