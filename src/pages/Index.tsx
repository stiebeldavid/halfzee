import React, { useState } from 'react';
import Map from '@/components/Map';
import AddressSearch from '@/components/AddressSearch';

const Index = () => {
  const [transportMode, setTransportMode] = useState('driving');

  return (
    <div className="relative min-h-screen">
      <Map transportMode={transportMode} />
      <div className="absolute top-4 left-4 right-4 z-10">
        <AddressSearch
          transportMode={transportMode}
          onTransportModeChange={setTransportMode}
        />
      </div>
    </div>
  );
};

export default Index;