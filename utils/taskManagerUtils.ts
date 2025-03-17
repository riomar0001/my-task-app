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
  TASK_STATUS,
  PHILIPPINES_TIMEZONE,
  checkAndResetCompletedTask,
  dayNumberToName,
  dayNameToNumber,
  LogCategory,
  appLog,
  loadTasks
} from "./taskUtils";
import {
  clearDeliveredNotifications,
  cancelSpecificNotification,
  generateUniqueNotificationId,
  cancelTaskNotifications
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
  try {
    // Skip scheduling for completed tasks
    if (task.taskStatus === TASK_STATUS.COMPLETE) {
      appLog(LogCategory.INFO, `Skipping notifications for completed task: ${task.taskName}`);
      return;
    }

    // Cancel any existing notifications for this task
    await cancelTaskNotifications(task.taskId);

    // Initialize notification tracker for this task
    if (!scheduledNotifications[task.taskId]) {
      scheduledNotifications[task.taskId] = {
        upcoming: {},
        start: {},
        overdue: {},
      };
    }

    // Parse task time
    const taskTime = parseISO(task.taskTime);
    const taskTimeInPH = toZonedTime(taskTime, PHILIPPINES_TIMEZONE);
    const hours = taskTimeInPH.getHours();
    const minutes = taskTimeInPH.getMinutes();

    // Schedule notifications for each day the task repeats
    for (const dayName of task.repeatDay) {
      const weekday = dayNameToNumber(dayName);
      if (weekday === 0) continue; // Skip invalid days

      // Schedule "upcoming" notification (15 minutes before task time)
      await scheduleTaskNotification(
        task,
        "task_upcoming",
        weekday,
        hours,
        minutes,
        -15 // 15 minutes before
      );

      // Schedule "start" notification (at task time)
      await scheduleTaskNotification(
        task,
        "task_start",
        weekday,
        hours,
        minutes,
        0 // At task time
      );

      // Schedule "overdue" notification (15 minutes after task time)
      await scheduleTaskNotification(
        task,
        "task_overdue",
        weekday,
        hours,
        minutes,
        15 // 15 minutes after
      );
    }
  } catch (error) {
    appLog(LogCategory.ERROR, `Failed to schedule notifications for task: ${task.taskName}`, error);
  }
};

/**
 * Schedule a single task notification
 */
const scheduleTaskNotification = async (
  task: Task,
  type: "task_upcoming" | "task_start" | "task_overdue",
  weekday: number,
  hours: number,
  minutes: number,
  minuteOffset: number
): Promise<void> => {
  try {
    // Calculate adjusted time with offset
    let adjustedHours = hours;
    let adjustedMinutes = minutes + minuteOffset;

    // Handle minute overflow/underflow
    if (adjustedMinutes >= 60) {
      adjustedHours += Math.floor(adjustedMinutes / 60);
      adjustedMinutes %= 60;
    } else if (adjustedMinutes < 0) {
      const hourOffset = Math.ceil(Math.abs(adjustedMinutes) / 60);
      adjustedHours -= hourOffset;
      adjustedMinutes = 60 + (adjustedMinutes % 60);
    }

    // Handle hour overflow/underflow
    if (adjustedHours >= 24) {
      adjustedHours %= 24;
      // Note: This doesn't adjust the weekday, which could be an issue for notifications
      // scheduled near midnight. A more complex solution would be needed for that.
    } else if (adjustedHours < 0) {
      adjustedHours = 24 + (adjustedHours % 24);
      // Same note about weekday adjustment applies here
    }

    // Create notification content
    const notificationContent = createNotificationContent(task, type);

    // Create weekly trigger
    const trigger = {
      type: SchedulableTriggerInputTypes.WEEKLY,
      channelId: "default",
      weekday,
      hour: adjustedHours,
      minute: adjustedMinutes,
    };

    // Generate a unique ID for this notification
    const notificationId = generateUniqueNotificationId(type, task.taskId);

    // Schedule the notification
    const scheduledNotificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger,
    });

    // Store the notification ID for later reference
    if (type === "task_upcoming") {
      scheduledNotifications[task.taskId].upcoming[weekday] = scheduledNotificationId;
    } else if (type === "task_start") {
      scheduledNotifications[task.taskId].start[weekday] = scheduledNotificationId;
    } else if (type === "task_overdue") {
      scheduledNotifications[task.taskId].overdue[weekday] = scheduledNotificationId;
    }

    appLog(
      LogCategory.NOTIFICATION,
      `Scheduled ${type} notification for task "${task.taskName}" on weekday ${weekday} at ${adjustedHours}:${adjustedMinutes.toString().padStart(2, "0")}`
    );
  } catch (error) {
    appLog(LogCategory.ERROR, `Failed to schedule ${type} notification for task: ${task.taskName}`, error);
  }
};

/**
 * Create notification content based on task and notification type
 */
const createNotificationContent = (
  task: Task,
  type: "task_upcoming" | "task_start" | "task_overdue"
) => {
  let title = "";
  let body = "";

  // Format task time for display
  const taskTime = parseISO(task.taskTime);
  const formattedTime = formatInTimeZone(taskTime, PHILIPPINES_TIMEZONE, "h:mm a");

  // Create notification content based on type
  switch (type) {
    case "task_upcoming":
      title = `Upcoming Task: ${task.taskName}`;
      body = `Your task "${task.taskName}" is scheduled for ${formattedTime} (in 15 minutes)`;
      break;
    case "task_start":
      title = `Task Starting: ${task.taskName}`;
      body = `It's time to start your task "${task.taskName}"`;
      break;
    case "task_overdue":
      title = `Task Overdue: ${task.taskName}`;
      body = `Your task "${task.taskName}" scheduled for ${formattedTime} is now overdue`;
      break;
  }

  // Create the notification content
  return {
    title,
    body,
    data: {
      taskId: task.taskId,
      notificationId: generateUniqueNotificationId(type, task.taskId),
      title,
      body,
      type,
    },
    sound: true,
  };
};

/**
 * Cancel all notifications for a task
 * @param taskId - ID of the task to cancel notifications for
 */
export const cancelAllNotificationTasks = async (
  taskId: string
): Promise<void> => {
  try {
    await cancelTaskNotifications(taskId);
    
    // Clear from our tracking object
    if (scheduledNotifications[taskId]) {
      delete scheduledNotifications[taskId];
    }
  } catch (error) {
    appLog(LogCategory.ERROR, `Failed to cancel all notifications for task: ${taskId}`, error);
  }
};
