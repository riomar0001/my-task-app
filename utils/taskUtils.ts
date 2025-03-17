/**
 * Task Utility Functions - Provides functionality for managing tasks, 
 * including status management, task scheduling, and time calculations.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  format,
  parseISO,
  isAfter,
  isBefore,
  addMinutes,
  differenceInMinutes,
} from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

// Constants and Types
export const PHILIPPINES_TIMEZONE = "Asia/Manila";

export const TASK_STATUS = {
  INCOMPLETE: "INCOMPLETE",
  COMPLETE: "COMPLETE",
  OVERDUE: "OVERDUE",
};

export const LogCategory = {
  INFO: "INFO",
  ERROR: "ERROR",
  NOTIFICATION: "NOTIFICATION",
  TASK: "TASK",
  DEBUG: "DEBUG",
};

// Task interface
export interface Task {
  taskId: string;
  taskName: string;
  taskStatus: string;
  taskTime: string;
  repeatDay: string[]; // Array of day names
  created_at?: string;
  updated_at?: string;
}

// Storage key for tasks
const TASKS_STORAGE_KEY = "tasks";

/**
 * Save tasks to AsyncStorage
 */
export const saveTasks = async (tasks: Task[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    appLog(LogCategory.ERROR, "Failed to save tasks", error);
    throw error;
  }
};

/**
 * Load tasks from AsyncStorage
 */
export const loadTasks = async (): Promise<Task[]> => {
  try {
    const tasksJson = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
    if (tasksJson) {
      return JSON.parse(tasksJson);
    }
    return [];
  } catch (error) {
    appLog(LogCategory.ERROR, "Failed to load tasks", error);
    return [];
  }
};

/**
 * Add a new task
 */
