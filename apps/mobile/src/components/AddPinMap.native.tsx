import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { AddPinMapProps } from "./AddPinMap.types";

export default function AddPinMap({
  latitude,
  longitude,
  onCoordinateChange,
  recenterKey,
}: AddPinMapProps) {
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    mapRef.current?.animateToRegion({
      latitude,
      longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    });
  }, [recenterKey, latitude, longitude]);

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        onPress={(e) => {
          const { latitude: la, longitude: lo } = e.nativeEvent.coordinate;
          onCoordinateChange(la, lo);
        }}
      >
        <Marker
          draggable
          coordinate={{ latitude, longitude }}
          onDragEnd={(e) => {
            const c = e.nativeEvent.coordinate;
            onCoordinateChange(c.latitude, c.longitude);
          }}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 280,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
  },
});
