// /**
//  * ========================================================
//  * Background Task Utilities
//  * 
//  * This module provides utilities for managing background tasks:
//  * - Defining background tasks for notifications
//  * - Registering background tasks with Expo TaskManager
//  * - Handling task execution when app is closed
//  * 
//  * The utility functions use Expo TaskManager to ensure notifications
//  * are delivered even when the app is closed.
//  * ========================================================
//  */

// import * as TaskManager from 'expo-task-manager';
// import * as Notifications from 'expo-notifications';
// import * as BackgroundFetch from 'expo-background-fetch';
// import { updateTaskStatuses } from './taskUtils';
// import { scheduleAllNotificationTasks } from './taskManagerUtils';

// // Define task names
// export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';
// export const BACKGROUND_TASK_UPDATE_STATUSES = 'BACKGROUND_TASK_UPDATE_STATUSES';

// // Register the background notification task
// TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
//   if (error) {
//     console.error('Background notification task failed:', error);
//     return;
//   }
  
//   if (data) {
//     // Handle the notification data
//     const notification = data as { notification: Notifications.Notification };
//     console.log('Received notification in background:', notification);
//   }
// });

// // Register the background task for updating task statuses
// TaskManager.defineTask(BACKGROUND_TASK_UPDATE_STATUSES, async () => {
//   try {
//     console.log('Running background task to update task statuses');
    
//     // Update task statuses
//     const tasks = await updateTaskStatuses();
    
//     // Reschedule notifications for all tasks
//     for (const task of tasks) {
//       await scheduleAllNotificationTasks(task);
//     }
    
//     console.log('Background task completed successfully');
//     return BackgroundFetch.BackgroundFetchResult.NewData;
//   } catch (error) {
//     console.error('Background task failed:', error);
//     return BackgroundFetch.BackgroundFetchResult.Failed;
//   }
// });

// /**
//  * Register background tasks
//  * This should be called when the app starts
//  */
// export const registerBackgroundTasks = async (): Promise<void> => {
//   // Register for notification handling in background
//   await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  
//   console.log('Registered background notification task');
// };

// /**
//  * Schedule a background task to update task statuses
//  * This will run periodically even when the app is closed
//  */
// export const scheduleBackgroundTaskUpdateStatuses = async (): Promise<void> => {
//   try {
//     // Check if the task is already registered
//     const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_UPDATE_STATUSES);
    
//     if (!isTaskRegistered) {
//       // Register the background fetch task
//       await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_UPDATE_STATUSES, {
//         minimumInterval: 15 * 60, // 15 minutes in seconds
//         stopOnTerminate: false,   // Task continues to run after app is terminated
//         startOnBoot: true,        // Task runs when device restarts
//       });
      
//       console.log('Registered background task for updating task statuses');
//     } else {
//       console.log('Background task already registered');
//     }
//   } catch (error) {
//     console.error('Failed to schedule background task:', error);
//   }
// }; 