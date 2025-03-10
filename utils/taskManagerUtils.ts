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

  console.log("Scheduling notifications for task:", task.id);
  console.log("Task days:", taskDays);
  console.log("Task hour:", hour, "minute:", minute);

  // Schedule notifications for each selected day
  for (const weekday of taskDays) {
    // Schedule upcoming notification (3 minutes before task)
    const upcomingId = generateUniqueNotificationId(`upcoming-${weekday}`, task.id);
    
    // Schedule a weekly notification using the WEEKLY trigger
    const upcomingNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Upcoming Task",
        body: `Your task "${task.task}" will start in 3 minutes (${formattedTime})`,
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
    
    // Schedule start notification (at task time)
    const startId = generateUniqueNotificationId(`start-${weekday}`, task.id);
    
    const startNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Task Started",
        body: `It's time to start your task: ${task.task} (${formattedTime})`,
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
    
    // Schedule overdue notification (3 minutes after task time)
    const overdueId = generateUniqueNotificationId(`overdue-${weekday}`, task.id);
    
    const overdueNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Task Overdue",
        body: `Your task "${task.task}" is now overdue (${formattedTime})`,
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
    
    console.log(`Scheduled weekly notifications for task ${task.id} on day ${weekday}`);
  }
  
  console.log(`Finished scheduling all notifications for task ${task.id}`);
};

/**
 * Cancel all notifications for a task
 * @param taskId - ID of the task to cancel notifications for
 */
export const cancelAllNotificationTasks = async (
  taskId: string
): Promise<void> => {
  console.log(`Cancelling all notifications for task ${taskId}`);
  
  // Cancel any scheduled notifications for this task using stored IDs
  if (scheduledNotifications[taskId]) {
    // Cancel upcoming notifications
    for (const weekday in scheduledNotifications[taskId].upcoming) {
      const notificationId = scheduledNotifications[taskId].upcoming[weekday];
      if (notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          console.log(`Cancelled upcoming notification for day ${weekday}:`, notificationId);
        } catch (error) {
          console.error(`Error cancelling upcoming notification for day ${weekday}:`, error);
        }
      }
    }
    
    // Cancel start notifications
    for (const weekday in scheduledNotifications[taskId].start) {
      const notificationId = scheduledNotifications[taskId].start[weekday];
      if (notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          console.log(`Cancelled start notification for day ${weekday}:`, notificationId);
        } catch (error) {
          console.error(`Error cancelling start notification for day ${weekday}:`, error);
        }
      }
    }
    
    // Cancel overdue notifications
    for (const weekday in scheduledNotifications[taskId].overdue) {
      const notificationId = scheduledNotifications[taskId].overdue[weekday];
      if (notificationId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
          console.log(`Cancelled overdue notification for day ${weekday}:`, notificationId);
        } catch (error) {
          console.error(`Error cancelling overdue notification for day ${weekday}:`, error);
        }
      }
    }
    
    // Clear the stored notification IDs for this task
    delete scheduledNotifications[taskId];
  }
  
  // As a backup, also check for any notifications we might have missed
  const allScheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of allScheduledNotifications) {
    if (notification.content.data?.taskId === taskId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          notification.identifier
        );
        console.log("Cancelled additional notification:", notification.identifier);
      } catch (error) {
        console.error("Error cancelling additional notification:", error);
      }
    }
  }

  // Clear delivered notifications tracking for this task
  await clearDeliveredNotifications(taskId);
  
  console.log(`Finished cancelling all notifications for task ${taskId}`);
};
