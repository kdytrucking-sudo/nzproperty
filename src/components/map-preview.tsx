'use client';

import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { useEffect, useState } from 'react';

// IMPORTANT: You need to add your Google Maps API Key to your environment variables.
// Create a .env.local file in the root of your project and add the following line:
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="YOUR_API_KEY"
// Make sure you have the "Maps JavaScript API" and "Geocoding API" enabled in your Google Cloud Console.

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type MapPreviewProps = {
  address: string;
};

export function MapPreview({ address }: MapPreviewProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !API_KEY) {
      setPosition(null);
      return;
    }

    const geocodeAddress = async () => {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            address
          )}&key=${API_KEY}`
        );
        const data = await response.json();

        if (data.status === 'OK') {
          setPosition(data.results[0].geometry.location);
          setError(null);
        } else {
          setError('Could not find location. Please check the address.');
          setPosition(null);
        }
      } catch (err) {
        setError('Failed to fetch location data.');
        setPosition(null);
      }
    };

    const timeoutId = setTimeout(() => {
        geocodeAddress();
    }, 1000); // Debounce API calls

    return () => clearTimeout(timeoutId);
  }, [address]);

  if (!API_KEY) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border bg-muted">
        <p className="text-center text-muted-foreground">
          Google Maps API Key not configured.
          <br />
          Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
        </p>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border">
      <APIProvider apiKey={API_KEY}>
        <Map
          defaultCenter={{ lat: -40.9006, lng: 174.8860 }} // Default to New Zealand
          defaultZoom={position ? 15 : 5}
          center={position || undefined}
          zoom={position ? 15 : 5}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          mapId={'nz-property-ace-map'}
          className="h-full w-full"
        />
      </APIProvider>
      {error && !position && (
         <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <p className="text-destructive">{error}</p>
         </div>
      )}
    </div>
  );
}
