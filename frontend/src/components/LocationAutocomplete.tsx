// src/components/LocationAutocomplete.tsx

import React, { useRef, useEffect } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { googleMapsApiKey } from "@/app/auth/firebase";

const libraries = ["places"] as ("places")[];

interface Props {
  /** Current text in the input field */
  value: string;
  /** Called on every change (typing or selection) with the new string */
  onChange: (newVal: string) => void;
  /**
   * Called only when the user selects a place from the dropdown.
   * Provides the formatted address plus coordinates.
   */
  onSelect?: (place: { formatted: string; lat: number; lng: number }) => void;
  /** Placeholder text for the input */
  placeholder?: string;
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Where will this activity take place?",
}: Props) {
  // Load the Google Maps JS API with the "places" library
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries,
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete>();

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Initialize the autocomplete widget
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["geocode"],
    });

    // Request the fields we need
    ac.setFields(["formatted_address", "name", "geometry.location"]);

    // When the user picks a suggestion...
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place) return;

      // Fallback if formatted_address is missing
      const formatted = place.formatted_address || place.name || value;

      onChange(formatted);

      if (place.geometry?.location && onSelect) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        onSelect({ formatted, lat, lng });
      }
    });

    autocompleteRef.current = ac;
  }, [isLoaded, onChange, onSelect, value]);

  if (loadError) {
    return (
      <p className="text-red-500">
        Error loading Google Maps API. Please check your API key.
      </p>
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring"
    />
  );
}
