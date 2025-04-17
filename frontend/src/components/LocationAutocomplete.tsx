import React, { useRef, useEffect } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsApiKey } from '@/app/auth/firebase';

const libraries = ["places"] as ("places")[];

interface Props {
  value: string;
  onChange: (newVal: string) => void;
  placeholder?: string;
}

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Where will this activity take place?",
}: Props) {
  // load the Maps JavaScript API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries,
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete>();

  useEffect(() => {
    if (isLoaded && inputRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        { types: ["geocode"] }
      );
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current!.getPlace();
        if (place) {
          // Check if formatted_address exists, otherwise use name
          const formatted = place.formatted_address || place.name || "";
          onChange(formatted);
        }
      });
    }
  }, [isLoaded, onChange]);

  if (loadError) {
    return <p className="text-red-500">Error loading Maps API</p>;
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border rounded"
    />
  );
}
