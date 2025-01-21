import { toast } from "@/components/ui/use-toast";

export const searchNearbyPlaces = async (point: [number, number], mapboxToken: string) => {
  try {
    console.log('Searching for places near:', point);
    
    // Calculate bounding box (roughly 2km radius)
    const radius = 2;
    const bbox = [
      point[0] - radius,
      point[1] - radius,
      point[0] + radius,
      point[1] + radius
    ].join(',');

    // Search for places
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/restaurant%2Ccafe.json?` +
      `proximity=${point[0]},${point[1]}&` +
      `bbox=${bbox}&` +
      `limit=10&` +
      `types=poi&` +
      `categories=restaurant,cafe,coffee_shop&` +
      `access_token=${mapboxToken}`
    );

    const data = await response.json();
    console.log('Places API response:', data);
    
    if (!data.features || data.features.length === 0) {
      console.log('No places found within radius. Search parameters:', {
        point,
        bbox,
        categories: 'restaurant,cafe,coffee_shop'
      });
      toast({
        title: "No Places Found",
        description: "No restaurants or cafes were found near the midpoint. Try a different location.",
        variant: "destructive"
      });
      return [];
    }

    toast({
      title: "Places Found",
      description: `Found ${data.features.length} places near the midpoint.`,
    });

    return data.features;
  } catch (error) {
    console.error('Error searching nearby places:', error);
    toast({
      title: "Error",
      description: "Failed to find nearby places.",
      variant: "destructive"
    });
    return [];
  }
};

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
  return R * c; // Distance in km
};