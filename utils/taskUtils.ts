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
  PENDING: "pending",
  STARTED: "started",
  COMPLETED: "completed",
  OVERDUE: "overdue",
};

// Task interface
export interface Task {
  id: string;
  task: string;
  status: string;
  time: string;
  days: string; // JSON string of days array
  created_at: string;
  updated_at: string;
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
    return tasksJson ? JSON.parse(tasksJson) : [];
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
  task: Omit<Task, "id" | "created_at" | "updated_at">
): Promise<Task[]> => {
  // Get current time in Philippines time zone
  const now = new Date();
  const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);

  const newTask: Task = {
    id: Date.now().toString(),
    ...task,
    created_at: philippinesNow.toISOString(),
    updated_at: philippinesNow.toISOString(),
  };

  const tasks = await loadTasks();
  const updatedTasks = [...tasks, newTask];
  await saveTasks(updatedTasks);
  return updatedTasks;
};

/**
 * Update a task
 * @param taskId - ID of the task to update
 * @param updates - Object containing fields to update
 * @returns Updated array of tasks
 */
export const updateTask = async (
  taskId: string,
  updates: Partial<Task>
): Promise<Task[]> => {
  // Get current time in Philippines time zone
  const now = new Date();
  const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);

  const tasks = await loadTasks();
  const updatedTasks = tasks.map((task) => {
    if (task.id === taskId) {
      return {
        ...task,
        ...updates,
        updated_at: philippinesNow.toISOString(),
      };
    }
    return task;
  });

  await saveTasks(updatedTasks);
  return updatedTasks;
};

/**
 * Delete a task
 * @param taskId - ID of the task to delete
 * @returns Updated array of tasks
 */
export const deleteTask = async (taskId: string): Promise<Task[]> => {
  const tasks = await loadTasks();
  const updatedTasks = tasks.filter((task) => task.id !== taskId);
  await saveTasks(updatedTasks);
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
    
    // Batch update tasks to minimize re-renders and AsyncStorage operations
    const updatedTasks = tasks.map(task => {
      // Skip completed tasks - they should stay completed
      if (task.status === TASK_STATUS.COMPLETED) {
        return task;
      }
      
      // Make sure we have a valid time
      if (!task.time) {
        return { ...task, status: TASK_STATUS.PENDING };
      }
      
      // Parse task time and days
      const taskTime = parseISO(task.time);
      const taskDays = JSON.parse(task.days) as string[];
      const today = format(philippinesNow, 'EEEE');
      
      // Check if task is scheduled for today
      const isToday = taskDays.includes(today);
      
      if (!isToday) {
        // If task is not scheduled for today, set to pending
        return { ...task, status: TASK_STATUS.PENDING };
      }
      
      // Get hours and minutes from task time and current time
      const taskHours = taskTime.getHours();
      const taskMinutes = taskTime.getMinutes();
      const nowHours = philippinesNow.getHours();
      const nowMinutes = philippinesNow.getMinutes();
      
      // Convert to total minutes for easier comparison
      const taskTotalMinutes = taskHours * 60 + taskMinutes;
      const nowTotalMinutes = nowHours * 60 + nowMinutes;
      
      // Check if it's 15 minutes before task time
      const isStarted = 
        nowTotalMinutes >= taskTotalMinutes - 15 && 
        nowTotalMinutes < taskTotalMinutes;
      
      // Check if task is overdue
      const isOverdue = nowTotalMinutes > taskTotalMinutes;
      
      if (isOverdue) {
        return { ...task, status: TASK_STATUS.OVERDUE };
      } else if (isStarted) {
        return { ...task, status: TASK_STATUS.STARTED };
      } else {
        return { ...task, status: TASK_STATUS.PENDING };
      }
    });
    
    // Save updated tasks to AsyncStorage only if there were changes
    if (JSON.stringify(tasks) !== JSON.stringify(updatedTasks)) {
      await saveTasks(updatedTasks);
    }
    
    return updatedTasks;
  } catch (error) {
    console.error('Error updating task statuses:', error);
    return await loadTasks();
  }
};

/**
 * Check if a completed task should be reset to pending
 * @param taskId - The ID of the task to check
 * @returns Whether the task was reset
 */
export const checkAndResetCompletedTask = async (
  taskId: string
): Promise<boolean> => {
  try {
    const tasks = await loadTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task || task.status !== TASK_STATUS.COMPLETED) {
      return false;
    }
    
    // Check if task is scheduled for today
    const now = new Date();
    const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
    const today = format(philippinesNow, 'EEEE');
    const taskDays = JSON.parse(task.days) as string[];
    
    if (!taskDays.includes(today)) {
      return false;
    }
    
    // Check if it's a new day since the task was completed
    const completedDate = new Date(task.updated_at);
    const completedDay = completedDate.getDate();
    const currentDay = philippinesNow.getDate();
    
    if (completedDay !== currentDay) {
      // Reset task to pending
      await updateTask(taskId, { 
        status: TASK_STATUS.PENDING,
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
    const today = format(philippinesNow, 'EEEE');
    const taskDays = JSON.parse(task.days) as string[];
    
    return taskDays.includes(today);
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
  return tasks.filter(task => task.status === status);
};
