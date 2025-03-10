/**
 * ========================================================
 * Notification Scheduler Utilities
 *
 * This module provides utilities for scheduling notifications:
 * - Scheduling task notifications at specific times
 * - Handling notification delivery
 * - Managing notification history
 *
 * The utilities use Expo Notifications to schedule and deliver
 * notifications for tasks based on their scheduled times.
 * ========================================================
 */

import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import {
  Task,
  PHILIPPINES_TIMEZONE,
  checkAndResetCompletedTask,
  dayNumberToName,
  LogCategory,
  appLog,
  loadTasks
} from "./taskUtils";
import {
  clearDeliveredNotifications,
  cancelSpecificNotification,
  generateUniqueNotificationId,
} from "./notificationUtils";

// Store notification IDs by task and type
interface NotificationTracker {
  [taskId: string]: {
    upcoming: { [weekday: number]: string };
    start: { [weekday: number]: string };
    overdue: { [weekday: number]: string };
  };
}

// Keep track of scheduled notification IDs
const scheduledNotifications: NotificationTracker = {};

/**
 * Schedule all notifications for a task
 * @param task - Task to schedule notifications for
 */
export const scheduleAllNotificationTasks = async (
  task: Task
): Promise<void> => {
  // First, cancel any existing notifications for this task
  await cancelAllNotificationTasks(task.id);

  // Clear delivered notifications tracking for this task to allow new notifications
  await clearDeliveredNotifications(task.id);

  // Convert task time to Philippines time zone
  const taskTime = toZonedTime(parseISO(task.time), PHILIPPINES_TIMEZONE);
  const now = toZonedTime(new Date(), PHILIPPINES_TIMEZONE);

  // Extract hour and minute for weekly triggers
  const hour = taskTime.getHours();
  const minute = taskTime.getMinutes();

  // Parse the task days (expected to be numeric 1-7 with 1=Sunday according to Expo format)
  const taskDays = JSON.parse(task.days) as number[];

  // Format time for display in notifications
  const formattedTime = formatInTimeZone(
    taskTime,
    PHILIPPINES_TIMEZONE,
    "h:mm a"
  );

  // Initialize notification tracking for this task
  if (!scheduledNotifications[task.id]) {
    scheduledNotifications[task.id] = {
      upcoming: {},
      start: {},
      overdue: {},
    };
  }

  appLog(LogCategory.NOTIFICATION, `Scheduling notifications for task "${task.task}" (ID: ${task.id})`);
  
  // Create a human-readable days list for logging
  const dayNames = taskDays.map(day => dayNumberToName(day)).join(', ');
  appLog(LogCategory.INFO, `Task scheduled for ${dayNames} at ${formattedTime}`);

  // Schedule notifications for each selected day
  for (const weekday of taskDays) {
    const dayName = dayNumberToName(weekday);
    appLog(LogCategory.NOTIFICATION, `Setting up ${dayName} notifications at ${formattedTime}`);
    
    // Schedule upcoming notification (3 minutes before task)
    const upcomingId = generateUniqueNotificationId(`upcoming-${weekday}`, task.id);
    
    // Schedule a weekly notification using the WEEKLY trigger
    const upcomingNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Upcoming Task",
        body: `Your task "${task.task}" will start in 3 minutes (${formattedTime})`,
        sound: true,
        priority: 'high',
        vibrate: [0, 250, 250, 250],
        badge: 1,
        data: {
          taskId: task.id,
          type: "task_upcoming",
          notificationId: upcomingId,
          // Include data needed for history record
          title: "Upcoming Task",
          body: `Your task "${task.task}" will start in 3 minutes (${formattedTime})`,
          weekday: weekday,
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: weekday, // Day of week (1-7, where 1 is Sunday)
        hour: hour > 0 ? hour : 23,  // If hour is 0, set to 23 (previous day)
        minute: minute > 3 ? minute - 3 : minute + 57, // 3 minutes before task time
      },
    });
    
    // Store the notification ID
    scheduledNotifications[task.id].upcoming[weekday] = upcomingNotificationId;
    appLog(LogCategory.NOTIFICATION, `Reminder scheduled for ${dayName}, 3 minutes before ${formattedTime}`);
    
    // Schedule start notification (at task time)
    const startId = generateUniqueNotificationId(`start-${weekday}`, task.id);
    
    const startNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Task Started",
        body: `It's time to start your task: ${task.task} (${formattedTime})`,
        sound: true,
        priority: 'high',
        vibrate: [0, 250, 250, 250],
        badge: 1,
        data: {
          taskId: task.id,
          type: "task_start",
          notificationId: startId,
          // Include data needed for history record
          title: "Task Started",
          body: `It's time to start your task: ${task.task} (${formattedTime})`,
          weekday: weekday,
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: weekday, // Day of week (1-7, where 1 is Sunday)
        hour: hour,
        minute: minute,
      },
    });
    
    // Store the notification ID
    scheduledNotifications[task.id].start[weekday] = startNotificationId;
    appLog(LogCategory.NOTIFICATION, `Start alert scheduled for ${dayName} at ${formattedTime}`);
    
    // Schedule overdue notification (3 minutes after task time)
    const overdueId = generateUniqueNotificationId(`overdue-${weekday}`, task.id);
    
    const overdueNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Task Overdue",
        body: `Your task "${task.task}" is now overdue (${formattedTime})`,
        sound: true,
        priority: 'high',
        vibrate: [0, 250, 250, 250],
        badge: 1,
        data: {
          taskId: task.id,
          type: "task_overdue",
          notificationId: overdueId,
          // Include data needed for history record
          title: "Task Overdue",
          body: `Your task "${task.task}" is now overdue (${formattedTime})`,
          weekday: weekday,
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: weekday, // Day of week (1-7, where 1 is Sunday)
        hour: (hour + Math.floor((minute + 3) / 60)) % 24, // Handle overflow to next hour
        minute: (minute + 3) % 60, // 3 minutes after task time
      },
    });
    
    // Store the notification ID
    scheduledNotifications[task.id].overdue[weekday] = overdueNotificationId;
    appLog(LogCategory.NOTIFICATION, `Overdue alert scheduled for ${dayName}, 3 minutes after ${formattedTime}`);
  }
  
  appLog(LogCategory.NOTIFICATION, `✅ All notifications set for task "${task.task}"`);
};

