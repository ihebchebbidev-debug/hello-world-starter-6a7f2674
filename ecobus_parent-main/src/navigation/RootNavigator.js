import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SplashScreen          from '../screens/SplashScreen';
import OnboardingScreen      from '../screens/OnboardingScreen';
import LanguagePickerScreen  from '../screens/LanguagePickerScreen';
import LoginScreen           from '../screens/LoginScreen';
import ForgotPasswordScreen  from '../screens/ForgotPasswordScreen';
import HomeScreen            from '../screens/HomeScreen';
import TrackingScreen        from '../screens/TrackingScreen';
import NotificationsScreen   from '../screens/NotificationsScreen';
import ProfileScreen         from '../screens/ProfileScreen';
import SosScreen             from '../screens/SosScreen';
import TripHistoryScreen     from '../screens/TripHistoryScreen';
import ChildDetailsScreen    from '../screens/ChildDetailsScreen';
import PrivacyPolicyScreen   from '../screens/PrivacyPolicyScreen';
import TermsScreen           from '../screens/TermsScreen';
import DeleteAccountScreen   from '../screens/DeleteAccountScreen';
import OtpScreen                        from '../screens/OtpScreen';
import LanguageScreen                  from '../screens/LanguageScreen';
import NotificationPreferencesScreen   from '../screens/NotificationPreferencesScreen';
import ChildrenSchoolsScreen           from '../screens/ChildrenSchoolsScreen';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* ── Custom tab bar ─────────────────────────────────────────────── */
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
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, merge: true });
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

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
            {/* Pill highlight */}
            <View style={[tb.pill, focused && tb.pillActive]}>
              {options.tabBarIcon({
                color: focused ? colors.primary : colors.textMuted,
                focused,
                size: 24,
              })}
            </View>
            {/* Label */}
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
    // Elevation / shadow — no top border (shadow replaces it)
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 18,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabPressed: { opacity: 0.7 },
  pill: {
    width: 56,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.primarySoft,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});

/* ── Icon helpers ───────────────────────────────────────────────── */
// All tabs use MaterialCommunityIcons directly so every icon comes from the
// same rendering engine — same visual weight, same sizing, no PNG vs vector
// inconsistency.
const TAB_ICONS = {
  tabHome:          'home-variant',
  tabHistory:       'clock-outline',
  tabNotifications: 'bell-outline',
  tabProfile:       'account-circle-outline',
};

const makeTabIcon = (iconName) =>
  function TabIcon({ color, size }) {
    return (
      <MaterialCommunityIcons
        name={TAB_ICONS[iconName]}
        size={size}
        color={color}
        allowFontScaling={false}
      />
    );
  };

/* ── Tab navigator ──────────────────────────────────────────────── */
function MainTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        lazy: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('tabs.home'), tabBarIcon: makeTabIcon('tabHome') }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={TripHistoryScreen}
        options={{ title: t('tabs.history'), tabBarIcon: makeTabIcon('tabHistory') }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: t('tabs.notifications'), tabBarIcon: makeTabIcon('tabNotifications') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('tabs.profile'), tabBarIcon: makeTabIcon('tabProfile') }}
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
        <Stack.Screen name="Splash"         component={SplashScreen} />
        <Stack.Screen name="LanguagePicker" component={LanguagePickerScreen} />
        <Stack.Screen name="Onboarding"     component={OnboardingScreen} />
        <Stack.Screen name="Login"          component={LoginScreen} />
        <Stack.Screen name="Otp"            component={OtpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="Main"           component={MainTabs} />
        <Stack.Screen name="ChildDetails"   component={ChildDetailsScreen} />
        <Stack.Screen name="Tracking"       component={TrackingScreen} />
        <Stack.Screen name="TripHistory"    component={TripHistoryScreen} />
        <Stack.Screen name="PrivacyPolicy"  component={PrivacyPolicyScreen} />
        <Stack.Screen name="Terms"          component={TermsScreen} />
        <Stack.Screen name="DeleteAccount"  component={DeleteAccountScreen} />
        <Stack.Screen name="Language"            component={LanguageScreen} />
        <Stack.Screen name="NotificationPrefs"   component={NotificationPreferencesScreen} />
        <Stack.Screen name="ChildrenSchools"      component={ChildrenSchoolsScreen} />
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
