/**
 * ========================================================
 * Task Utility Functions
 *
 * This module provides utility functions for managing tasks:
 * - Task status management (pending, completed, overdue)
 * - Task scheduling and time calculations
 * - Task filtering and sorting
 *
 * The utility functions handle task status updates based on time
 * and provide helper functions for task management throughout the app.
 * ========================================================
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

// ========================================================
// Constants and Types
// ========================================================

// Define the Philippines time zone
export const PHILIPPINES_TIMEZONE = "Asia/Manila";

// Task status constants
export const TASK_STATUS = {
  INCOMPLETE: "INCOMPLETE",
  COMPLETE: "COMPLETE",
  OVERDUE: "OVERDUE",
};

// Task interface
export interface Task {
  taskId: string;
  taskName: string;
  taskStatus: string;
  taskTime: string;
  repeatDay: string[]; // Array of day names
  created_at?: string; // Make optional for backward compatibility
  updated_at?: string; // Make optional for backward compatibility
}

// ========================================================
// Storage Functions
// ========================================================

/**
 * Save tasks to AsyncStorage
 * @param tasks - Array of tasks to save
 */
export const saveTasks = async (tasks: Task[]): Promise<void> => {
  try {
    await AsyncStorage.setItem("tasks", JSON.stringify(tasks));
  } catch (error) {
    console.error("Error saving tasks:", error);
  }
};

/**
 * Load tasks from AsyncStorage
 * @returns Array of tasks or empty array if none found
 */
export const loadTasks = async (): Promise<Task[]> => {
  try {
    const tasksJson = await AsyncStorage.getItem("tasks");
    const tasks = tasksJson ? JSON.parse(tasksJson) : [];
    
    // Convert old format to new format and handle status values
    return tasks.map((task: any) => {
      // Convert old format to new format
      if (task.id && !task.taskId) {
        const daysArray = task.days ? JSON.parse(task.days) : [];
        const dayNames = Array.isArray(daysArray) 
          ? daysArray.map((day: string | number) => 
              typeof day === 'number' ? dayNumberToName(day) : day
            )
          : [];
          
        return {
          taskId: task.id,
          taskName: task.task || "",
          taskStatus: task.status || TASK_STATUS.INCOMPLETE,
          taskTime: task.time || "",
          repeatDay: dayNames,
          created_at: task.created_at,
          updated_at: task.updated_at
        };
      }
      
      // Already in new format, just normalize status if needed
      let taskStatus = task.taskStatus || task.status;
      if (taskStatus === "incomplete" || taskStatus === "pending" || taskStatus === "started") {
        taskStatus = TASK_STATUS.INCOMPLETE;
      } else if (taskStatus === "complete" || taskStatus === "completed") {
        taskStatus = TASK_STATUS.COMPLETE;
      } else if (taskStatus === "overdue") {
        taskStatus = TASK_STATUS.OVERDUE;
      }
      
      return {
        ...task,
        taskStatus: taskStatus
      };
    });
  } catch (error) {
    console.error("Error loading tasks:", error);
    return [];
  }
};

// ========================================================
// Task CRUD Operations
// ========================================================

/**
 * Add a new task
 * @param task - Task object to add
 * @returns Updated array of tasks
 */
export const addTask = async (
  task: Omit<Task, "taskId" | "created_at" | "updated_at">
): Promise<Task[]> => {
  // Get current time in Philippines time zone
  const now = new Date();
  const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);

  const newTask: Task = {
    taskId: Date.now().toString(),
    ...task,
    created_at: philippinesNow.toISOString(),
    updated_at: philippinesNow.toISOString(),
  };

  const tasks = await loadTasks();
  const updatedTasks = [...tasks, newTask];
  await saveTasks(updatedTasks);
  
  // Log task creation with formatted day names
  try {
    const formattedDays = newTask.repeatDay.join(', ');
    const time = formatTaskTime(newTask.taskTime);
    appLog(LogCategory.TASK_CREATE, `Created task "${newTask.taskName}" (${formattedDays} at ${time})`);
  } catch (error) {
    appLog(LogCategory.TASK_CREATE, `Created task "${newTask.taskName}"`);
  }
  
  return updatedTasks;
};

