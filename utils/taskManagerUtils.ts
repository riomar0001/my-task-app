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
import { parseISO} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { Task, PHILIPPINES_TIMEZONE, checkAndResetCompletedTask } from "./taskUtils";
import {  
  clearDeliveredNotifications, 
  cancelSpecificNotification,
  generateUniqueNotificationId
} from "./notificationUtils";

// Store notification IDs by task and type
interface NotificationTracker {
  [taskId: string]: {
    upcoming?: string;
    start?: string;
    overdue?: string;
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

  // Calculate times for notifications
  const upcomingTime = new Date(taskTime.getTime() - 3 * 60 * 1000); // 3 minutes before
  const startTime = taskTime;
  const overdueTime = new Date(taskTime.getTime() + 3 * 60 * 1000); // 3 minutes after

  console.log("Scheduling notifications for task:", task.id);
  console.log(
    "Task time:",
    formatInTimeZone(taskTime, PHILIPPINES_TIMEZONE, "yyyy-MM-dd HH:mm:ss")
  );
  console.log(
    "Current time:",
    formatInTimeZone(now, PHILIPPINES_TIMEZONE, "yyyy-MM-dd HH:mm:ss")
  );

  // Format time for display in notifications
  const formattedTime = formatInTimeZone(
    taskTime,
    PHILIPPINES_TIMEZONE,
    "h:mm a"
  );

  // Initialize notification tracking for this task
  if (!scheduledNotifications[task.id]) {
    scheduledNotifications[task.id] = {};
  }

  // Only schedule upcoming notification if it's in the future
  if (upcomingTime > now) {
    console.log("Scheduling upcoming notification for:", formatInTimeZone(upcomingTime, PHILIPPINES_TIMEZONE, "yyyy-MM-dd HH:mm:ss"));
    
    // Create a unique ID for this notification
    const upcomingId = generateUniqueNotificationId('upcoming', task.id);
    
    // Schedule the notification with a date trigger
    const notificationId = await Notifications.scheduleNotificationAsync({
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
          timestamp: upcomingTime.toISOString(),
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.floor((upcomingTime.getTime() - now.getTime()) / 1000)),
        repeats: false
      },
    });
    
    // Store the notification ID
    scheduledNotifications[task.id].upcoming = notificationId;
    
    // Set up a timer to check if the task should be reset from completed to pending
    // We do this check right before the upcoming notification is due
    const timeUntilUpcoming = upcomingTime.getTime() - now.getTime();
    setTimeout(async () => {
      // Check if the task should be reset from completed to pending
      // This will now only reset the task if it's exactly 3 minutes before start time
      const wasReset = await checkAndResetCompletedTask(task.id);
      
      if (wasReset) {
        console.log(`Task ${task.id} was reset from completed to pending. Proceeding with notifications.`);
        // Clear delivered notifications tracking for this task to allow notifications to be delivered again
        await clearDeliveredNotifications(task.id);
      }
    }, Math.max(0, timeUntilUpcoming - 5000)); // 5 seconds before the upcoming notification
    
    console.log(`Upcoming notification scheduled to fire in ${timeUntilUpcoming / 1000} seconds`);
  }

  // Only schedule start notification if it's in the future
  if (startTime > now) {
    console.log(
      "Scheduling start notification for:",
      formatInTimeZone(startTime, PHILIPPINES_TIMEZONE, "yyyy-MM-dd HH:mm:ss")
    );
    
    // Create a unique ID for this notification
    const startId = generateUniqueNotificationId('start', task.id);
    
    // Schedule the notification with a date trigger
    const notificationId = await Notifications.scheduleNotificationAsync({
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
          timestamp: startTime.toISOString(),
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.floor((startTime.getTime() - now.getTime()) / 1000)),
        repeats: false
      },
    });
    
    // Store the notification ID
    scheduledNotifications[task.id].start = notificationId;
    
    // Set up a timer to cancel the upcoming notification when the task starts
    const timeUntilStart = startTime.getTime() - now.getTime();
    setTimeout(async () => {
      // Cancel the upcoming notification if it exists
      await cancelSpecificNotification(task.id, 'task_upcoming');
      console.log(`Cancelled upcoming notification for task ${task.id} as it has started`);
    }, timeUntilStart + 1000); // Add 1 second buffer
    
    console.log(`Start notification scheduled to fire in ${timeUntilStart / 1000} seconds`);
  }

  // Only schedule overdue notification if it's in the future
  if (overdueTime > now) {
    console.log(
      "Scheduling overdue notification for:",
      formatInTimeZone(overdueTime, PHILIPPINES_TIMEZONE, "yyyy-MM-dd HH:mm:ss")
    );
    
    // Create a unique ID for this notification
    const overdueId = generateUniqueNotificationId('overdue', task.id);
    
    // Schedule the notification with a date trigger
    const notificationId = await Notifications.scheduleNotificationAsync({
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
          timestamp: overdueTime.toISOString(),
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.floor((overdueTime.getTime() - now.getTime()) / 1000)),
        repeats: false
      },
    });
    
    // Store the notification ID
    scheduledNotifications[task.id].overdue = notificationId;
    
    // Set up a timer to cancel the upcoming and start notifications when the task is overdue
    const timeUntilOverdue = overdueTime.getTime() - now.getTime();
    setTimeout(async () => {
      // Cancel the upcoming notification if it exists
      await cancelSpecificNotification(task.id, 'task_upcoming');
      console.log(`Cancelled upcoming notification for task ${task.id} as it is overdue`);
      
      // Cancel the start notification if it exists
      await cancelSpecificNotification(task.id, 'task_start');
      console.log(`Cancelled start notification for task ${task.id} as it is overdue`);
    }, timeUntilOverdue + 1000); // Add 1 second buffer
    
    console.log(`Overdue notification scheduled to fire in ${timeUntilOverdue / 1000} seconds`);
  }
};

/**
 * Cancel all notifications for a task
 * @param taskId - ID of the task to cancel notifications for
 */
export const cancelAllNotificationTasks = async (
  taskId: string
): Promise<void> => {
  // Cancel any scheduled notifications for this task
  const allScheduledNotifications =
    await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of allScheduledNotifications) {
    if (notification.content.data?.taskId === taskId) {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
      console.log("Cancelled notification:", notification.identifier);
    }
  }
  
  // Clear the stored notification IDs for this task
  if (scheduledNotifications[taskId]) {
    delete scheduledNotifications[taskId];
  }
  
  // Clear delivered notifications tracking for this task
  await clearDeliveredNotifications(taskId);
};
