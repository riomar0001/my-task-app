/**
 * Root Layout - Entry point for the app that handles font loading,
 * notification setup, and theme configuration.
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import {
  requestNotificationPermissions,
  saveNotificationToHistory,
  generateUniqueNotificationId
} from '@/utils/notificationUtils';
import { loadTasks, LogCategory, appLog } from '@/utils/taskUtils';
import { scheduleAllNotificationTasks } from '@/utils/taskManagerUtils';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Set up notifications
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupApp = async () => {
      // Configure notification settings for Android
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      
      // Request notification permissions
      const permissionResult = await requestNotificationPermissions();
      appLog(LogCategory.INFO, `Notification permission granted: ${permissionResult}`);
      
      // Set up notification received listener to add to history when delivered
      const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;
        
        // Add to notification history if it has the required data
        if (data && data.taskId && data.title && data.body && data.type) {
          const historyRecord = {
            id: data.notificationId as string || generateUniqueNotificationId('history', data.taskId as string),
            taskId: data.taskId as string,
            title: data.title as string,
            body: data.body as string,
            type: data.type as 'task_upcoming' | 'task_start' | 'task_overdue',
            timestamp: new Date().toISOString(),
            read: false,
          };
          
          saveNotificationToHistory(historyRecord)
            .catch(err => appLog(LogCategory.ERROR, `Failed to save notification to history`, err));
        }
      });
      
      // Set up notification response listener
      const responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {
        appLog(LogCategory.NOTIFICATION, `User responded to notification`);
        // Additional handling can be added here when needed
      });
      
      // Schedule existing tasks' notifications at app startup
      try {
        const tasks = await loadTasks();
        appLog(LogCategory.INFO, `App startup: scheduling notifications for ${tasks.length} existing tasks`);
        
        for (const task of tasks) {
          await scheduleAllNotificationTasks(task);
        }
      } catch (error) {
        appLog(LogCategory.ERROR, `Failed to schedule notifications for existing tasks`, error);
      }
      
      // Return cleanup function
      return () => {
        receivedSubscription.remove();
        responseSubscription.remove();
      };
    };

    // Run setup and store cleanup function
    setupApp().then(cleanupFn => {
      cleanup = cleanupFn;
    }).catch(error => {
      console.error('Error setting up notifications:', error);
    });

    // Cleanup function for useEffect
    return () => {
      if (cleanup) {
        cleanup();
      }
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
    </Stack>
  );
}
