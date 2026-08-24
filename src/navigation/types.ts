export type RootStackParamList = {
  Landing: undefined;
  Tabs: undefined;
  CountryDetail: { countryId: string; ownerId?: string };
  FriendProfile: { friendId: string };
};

export type TabParamList = {
  Map: undefined;
  Friends: undefined;
  Profile: undefined;
};
