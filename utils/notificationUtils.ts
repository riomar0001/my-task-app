/**
 * Notification Utility Functions - Manages notification permissions, scheduling, and history
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogCategory, appLog } from './taskUtils';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => {
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

// Notification interface
export interface NotificationRecord {
  id: string;
  taskId: string;
  title: string;
  body: string;
  type: 'task_upcoming' | 'task_start' | 'task_overdue';
  timestamp: string;
  read: boolean;
}

// Storage keys
const DELIVERED_NOTIFICATIONS_KEY = 'delivered_notifications';
const NOTIFICATION_HISTORY_KEY = 'notification_history';

/**
 * Check if a notification has already been delivered
 */
export const hasNotificationBeenDelivered = async (
  taskId: string,
  type: 'task_upcoming' | 'task_start' | 'task_overdue'
): Promise<boolean> => {
  try {
    const deliveredJson = await AsyncStorage.getItem(DELIVERED_NOTIFICATIONS_KEY);
    if (!deliveredJson) return false;
    
    const delivered: Record<string, string[]> = JSON.parse(deliveredJson);
    return delivered[taskId]?.includes(type) || false;
  } catch (error) {
    appLog(LogCategory.ERROR, 'Failed to check delivered notification', error);
    return false;
  }
};

/**
 * Mark a notification as delivered
 */
export const markNotificationAsDelivered = async (
  taskId: string,
  type: 'task_upcoming' | 'task_start' | 'task_overdue'
): Promise<void> => {
  try {
    const deliveredJson = await AsyncStorage.getItem(DELIVERED_NOTIFICATIONS_KEY);
    const delivered: Record<string, string[]> = deliveredJson 
      ? JSON.parse(deliveredJson) 
      : {};
    
    // Initialize array for this task if it doesn't exist
    if (!delivered[taskId]) {
      delivered[taskId] = [];
    }
    
    // Add this notification type if it's not already there
    if (!delivered[taskId].includes(type)) {
      delivered[taskId].push(type);
      await AsyncStorage.setItem(DELIVERED_NOTIFICATIONS_KEY, JSON.stringify(delivered));
    }
  } catch (error) {
    appLog(LogCategory.ERROR, 'Failed to mark notification as delivered', error);
  }
};

/**
 * Clear delivered notifications for a task
 */
export const clearDeliveredNotifications = async (taskId: string): Promise<void> => {
  try {
    const deliveredJson = await AsyncStorage.getItem(DELIVERED_NOTIFICATIONS_KEY);
    if (!deliveredJson) return;
    
    const delivered: Record<string, string[]> = JSON.parse(deliveredJson);
    
    // Remove this task's delivered notifications
    if (delivered[taskId]) {
      delete delivered[taskId];
      await AsyncStorage.setItem(DELIVERED_NOTIFICATIONS_KEY, JSON.stringify(delivered));
    }
  } catch (error) {
    appLog(LogCategory.ERROR, 'Failed to clear delivered notifications', error);
  }
};

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // If we don't have permission yet, ask for it
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  } catch (error) {
    appLog(LogCategory.ERROR, 'Failed to request notification permissions', error);
    return false;
  }
};

/**
 * Generate a unique notification ID
 */
export const generateUniqueNotificationId = (
  prefix: string,
  taskId: string
): string => {
  return `${prefix}_${taskId}_${Date.now()}`;
};

/**
 * Save a notification to history
 */
export const saveNotificationToHistory = async (
  notification: NotificationRecord
): Promise<void> => {
  try {
    const historyJson = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    const history: NotificationRecord[] = historyJson 
      ? JSON.parse(historyJson) 
      : [];
    
    // Add the new notification to history
    history.push(notification);
    
    // Save updated history
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    appLog(LogCategory.ERROR, 'Failed to save notification to history', error);
  }
};

/**
 * Load notification history
 */
export const loadNotificationHistory = async (): Promise<NotificationRecord[]> => {
  try {
    const historyJson = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (error) {
    appLog(LogCategory.ERROR, 'Failed to load notification history', error);
    return [];
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const historyJson = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    if (!historyJson) return;
    
    const history: NotificationRecord[] = JSON.parse(historyJson);
    
    // Find and update the notification
    const updatedHistory = history.map(notification => {
      if (notification.id === notificationId) {
        return { ...notification, read: true };
      }
      return notification;
    });
    
    // Save updated history
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    appLog(LogCategory.ERROR, 'Failed to mark notification as read', error);
  }
};

/**
 * Clear all notification history
 */
export const clearAllNotificationHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
  } catch (error) {
    appLog(LogCategory.ERROR, 'Failed to clear notification history', error);
  }
};

/**
 * Cancel all notifications for a task
 */
export const cancelTaskNotifications = async (taskId: string): Promise<void> => {
  try {
    // Get all scheduled notifications
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    // Filter notifications for this task
    const taskNotifications = scheduledNotifications.filter(notification => {
      const data = notification.content.data;
      return data && data.taskId === taskId;
    });
    
    // Cancel each notification
    for (const notification of taskNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
    
    // Clear delivered notifications for this task
    await clearDeliveredNotifications(taskId);
  } catch (error) {
    appLog(LogCategory.ERROR, 'Failed to cancel task notifications', error);
  }
};

/**
 * Set up notification listeners
 * @param onNotificationReceived - Callback for when notification is received
 * @param onNotificationResponse - Callback for when user responds to notification
 * @returns Cleanup function to remove listeners
 */
export const setupNotificationListeners = (
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationResponse: (response: Notifications.NotificationResponse) => void
): () => void => {
  // Set up notification received listener
  const receivedSubscription = Notifications.addNotificationReceivedListener(onNotificationReceived);
  
  // Set up notification response listener
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);
  
  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
};

/**
 * Cancel a specific notification type for a task
 * @param taskId - ID of the task
 * @param type - Type of notification to cancel
 */
export const cancelSpecificNotification = async (
  taskId: string,
  type: 'task_upcoming' | 'task_start' | 'task_overdue'
): Promise<void> => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      const data = notification.content.data;
      if (data && data.taskId === taskId && data.type === type) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    appLog(LogCategory.ERROR, `Failed to cancel ${type} notification for task ${taskId}`, error);
  }
}; 