/**
 * Update a task
 * @param taskId - ID of the task to update
 * @param updates - Object with updates to apply
 * @returns Updated array of tasks
 */
export const updateTask = async (
  taskId: string,
  updates: Partial<Task>
): Promise<Task[]> => {
  const tasks = await loadTasks();
  const now = new Date();
  const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
  
  const taskIndex = tasks.findIndex(task => task.taskId === taskId);
  
  if (taskIndex === -1) {
    appLog(LogCategory.ERROR, `Task not found for update: ${taskId}`);
    return tasks;
  }
  
  // Get the old task before updating for logging
  const oldTask = tasks[taskIndex];
  
  // Apply updates
  const updatedTask = {
    ...tasks[taskIndex],
    ...updates,
    updated_at: philippinesNow.toISOString(),
  };
  
  const updatedTasks = [
    ...tasks.slice(0, taskIndex),
    updatedTask,
    ...tasks.slice(taskIndex + 1),
  ];
  
  await saveTasks(updatedTasks);
  
  // Log status changes specifically
  if (updates.taskStatus && oldTask.taskStatus !== updates.taskStatus) {
    appLog(LogCategory.TASK_STATUS, `Task "${oldTask.taskName}" status changed: ${oldTask.taskStatus} → ${updates.taskStatus}`);
  }
  
  // Log general updates
  if (Object.keys(updates).length > 0) {
    const updateTypes = Object.keys(updates).join(', ');
    appLog(LogCategory.TASK_UPDATE, `Updated task "${oldTask.taskName}" (changed: ${updateTypes})`);
  }
  
  return updatedTasks;
};

/**
 * Delete a task
 * @param taskId - ID of the task to delete
 * @returns Updated array of tasks
 */
export const deleteTask = async (taskId: string): Promise<Task[]> => {
  const tasks = await loadTasks();
  const taskToDelete = tasks.find(task => task.taskId === taskId);
  
  const updatedTasks = tasks.filter((task) => task.taskId !== taskId);
  await saveTasks(updatedTasks);
  
  if (taskToDelete) {
    appLog(LogCategory.TASK_DELETE, `Deleted task "${taskToDelete.taskName}"`);
  } else {
    appLog(LogCategory.ERROR, `Attempted to delete non-existent task (ID: ${taskId})`);
  }
  
  return updatedTasks;
};

// ========================================================
// Status Management Functions
// ========================================================

/**
 * Update task statuses based on current time
 * @returns Updated array of tasks
 */
