/**
 * ========================================================
 * Root Layout
 * 
 * This is the root layout component that wraps the entire app.
 * It handles:
 * - Font loading
 * - Notification setup
 * - Theme configuration
 * - Background task registration
 * 
 * This component is the entry point for the app and sets up
 * the necessary configurations for the app to function.
 * ========================================================
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  requestNotificationPermissions,
  saveNotificationToHistory,
  markNotificationAsDelivered,
  cancelSpecificNotification,
  generateUniqueNotificationId
} from '@/utils/notificationUtils';
import {
  registerBackgroundTasks,
  scheduleBackgroundTaskUpdateStatuses,
} from '@/utils/backgroundTaskUtils';
import { loadTasks } from '@/utils/taskUtils';
import { scheduleAllNotificationTasks } from '@/utils/taskManagerUtils';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Set up notifications and background tasks
  useEffect(() => {
    let cleanupFunction: (() => void) | undefined;

    const setupApp = async () => {
      // Request notification permissions
      await requestNotificationPermissions();

      // Register background tasks
      await registerBackgroundTasks();

      // Schedule background task for updating task statuses
      await scheduleBackgroundTaskUpdateStatuses();

      // Set up notification received listener to add to history when delivered
      const subscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;

        // Only add to history if it has the required data
        if (data && data.taskId && data.type && data.title && data.body && data.timestamp) {
          const taskId = data.taskId as string;
          const type = data.type as 'task_upcoming' | 'task_start' | 'task_overdue';

          // Save the notification to history when it's actually delivered
          saveNotificationToHistory({
            id: data.notificationId as string || generateUniqueNotificationId('notification', taskId),
            taskId: taskId,
            title: data.title as string,
            body: data.body as string,
            type: type,
            timestamp: data.timestamp as string,
            read: false,
          });

          // Mark this notification as delivered to prevent duplicates
          markNotificationAsDelivered(taskId, type);

          console.log(`Added notification to history: ${type} for task ${taskId}`);

          // We no longer need this specific cancellation since all notifications
          // are now cancelled after delivery in the notification handler
        }
      });

      // Set up notification response listener
      const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;

        // Handle notification response (e.g., navigate to task details)
        console.log('Notification response received:', data);
      });

      // Set up AppState change listener to reschedule notifications when app comes to foreground
      const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
        if (nextAppState === 'active') {
          console.log('App has come to the foreground, rescheduling notifications');

          // Load all tasks
          const tasks = await loadTasks();

          // Reschedule notifications for all tasks
          for (const task of tasks) {
            await scheduleAllNotificationTasks(task);
          }
        }
      });

      // Store cleanup function
      cleanupFunction = () => {
        subscription.remove();
        responseSubscription.remove();
        appStateSubscription.remove();
      };
    };

    setupApp();

    // Return cleanup function
    return () => {
      if (cleanupFunction) cleanupFunction();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, statusBarStyle: 'dark' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
