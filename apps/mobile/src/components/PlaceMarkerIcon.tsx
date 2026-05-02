import Svg, { Path } from "react-native-svg";

type Props = {
  size?: number;
  color?: string;
};

/** Map pin used next to saved place names. */
export function PlaceMarkerIcon({
  size = 22,
  color = "#dc2626",
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill={color}
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 13.5 12 13.5z"
      />
    </Svg>
  );
}