/**
 * Cancel all notifications for a task
 * @param taskId - ID of the task to cancel notifications for
 */
export const cancelAllNotificationTasks = async (
  taskId: string
): Promise<void> => {
  const task = (await loadTasks()).find(t => t.id === taskId);
  const taskName = task ? task.task : "unknown";
  
  appLog(LogCategory.NOTIFICATION, `Cancelling notifications for task "${taskName}" (ID: ${taskId})`);
  
  // Cancel any scheduled notifications for this task using stored IDs
  if (scheduledNotifications[taskId]) {
    let cancelCount = 0;
    
    // Cancel upcoming notifications
    for (const weekday in scheduledNotifications[taskId].upcoming) {
      const notificationId = scheduledNotifications[taskId].upcoming[weekday];
      const dayName = dayNumberToName(parseInt(weekday));
      
      if (notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          cancelCount++;
          appLog(LogCategory.NOTIFICATION, `Cancelled reminder for ${dayName}`);
        } catch (error) {
          appLog(LogCategory.ERROR, `Failed to cancel reminder for ${dayName}`, error);
        }
      }
    }
    
    // Cancel start notifications
    for (const weekday in scheduledNotifications[taskId].start) {
      const notificationId = scheduledNotifications[taskId].start[weekday];
      const dayName = dayNumberToName(parseInt(weekday));
      
      if (notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          cancelCount++;
          appLog(LogCategory.NOTIFICATION, `Cancelled start alert for ${dayName}`);
        } catch (error) {
          appLog(LogCategory.ERROR, `Failed to cancel start alert for ${dayName}`, error);
        }
      }
    }
    
    // Cancel overdue notifications
    for (const weekday in scheduledNotifications[taskId].overdue) {
      const notificationId = scheduledNotifications[taskId].overdue[weekday];
      const dayName = dayNumberToName(parseInt(weekday));
      
      if (notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          cancelCount++;
          appLog(LogCategory.NOTIFICATION, `Cancelled overdue alert for ${dayName}`);
        } catch (error) {
          appLog(LogCategory.ERROR, `Failed to cancel overdue alert for ${dayName}`, error);
        }
      }
    }
    
    // Clear the stored notification IDs for this task
    delete scheduledNotifications[taskId];
    appLog(LogCategory.NOTIFICATION, `Removed ${cancelCount} notification records`);
  } else {
    appLog(LogCategory.INFO, `No notification records found for this task`);
  }
  
  // As a backup, also check for any notifications we might have missed
  const allScheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();

  let backupCancelCount = 0;
  for (const notification of allScheduledNotifications) {
    if (notification.content.data?.taskId === taskId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          notification.identifier
        );
        backupCancelCount++;
      } catch (error) {
        appLog(LogCategory.ERROR, `Failed to cancel additional notification`, error);
      }
    }
  }
  
  if (backupCancelCount > 0) {
    appLog(LogCategory.NOTIFICATION, `Cleaned up ${backupCancelCount} additional notifications`);
  }

  // Clear delivered notifications tracking for this task
  await clearDeliveredNotifications(taskId);
  
  appLog(LogCategory.NOTIFICATION, `✅ Notification cleanup complete for task "${taskName}"`);
};
