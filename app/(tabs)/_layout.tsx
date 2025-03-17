/**
 * Tab Navigation Layout - Configures the bottom tab navigation for the app
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/**
 * Tab layout component that defines the bottom tab navigation
 */
export default function TabLayout() {
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
