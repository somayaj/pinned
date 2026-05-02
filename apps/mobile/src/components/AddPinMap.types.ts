export type AddPinMapProps = {
  latitude: number;
  longitude: number;
  onCoordinateChange: (latitude: number, longitude: number) => void;
  /** Increment after geocode / search so the map recenters on the new point. */
  recenterKey: number;
};
