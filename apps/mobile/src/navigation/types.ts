export type RootStackParamList = {
  Home: undefined;
  AddLocation: undefined;
  LocationDetail: { locationId: string; name: string };
  AddTask: { locationId: string; locationName: string };
  AddTimeReminder: undefined;
  Settings: undefined;
};
