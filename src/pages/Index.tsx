import React, { useRef } from 'react';
import { Map } from '@/components/Map';
import AddressSearch from '@/components/AddressSearch';
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const [transportMode, setTransportMode] = React.useState('driving');
  const [selectedLocations, setSelectedLocations] = React.useState<Array<{ lat: number; lng: number }>>([]);

  const isMobile = useIsMobile();

  const handleLocationSelect = (location: { lat: number; lng: number }) => {
    setSelectedLocations(prev => {
      if (prev.length < 2) {
        return [...prev, location];
      }
      return [location];
    });
  };

  return (
    <div className="relative min-h-screen">
      <Map onLocationSelect={handleLocationSelect} selectedLocations={selectedLocations} />
      <div className={`absolute top-4 z-10 ${isMobile ? 'left-4 right-4' : 'left-4 w-[400px]'}`}>
        <AddressSearch
          transportMode={transportMode}
          onTransportModeChange={setTransportMode}
        />
      </div>
    </div>
  );
};

export default Index;