export const updateTaskStatuses = async (): Promise<Task[]> => {
  try {
    const tasks = await loadTasks();
    const now = new Date();
    const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
    const today = format(philippinesNow, 'EEEE');
    const todayNumber = philippinesNow.getDay() + 1; // 1-7 where 1 is Sunday
    
    appLog(LogCategory.TASK_STATUS, `Starting status update check at ${format(philippinesNow, 'yyyy-MM-dd HH:mm:ss')}`);
    appLog(LogCategory.INFO, `Today is ${today} (day ${todayNumber})`);
    
    // Track status changes for logging
    const statusChanges: Record<string, {from: string, to: string}> = {};
    let tasksChecked = 0;
    
    // Batch update tasks to minimize re-renders and AsyncStorage operations
    const updatedTasks = tasks.map(task => {
      tasksChecked++;
      const oldStatus = task.taskStatus;
      
      // Skip completed tasks - they should stay completed
      if (task.taskStatus === TASK_STATUS.COMPLETE) {
        return task;
      }
      
      // Make sure we have a valid time
      if (!task.taskTime) {
        if (task.taskStatus !== TASK_STATUS.INCOMPLETE) {
          statusChanges[task.taskId] = {from: task.taskStatus, to: TASK_STATUS.INCOMPLETE};
        }
        return { ...task, taskStatus: TASK_STATUS.INCOMPLETE };
      }
      
      // Parse task time and days
      const taskTime = parseISO(task.taskTime);
      // Use the repeatDay array directly
      const taskDaysRaw = task.repeatDay || [];
      
      // Check if task is scheduled for today
      const isToday = taskDaysRaw.some((day: string | number) => {
        if (typeof day === 'string') {
          return day === today || day === todayNumber.toString();
        } else if (typeof day === 'number') {
          return day === todayNumber;
        }
        return false;
      });
      
      if (!isToday) {
        // If task is not scheduled for today, set to incomplete
        if (task.taskStatus !== TASK_STATUS.INCOMPLETE) {
          statusChanges[task.taskId] = {from: task.taskStatus, to: TASK_STATUS.INCOMPLETE};
        }
        return { ...task, taskStatus: TASK_STATUS.INCOMPLETE };
      }
      
      // Get hours and minutes from task time and current time
      const taskHours = taskTime.getHours();
      const taskMinutes = taskTime.getMinutes();
      const nowHours = philippinesNow.getHours();
      const nowMinutes = philippinesNow.getMinutes();
      
      // Convert to total minutes for easier comparison
      const taskTotalMinutes = taskHours * 60 + taskMinutes;
      const nowTotalMinutes = nowHours * 60 + nowMinutes;
      
      // Only log detailed time info for tasks scheduled for today
      appLog(
        LogCategory.INFO, 
        `Task "${task.taskName}" scheduled for ${taskHours}:${taskMinutes.toString().padStart(2, '0')} ` + 
        `(${Math.floor((taskTotalMinutes - nowTotalMinutes) / 60)}h ${(taskTotalMinutes - nowTotalMinutes) % 60}m ${nowTotalMinutes >= taskTotalMinutes ? 'ago' : 'from now'})`
      );
      
      // Check if it's 15 minutes before task time
      const isStarted = 
        nowTotalMinutes >= taskTotalMinutes - 15 && 
        nowTotalMinutes < taskTotalMinutes;
      

        console.log("Task total minutes: ",taskTotalMinutes);
        
      // Check if task is overdue (time has passed by at least 3 minutes)
      const isOverdue = nowTotalMinutes >= taskTotalMinutes + 3; // Added 3 minutes grace period

      console.log("Overdue: ",isOverdue);
      
      
      let newStatus;
      
      if (isOverdue) {
        newStatus = TASK_STATUS.OVERDUE;
      } else if (isStarted) {
        newStatus = TASK_STATUS.INCOMPLETE; // Changed from COMPLETE to INCOMPLETE for tasks that have started
      } else {
        newStatus = TASK_STATUS.INCOMPLETE;
      }
      
      // Track status changes for logging
      if (task.taskStatus !== newStatus) {
        statusChanges[task.taskId] = {from: task.taskStatus, to: newStatus};
      }
      
      return { ...task, taskStatus: newStatus };
    });
    
    // Log status changes
    const changeCount = Object.keys(statusChanges).length;
    if (changeCount > 0) {
      appLog(LogCategory.TASK_STATUS, `Updated ${changeCount}/${tasksChecked} task statuses`);
      Object.entries(statusChanges).forEach(([taskId, {from, to}]) => {
        const task = tasks.find(t => t.taskId === taskId);
        appLog(LogCategory.TASK_UPDATE, `Task "${task?.taskName}" status changed: ${from} → ${to}`);
      });
    } else {
      appLog(LogCategory.TASK_STATUS, `No status changes needed (checked ${tasksChecked} tasks)`);
    }
    
    // Save updated tasks to AsyncStorage only if there were changes
    if (changeCount > 0) {
      await saveTasks(updatedTasks);
    }
    
    return updatedTasks;
  } catch (error) {
    appLog(LogCategory.ERROR, 'Error updating task statuses:', error);
    return await loadTasks(); // Return current tasks if there was an error
  }
};

/**
 * Check if a completed task should be reset to incomplete
 * @param taskId - The ID of the task to check
 * @returns Whether the task was reset
 */
