import mapboxgl from 'mapbox-gl';

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

export const findEquidistantPoint = async (
  routeCoordinates: number[][],
  startLocation: [number, number],
  endLocation: [number, number],
  transportMode: string
) => {
  // Sample 100 points along the route
  const samples = 100;
  const sampledPoints = [];
  const totalPoints = routeCoordinates.length;
  
  for (let i = 0; i < samples; i++) {
    const index = Math.floor((i / samples) * totalPoints);
    sampledPoints.push(routeCoordinates[index]);
  }

  // Calculate travel times for each point
  const travelTimes = await Promise.all(
    sampledPoints.map(async (point) => {
      const startTime = await getDirections(startLocation, [point[0], point[1]], transportMode)
        .then(data => data?.routes[0]?.duration || 0);
      const endTime = await getDirections([point[0], point[1]], endLocation, transportMode)
        .then(data => data?.routes[0]?.duration || 0);
        
      return {
        point,
        timeDifference: Math.abs(startTime - endTime),
        totalTime: startTime + endTime
      };
    })
  );

  // Find the point with the smallest time difference
  const bestPoint = travelTimes
    .filter(Boolean)
    .sort((a, b) => a!.timeDifference - b!.timeDifference)[0];

  return bestPoint?.point || null;
};

export const drawRoute = (map: mapboxgl.Map, coordinates: number[][]) => {
  // Remove existing route
  if (map.getLayer('route')) {
    map.removeLayer('route');
  }
  if (map.getSource('route')) {
    map.removeSource('route');
  }

  // Add the route to the map
  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    }
  });

  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#3b82f6',
      'line-width': 4
    }
  });
};