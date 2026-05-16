import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import SplashScreen        from '../screens/SplashScreen';
import LoginScreen         from '../screens/LoginScreen';
import AssignmentScreen    from '../screens/AssignmentScreen';
import MapScreen           from '../screens/MapScreen';
import BoardingScreen      from '../screens/BoardingScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen       from '../screens/ProfileScreen';
import SosScreen           from '../screens/SosScreen';

import { colors } from '../theme';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* ── Custom tab bar (identical pattern to parents app) ──────────── */
function CustomTabBar({ state, descriptors, navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 14);

  return (
    <View style={[tb.bar, { paddingBottom: bottomPad }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, merge: true });
          }
        };

        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [tb.tab, pressed && tb.tabPressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
          >
            <View style={[tb.pill, focused && tb.pillActive]}>
              {options.tabBarIcon({
                color: focused ? colors.primary : colors.textMuted,
                focused,
                size: 24,
              })}
            </View>
            <Text style={[tb.label, focused && tb.labelActive]} numberOfLines={1} allowFontScaling={false}>
              {options.title ?? t(`tabs.${route.name.toLowerCase()}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingTop: 10,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 18,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabPressed: { opacity: 0.7 },
  pill: { width: 56, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.primarySoft },
  label: { fontSize: 10, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.1 },
  labelActive: { color: colors.primary, fontWeight: '700' },
});

/* ── Tab icons ──────────────────────────────────────────────────── */
const TAB_ICONS = {
  Assignment:    'calendar-today',
  Map:           'map-marker-radius',
  Boarding:      'account-check',
  Notifications: 'bell-outline',
  Profile:       'account-circle-outline',
};

const makeTabIcon = (name) =>
  function TabIcon({ color, size }) {
    return <MaterialCommunityIcons name={TAB_ICONS[name]} size={size} color={color} allowFontScaling={false} />;
  };

/* ── Main tabs ──────────────────────────────────────────────────── */
function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false, freezeOnBlur: true, lazy: true }}
    >
      <Tab.Screen
        name="Assignment"
        component={AssignmentScreen}
        options={{ title: t('tabs.assignment'), tabBarIcon: makeTabIcon('Assignment') }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ title: t('tabs.map'), tabBarIcon: makeTabIcon('Map') }}
      />
      <Tab.Screen
        name="Boarding"
        component={BoardingScreen}
        options={{ title: t('tabs.boarding'), tabBarIcon: makeTabIcon('Boarding') }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: t('tabs.notifications'), tabBarIcon: makeTabIcon('Notifications') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('tabs.profile'), tabBarIcon: makeTabIcon('Profile') }}
      />
    </Tab.Navigator>
  );
}

/* ── Root stack ─────────────────────────────────────────────────── */
export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login"  component={LoginScreen} />
        <Stack.Screen name="Main"   component={MainTabs} />
        <Stack.Screen
          name="Sos"
          component={SosScreen}
          options={{
            presentation: Platform.OS === 'ios' ? 'modal' : 'transparentModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
