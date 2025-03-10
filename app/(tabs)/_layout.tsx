/**
 * ========================================================
 * Tab Navigation Layout
 * 
 * This module configures the bottom tab navigation with:
 * - Tasks tab for viewing all tasks
 * - Add Task tab for creating new tasks
 * - Notifications tab for viewing notification history
 * 
 * The tabs use Ionicons for visual representation and provide
 * a consistent navigation experience throughout the app.
 * ========================================================
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Tab layout component that defines the bottom tab navigation
 */
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <TabBarIcon name="list" color={color} />,
          headerTitle: 'My Tasks',
        }}
      />
      <Tabs.Screen
        name="add-task"
        options={{
          title: 'Add Task',
          tabBarIcon: ({ color }) => <TabBarIcon name="add-circle" color={color} />,
          headerTitle: 'Add New Task',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color }) => <TabBarIcon name="notifications" color={color} />,
          headerTitle: 'Notifications',
        }}
      />
    </Tabs>
  );
}

/**
 * Tab bar icon component
 */
function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={28} style={{ marginBottom: -3 }} {...props} />;
}
