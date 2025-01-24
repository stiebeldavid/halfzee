import mapboxgl from 'mapbox-gl';

export const calculateDistance = (point1: [number, number], point2: number[]) => {
  const R = 6371; // Earth's radius in km
  const lat1 = point1[1] * Math.PI / 180;
  const lat2 = point2[1] * Math.PI / 180;
  const deltaLat = (point2[1] - point1[1]) * Math.PI / 180;
  const deltaLon = (point2[0] - point1[0]) * Math.PI / 180;

  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const getDirections = async (
  start: [number, number], 
  end: [number, number],
  transportMode: string
) => {
  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${transportMode}/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching directions:', error);
    return null;
  }
};