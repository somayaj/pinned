import { useId } from "react";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

type Props = {
  /** Outer box (viewBox 128 → scaled). Default matches header mark. */
  size?: number;
};

/**
 * Map + location pin + task checklist — same design as `public/pin-it-logo.svg`,
 * inlined so it works on web (Metro) and iOS/Android without relying on `/public` URLs.
 */
export function PinItLogoIcon({ size = 44 }: Props) {
  const u = useId().replace(/[^a-zA-Z0-9]/g, "");
  const pinGradId = `logoPinGrad${u}`;
  const taskGradId = `taskChipGrad${u}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Defs>
        <LinearGradient
          id={pinGradId}
          x1="36"
          y1="14"
          x2="84"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#f87171" />
          <Stop offset="1" stopColor="#dc2626" />
        </LinearGradient>
        <LinearGradient id={taskGradId} x1="78" y1="78" x2="118" y2="118">
          <Stop stopColor="#ef4444" />
          <Stop offset="1" stopColor="#b91c1c" />
        </LinearGradient>
      </Defs>

      <Rect
        x="10"
        y="18"
        width="108"
        height="92"
        rx="18"
        fill="#f8fafc"
        stroke="#e2e8f0"
        strokeWidth="2"
      />
      <Path
        d="M22 40c16-10 34-10 50 0s34 10 50 0"
        stroke="#cbd5e1"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M22 56h84" stroke="#cbd5e1" strokeWidth="1.2" opacity={0.75} />
      <Path
        d="M26 72c22 8 44 8 66 0"
        stroke="#cbd5e1"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        opacity={0.85}
      />
      <Path
        d="M30 88c18 6 36 6 54 0"
        stroke="#cbd5e1"
        strokeWidth="1.2"
        fill="none"
        opacity={0.65}
      />
      <Circle cx="32" cy="86" r="2.5" fill="#94a3b8" opacity={0.45} />
      <Circle cx="96" cy="82" r="2.5" fill="#94a3b8" opacity={0.4} />

      <Path
        fill={`url(#${pinGradId})`}
        d="M64 20c-16.5 0-30 13.2-30 29.5C34 72 64 108 64 108s30-36 30-58.5C94 33.2 80.5 20 64 20zm0 42a14 14 0 110-28 14 14 0 010 28z"
      />
      <Circle cx="64" cy="49.5" r="9" fill="white" opacity={0.95} />

      <G transform="translate(70, 72)">
        <Rect
          width="46"
          height="46"
          rx="13"
          fill={`url(#${taskGradId})`}
          stroke="#fecaca"
          strokeWidth="1.5"
        />
        <Rect x="10" y="11" width="26" height="24" rx="3" fill="white" opacity={0.95} />
        <Path
          d="M14 17h18M14 22h18M14 27h12"
          stroke="#fecaca"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <Circle cx="30" cy="27" r="5.5" fill="#dc2626" />
        <Path
          d="M27.2 27l1.6 1.6 3.4-4.2"
          stroke="white"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}
