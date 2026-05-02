/**
 * TypeScript default; Metro resolves `AddPinMap.web` / `AddPinMap.native` at bundle time.
 * Do not import `react-native-maps` here — web must not see it.
 */
export { default } from "./AddPinMap.native";
export type { AddPinMapProps } from "./AddPinMap.types";
