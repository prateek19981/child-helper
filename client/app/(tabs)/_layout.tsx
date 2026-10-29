import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgIcon } from "../../components/SvgIcon";
import { useTheme } from "../../lib/theme";
import type { svgs } from "../../lib/svgs";
import { createTabsLayoutStyles } from "../../styles/tabs/layoutStyles";

type TabStyles = ReturnType<typeof createTabsLayoutStyles>;

function TabIcon({
  name,
  focused,
  label,
  styles,
}: {
  name: keyof typeof svgs;
  focused: boolean;
  label: string;
  styles: TabStyles;
}) {
  return (
    <View style={styles.item}>
      <View style={[styles.badge, focused && styles.badgeOn]}>
        <SvgIcon name={name} width={19} height={19} />
      </View>
      <Text style={[styles.label, focused && styles.labelOn]}>{label}</Text>
    </View>
  );
}

function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createTabsLayoutStyles(theme), [theme]);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              activeOpacity={0.7}
              style={styles.tabButton}
              onPress={() => {
                const event = emitter.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigateToTab(route.key);
                }
              }}
            >
              {options.tabBarIcon?.({ focused, color: theme.colors.primary, size: 19 })}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const styles = useMemo(() => createTabsLayoutStyles(theme), [theme]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="icon_home" focused={focused} label="Home" styles={styles} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="icon_activity" focused={focused} label="Activity" styles={styles} />
          ),
        }}
      />
      <Tabs.Screen
        name="parent-hub"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="icon_parent" focused={focused} label="Parent Hub" styles={styles} />
          ),
        }}
      />
    </Tabs>
  );
}