export const checkAndResetCompletedTask = async (
  taskId: string
): Promise<boolean> => {
  try {
    const tasks = await loadTasks();
    const task = tasks.find(t => t.taskId === taskId);
    
    if (!task || task.taskStatus !== TASK_STATUS.COMPLETE) {
      return false;
    }
    
    // Check if task is scheduled for today
    const now = new Date();
    const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
    const today = format(philippinesNow, 'EEEE');
    const taskDays = task.repeatDay || [];
    
    if (!taskDays.includes(today)) {
      return false;
    }
    
    // Check if it's a new day since the task was completed
    const completedDate = new Date(task.updated_at || '');
    const completedDay = completedDate.getDate();
    const currentDay = philippinesNow.getDate();
    
    if (completedDay !== currentDay) {
      // Reset task to incomplete
      await updateTask(taskId, { 
        taskStatus: TASK_STATUS.INCOMPLETE,
        updated_at: philippinesNow.toISOString()
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking completed task:', error);
    return false;
  }
};

// ========================================================
// Task Utility Functions
// ========================================================

/**
 * Check if a task is scheduled for today
 * @param task - The task to check
 * @returns Whether the task is scheduled for today
 */
export const isTaskActiveToday = (task: Task): boolean => {
  try {
    const now = new Date();
    const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
    
    // Get today's day as both name and number
    const todayName = format(philippinesNow, 'EEEE');
    const todayNumber = philippinesNow.getDay() + 1; // getDay returns 0-6, we need 1-7
    
    // Use repeatDay array directly
    const taskDays = task.repeatDay || [];
    
    // Check if today's day is included in task days (supporting both formats)
    return taskDays.some((day: string | number) => {
      if (typeof day === 'string') {
        // If day is a string, compare directly or convert day number to name
        return day === todayName || day === todayNumber.toString();
      } else if (typeof day === 'number') {
        // If day is a number, compare with today's number
        return day === todayNumber;
      }
      return false;
    });
  } catch (error) {
    console.error('Error checking if task is active today:', error);
    return false;
  }
};

/**
 * Format a task time for display
 * @param timeString - ISO string time to format
 * @returns Formatted time string
 */
export const formatTaskTime = (timeString: string): string => {
  try {
    if (!timeString) return 'No time set';
    const date = parseISO(timeString);
    return formatInTimeZone(date, PHILIPPINES_TIMEZONE, 'h:mm a');
  } catch (error) {
    console.error('Error formatting task time:', error);
    return 'Invalid time';
  }
};

/**
 * Get tasks filtered by status
 * @param tasks - Array of tasks to filter
 * @param status - Status to filter by
 * @returns Filtered array of tasks
 */
export const getTasksByStatus = (tasks: Task[], status: string): Task[] => {
  if (status === 'all') {
    return tasks;
  }
  return tasks.filter(task => task.taskStatus === status);
};

// ========================================================
// Day Conversion Utilities
// ========================================================

/**
 * Convert day name to day number (1-7, with 1 being Sunday)
 * @param dayName - Name of the day to convert
 * @returns Day number (1-7)
 */
export const dayNameToNumber = (dayName: string): number => {
  const dayMap: Record<string, number> = {
    Sunday: 1,
    Monday: 2,
    Tuesday: 3,
    Wednesday: 4,
    Thursday: 5,
    Friday: 6,
    Saturday: 7
  };
  return dayMap[dayName] || 0;
};

/**
 * Convert day number (1-7, with 1 being Sunday) to day name
 * @param dayNumber - Number of the day to convert (1-7)
 * @returns Day name
 */
export const dayNumberToName = (dayNumber: number): string => {
  const dayMap: Record<number, string> = {
    1: "Sunday",
    2: "Monday",
    3: "Tuesday",
    4: "Wednesday",
    5: "Thursday",
    6: "Friday",
    7: "Saturday"
  };
  return dayMap[dayNumber] || "";
};

// ========================================================
// Logging Utility
// ========================================================

// Log categories with emoji prefixes for better visibility
export const LogCategory = {
  TASK_STATUS: "🔄 [STATUS]",
  TASK_UPDATE: "✏️ [UPDATE]",
  TASK_CREATE: "➕ [CREATE]",
  TASK_DELETE: "❌ [DELETE]",
  NOTIFICATION: "🔔 [NOTIFY]",
  ERROR: "❗ [ERROR]",
  INFO: "ℹ️ [INFO]"
};

/**
 * Enhanced logging function to add categories and better formatting
 * @param category - Log category prefix 
 * @param message - Main log message
 * @param data - Optional data to log
 */
export const appLog = (
  category: string,
  message: string,
  data?: any
): void => {
  if (data) {
    console.log(`${category} ${message}`, data);
  } else {
    console.log(`${category} ${message}`);
  }
};
