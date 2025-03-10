/**
 * ========================================================
 * Notification Utility Functions
 * 
 * This module provides utility functions for managing notifications:
 * - Requesting notification permissions
 * - Scheduling task notifications
 * - Handling notification responses
 * - Storing notification history
 * 
 * The utility functions use Expo's notification API to schedule
 * and manage notifications for tasks based on their scheduled times.
 * ========================================================
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Storage key for delivered notifications
const DELIVERED_NOTIFICATIONS_KEY = 'delivered_notifications';

/**
 * Check if a notification has already been delivered
 * @param taskId - ID of the task
 * @param type - Type of notification
 * @returns Boolean indicating if the notification has been delivered
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
    console.error('Error checking delivered notification:', error);
    return false;
  }
};

/**
 * Mark a notification as delivered
 * @param taskId - ID of the task
 * @param type - Type of notification
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
      console.log(`Marked notification as delivered: ${type} for task ${taskId}`);
    }
  } catch (error) {
    console.error('Error marking notification as delivered:', error);
  }
};

/**
 * Clear delivered notifications for a task
 * @param taskId - ID of the task
 */
export const clearDeliveredNotifications = async (taskId: string): Promise<void> => {
  try {
    const deliveredJson = await AsyncStorage.getItem(DELIVERED_NOTIFICATIONS_KEY);
    if (!deliveredJson) return;
    
    const delivered: Record<string, string[]> = JSON.parse(deliveredJson);
    if (delivered[taskId]) {
      delete delivered[taskId];
      await AsyncStorage.setItem(DELIVERED_NOTIFICATIONS_KEY, JSON.stringify(delivered));
      console.log(`Cleared delivered notifications for task ${taskId}`);
    }
  } catch (error) {
    console.error('Error clearing delivered notifications:', error);
  }
};

/**
 * Request notification permissions
 * @returns Boolean indicating if permissions were granted
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  // Only ask if permissions have not already been determined
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  // Return true if permission was granted
  return finalStatus === 'granted';
};

/**
 * Cancel all notifications for a task
 * @param taskId - ID of the task to cancel notifications for
 */
export const cancelTaskNotifications = async (taskId: string): Promise<void> => {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  
  for (const notification of scheduledNotifications) {
    if (notification.content.data?.taskId === taskId) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      console.log(`Cancelled notification ${notification.identifier} for task ${taskId}`);
    }
  }
};

/**
 * Save notification to history
 * @param notification - Notification record to save
 */
export const saveNotificationToHistory = async (notification: NotificationRecord): Promise<void> => {
  try {
    const notificationsJson = await AsyncStorage.getItem('notifications');
    const notifications: NotificationRecord[] = notificationsJson 
      ? JSON.parse(notificationsJson) 
      : [];
    
    // Check if this notification already exists in history
    // We consider a notification duplicate if it has the same taskId and type
    // and was created within the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const isDuplicate = notifications.some(existingNotification => 
      existingNotification.taskId === notification.taskId && 
      existingNotification.type === notification.type &&
      existingNotification.timestamp > fiveMinutesAgo
    );
    
    // Only add if it's not a duplicate
    if (!isDuplicate) {
      notifications.push(notification);
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
      console.log(`Saved notification to history: ${notification.type} for task ${notification.taskId}`);
    } else {
      console.log(`Skipped duplicate notification: ${notification.type} for task ${notification.taskId}`);
    }
  } catch (error) {
    console.error('Error saving notification to history:', error);
  }
};

/**
 * Load notification history
 * @returns Array of notification records
 */
export const loadNotificationHistory = async (): Promise<NotificationRecord[]> => {
  try {
    const notificationsJson = await AsyncStorage.getItem('notifications');
    return notificationsJson ? JSON.parse(notificationsJson) : [];
  } catch (error) {
    console.error('Error loading notification history:', error);
    return [];
  }
};

/**
 * Mark notification as read
 * @param notificationId - ID of the notification to mark as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notifications = await loadNotificationHistory();
    const updatedNotifications = notifications.map(notification => {
      if (notification.id === notificationId) {
        return { ...notification, read: true };
      }
      return notification;
    });
    
    await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
  } catch (error) {
    console.error('Error marking notification as read:', error);
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
        console.log(`Cancelled ${type} notification for task ${taskId}`);
      }
    }
  } catch (error) {
    console.error(`Error cancelling ${type} notification for task ${taskId}:`, error);
  }
};

/**
 * Generate a unique notification ID
 * @param prefix - Prefix for the ID (e.g., 'upcoming', 'start', 'overdue')
 * @param taskId - ID of the task
 * @returns Unique notification ID
 */
export const generateUniqueNotificationId = (
  prefix: string,
  taskId: string
): string => {
  return `${prefix}_${taskId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
};

/**
 * Clear all notifications from history
 */
export const clearAllNotificationHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem('notifications', JSON.stringify([]));
    console.log('Cleared all notifications from history');
  } catch (error) {
    console.error('Error clearing notification history:', error);
  }
}; 