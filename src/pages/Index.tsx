import React, { useRef } from 'react';
import Map, { MapRef } from '@/components/Map';
import AddressSearch from '@/components/AddressSearch';
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const [transportMode, setTransportMode] = React.useState('driving');
  const mapRef = useRef<MapRef>(null);
  const isMobile = useIsMobile();

  const handleFindMidpoint = () => {
    mapRef.current?.findMidpoint();
  };

  return (
    <div className="relative min-h-screen">
      <Map ref={mapRef} transportMode={transportMode} />
      <div className={`absolute top-4 z-10 ${isMobile ? 'left-4 right-4' : 'left-4 w-[400px]'}`}>
        <AddressSearch
          transportMode={transportMode}
          onTransportModeChange={setTransportMode}
          onFindMidpoint={handleFindMidpoint}
        />
      </div>
    </div>
  );
};

export default Index;