export const addTask = async (
  task: Omit<Task, "taskId" | "created_at" | "updated_at">
): Promise<Task[]> => {
  try {
    const existingTasks = await loadTasks();
    
    const newTask: Task = {
      ...task,
      taskId: Date.now().toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    const updatedTasks = [...existingTasks, newTask];
    await saveTasks(updatedTasks);
    
    return updatedTasks;
  } catch (error) {
    appLog(LogCategory.ERROR, "Failed to add task", error);
    throw error;
  }
};

/**
 * Update an existing task
 */
export const updateTask = async (
  taskId: string,
  updates: Partial<Task>
): Promise<Task[]> => {
  try {
    const tasks = await loadTasks();
    
    const updatedTasks = tasks.map((task) => {
      if (task.taskId === taskId) {
        return {
          ...task,
          ...updates,
          updated_at: new Date().toISOString(),
        };
      }
      return task;
    });
    
    await saveTasks(updatedTasks);
    return updatedTasks;
  } catch (error) {
    appLog(LogCategory.ERROR, "Failed to update task", error);
    throw error;
  }
};

/**
 * Delete a task
 */
export const deleteTask = async (taskId: string): Promise<Task[]> => {
  try {
    const tasks = await loadTasks();
    const filteredTasks = tasks.filter((task) => task.taskId !== taskId);
    
    await saveTasks(filteredTasks);
    return filteredTasks;
  } catch (error) {
    appLog(LogCategory.ERROR, "Failed to delete task", error);
    throw error;
  }
};

/**
 * Update statuses of all tasks based on their scheduled times
 */
export const updateTaskStatuses = async (): Promise<Task[]> => {
  try {
    const tasks = await loadTasks();
    const now = new Date();
    const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
    const currentDayName = dayNumberToName(philippinesNow.getDay() + 1);
    
    let updatedTasks = [...tasks];
    let tasksChanged = false;
    
    updatedTasks = updatedTasks.map((task) => {
      // Only check tasks scheduled for today
      if (!task.repeatDay.includes(currentDayName)) {
        return task;
      }
      
      const taskTime = parseISO(task.taskTime);
      const taskDateTime = toZonedTime(taskTime, PHILIPPINES_TIMEZONE);
      
      // Set hours/minutes from the task time, but use today's date
      const scheduledToday = new Date(philippinesNow);
      scheduledToday.setHours(taskDateTime.getHours());
      scheduledToday.setMinutes(taskDateTime.getMinutes());
      scheduledToday.setSeconds(0);
      scheduledToday.setMilliseconds(0);
      
      // Calculate time threshold (15 minutes after scheduled time)
      const overdueThreshold = addMinutes(scheduledToday, 15);
      
      // Check if the task should be marked as overdue
      if (
        task.taskStatus === TASK_STATUS.INCOMPLETE &&
        isAfter(philippinesNow, overdueThreshold)
      ) {
        tasksChanged = true;
        return {
          ...task,
          taskStatus: TASK_STATUS.OVERDUE,
          updated_at: now.toISOString(),
        };
      }
      
      return task;
    });
    
    // Save changes if any task was updated
    if (tasksChanged) {
      await saveTasks(updatedTasks);
    }
    
    return updatedTasks;
  } catch (error) {
    appLog(LogCategory.ERROR, "Failed to update task statuses", error);
    return await loadTasks();
  }
};

/**
 * Check if a completed task needs to be reset for the next occurrence
 */
export const checkAndResetCompletedTask = async (
  taskId: string
): Promise<boolean> => {
  try {
    const tasks = await loadTasks();
    const taskIndex = tasks.findIndex((t) => t.taskId === taskId);
    
    if (taskIndex === -1) {
      return false;
    }
    
    const task = tasks[taskIndex];
    
    // Only process completed tasks
    if (task.taskStatus !== TASK_STATUS.COMPLETE) {
      return false;
    }
    
    const now = new Date();
    const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
    const currentDayName = dayNumberToName(philippinesNow.getDay() + 1);
    
    // If the task repeats on the current day, check if we need to reset it
    if (task.repeatDay.includes(currentDayName)) {
      const taskTime = parseISO(task.taskTime);
      const taskTimeInPH = toZonedTime(taskTime, PHILIPPINES_TIMEZONE);
      
      // Create a date for today's scheduled time
      const todayScheduledTime = new Date(philippinesNow);
      todayScheduledTime.setHours(taskTimeInPH.getHours());
      todayScheduledTime.setMinutes(taskTimeInPH.getMinutes());
      todayScheduledTime.setSeconds(0);
      todayScheduledTime.setMilliseconds(0);
      
      // If the current time is after the scheduled time, the task should have already been completed
      // for today, so don't reset it
      if (isAfter(philippinesNow, todayScheduledTime)) {
        return false;
      }
      
      // Reset the task to incomplete
      tasks[taskIndex] = {
        ...task,
        taskStatus: TASK_STATUS.INCOMPLETE,
        updated_at: now.toISOString(),
      };
      
      await saveTasks(tasks);
      return true;
    }
    
    return false;
  } catch (error) {
    appLog(LogCategory.ERROR, "Failed to check and reset completed task", error);
    return false;
  }
};

/**
 * Check if a task is active on the current day
 */
export const isTaskActiveToday = (task: Task): boolean => {
  const now = new Date();
  const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
  const currentDayName = dayNumberToName(philippinesNow.getDay() + 1);
  
  return task.repeatDay.includes(currentDayName);
};

/**
 * Format task time for display
 */
export const formatTaskTime = (timeString: string): string => {
  try {
    const date = parseISO(timeString);
    return formatInTimeZone(date, PHILIPPINES_TIMEZONE, "h:mm a");
  } catch (error) {
    appLog(LogCategory.ERROR, "Failed to format task time", error);
    return "Invalid time";
  }
};

/**
 * Get tasks filtered by status
 */
export const getTasksByStatus = (tasks: Task[], status: string): Task[] => {
  if (status === "all") {
    return tasks;
  }
  return tasks.filter((task) => task.taskStatus === status);
};

/**
 * Convert day name to number (1-7, with 1 being Sunday)
 */
export const dayNameToNumber = (dayName: string): number => {
  const dayMap: Record<string, number> = {
    Sunday: 1,
    Monday: 2,
    Tuesday: 3,
    Wednesday: 4,
    Thursday: 5,
    Friday: 6,
    Saturday: 7,
  };
  
  return dayMap[dayName] || 0;
};

/**
 * Convert day number to name (1-7, with 1 being Sunday)
 */
export const dayNumberToName = (dayNumber: number): string => {
  const dayMap: Record<number, string> = {
    1: "Sunday",
    2: "Monday",
    3: "Tuesday",
    4: "Wednesday",
    5: "Thursday",
    6: "Friday",
    7: "Saturday",
  };
  
  return dayMap[dayNumber] || "";
};

/**
 * Application logging
 */
export const appLog = (
  category: string,
  message: string,
  data?: any
): void => {
  if (__DEV__) {
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const logPrefix = `[${timestamp}] [${category}]`;
    
    console.log(`${logPrefix} ${message}`);
    if (data) {
      console.log(data);
    }
  }
};
