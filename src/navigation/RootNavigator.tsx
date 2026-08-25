import Ionicons from "@expo/vector-icons/Ionicons";
import { NavigationContainer, DarkTheme, DefaultTheme, Theme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { FEATURES } from "../config/features";
import { useLayoutMode } from "../context/LayoutModeContext";
import { useTheme, useThemeColors } from "../context/ThemeContext";
import CountryDetailScreen from "../screens/CountryDetailScreen";
import FriendProfileScreen from "../screens/FriendProfileScreen";
import FriendsScreen from "../screens/FriendsScreen";
import LandingScreen from "../screens/LandingScreen";
import MapScreen from "../screens/MapScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { ColorPalette } from "../theme/colors";
import { RootStackParamList, TabParamList } from "./types";
import WebTopNav from "./WebTopNav";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function buildNavTheme(colors: ColorPalette, scheme: "light" | "dark"): Theme {
  const base = scheme === "light" ? DefaultTheme : DarkTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.bgElevated,
      border: colors.cardBorder,
      primary: colors.accent,
      text: colors.textPrimary,
    },
  };
}

function Tabs() {
  const colors = useThemeColors();
  const { mode } = useLayoutMode();
  return (
    <Tab.Navigator
      tabBar={mode === "website" ? (props) => <WebTopNav {...props} /> : undefined}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.cardBorder,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => {
          const icon =
            route.name === "Map" ? "map" : route.name === "Friends" ? "people" : "person-circle";
          return <Ionicons name={icon as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      {FEATURES.friends && <Tab.Screen name="Friends" component={FriendsScreen} />}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const colors = useThemeColors();
  const { scheme } = useTheme();
  const navTheme = buildNavTheme(colors, scheme);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Landing">
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen
          name="CountryDetail"
          component={CountryDetailScreen}
          options={{ presentation: "modal" }}
        />
        {FEATURES.friends && (
          <Stack.Screen
            name="FriendProfile"
            component={FriendProfileScreen}
            options={{ presentation: "card" }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
