# Expo Todo App Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Data Model](#data-model)
4. [Core Components](#core-components)
5. [Utilities](#utilities)
   - [Task Utilities](#task-utilities)
   - [Notification Utilities](#notification-utilities)
   - [Task Manager Utilities](#task-manager-utilities)
6. [Screens](#screens)
7. [Notification System](#notification-system)
8. [Storage](#storage)
9. [User Flows](#user-flows)
10. [Installation and Setup](#installation-and-setup)

## Introduction

The Expo Todo App is a mobile application built with React Native and Expo that helps users manage and track their tasks. The app provides features such as task scheduling, notifications, and status tracking (incomplete, complete, overdue).

Key features include:
- Creating and managing tasks
- Scheduling tasks for specific days and times
- Receiving notifications for upcoming, current, and overdue tasks
- Viewing task history and notification history
- Marking tasks as complete or deleting them

## Project Structure

The app follows a modular structure organized by functionality:

```
expo-todo/
├── app/               # App screens and navigation (Expo Router)
│   ├── (tabs)/       # Tab-based navigation screens
│   └── _layout.tsx   # Root layout and navigation configuration
├── components/        # Reusable UI components
├── constants/         # Application constants
├── utils/             # Utility functions
├── assets/            # Images, fonts, and other static assets
└── node_modules/      # Dependencies
```

## Data Model

### Task

The primary data model in the app is the `Task` interface, defined in `utils/taskUtils.ts`:

```typescript
export interface Task {
  taskId: string;          // Unique identifier for the task
  taskName: string;        // Name/description of the task
  taskStatus: string;      // Current status: INCOMPLETE, COMPLETE, OVERDUE
  taskTime: string;        // ISO string time when task is scheduled
  repeatDay: string[];     // Array of days when task repeats (e.g., ["Monday", "Wednesday"])
  created_at?: string;     // Timestamp when task was created
  updated_at?: string;     // Timestamp when task was last updated
}
```

### Notification Record

The app also maintains records of notifications in the `NotificationRecord` interface, defined in `utils/notificationUtils.ts`:

```typescript
export interface NotificationRecord {
  id: string;             // Unique identifier for the notification
  taskId: string;         // ID of the associated task
  title: string;          // Notification title
  body: string;           // Notification message
  type: 'task_upcoming' | 'task_start' | 'task_overdue';  // Type of notification
  timestamp: string;      // When the notification was created/delivered
  read: boolean;          // Whether user has seen the notification
}
```

## Core Components

### Task Component (`components/Task.tsx`)

Displays an individual task item showing the task name, scheduled time, status, and action buttons for completing or deleting the task.

**Features:**
- Dynamic status indicator (incomplete, complete, overdue)
- Formatted time display
- Day name display
- Complete and delete buttons

### TaskForm Component (`components/TaskForm.tsx`)

Provides a form interface for creating new tasks with fields for:
- Task name
- Time selection
- Day selection (multiple days can be selected)

**Features:**
- Date/time picker
- Multiple day selection
- Form validation

### NotificationItem Component (`components/NotificationItem.tsx`)

Displays individual notification items in the notification list showing:
- Notification title and message
- Timestamp
- Read/unread status indicator

## Utilities

### Task Utilities (`utils/taskUtils.ts`)

Core functions for managing tasks:

- **CRUD Operations**
  - `addTask`: Creates a new task
  - `updateTask`: Updates an existing task
  - `deleteTask`: Removes a task
  - `loadTasks`: Retrieves all tasks from storage
  - `saveTasks`: Persists tasks to storage

- **Status Management**
  - `updateTaskStatuses`: Updates task statuses based on current time
  - `checkAndResetCompletedTask`: Resets completed tasks for recurring tasks

- **Helper Functions**
  - `isTaskActiveToday`: Checks if a task is scheduled for today
  - `formatTaskTime`: Formats task time for display
  - `getTasksByStatus`: Filters tasks by status
  - `dayNameToNumber`/`dayNumberToName`: Converts between day names and numbers

### Notification Utilities (`utils/notificationUtils.ts`)

Functions for managing the notification system:

- **Notification Management**
  - `requestNotificationPermissions`: Requests permission to show notifications
  - `setupNotificationListeners`: Sets up event listeners for notifications
  - `saveNotificationToHistory`: Saves notification to history storage
  - `loadNotificationHistory`: Loads notification history from storage
  - `markNotificationAsRead`: Marks a notification as read
  - `clearAllNotificationHistory`: Clears all notification history

- **Delivery Tracking**
  - `hasNotificationBeenDelivered`: Checks if a notification has been delivered
  - `markNotificationAsDelivered`: Marks a notification as delivered
  - `clearDeliveredNotifications`: Clears delivery tracking for a task

### Task Manager Utilities (`utils/taskManagerUtils.ts`)

Functions for scheduling and managing task notifications:

- `scheduleAllNotificationTasks`: Schedules all notifications for a task
- `cancelAllNotificationTasks`: Cancels all notifications for a task
- `generateUniqueNotificationId`: Generates unique IDs for notifications

## Screens

### Tasks Screen (`app/(tabs)/index.tsx`)

The main screen showing the task list with:
- Filter tabs for viewing all/incomplete/complete/overdue tasks
- Task list with status indicators
- Pull-to-refresh functionality

### Add Task Screen (`app/(tabs)/add-task.tsx`)

Screen for creating new tasks:
- Task form for entering task details
- Validation and submission handling

### Notifications Screen (`app/(tabs)/notifications.tsx`)

Screen showing notification history:
- List of past notifications
- Read/unread status indicators
- Mark as read functionality
- Clear all button

## Notification System

The app's notification system is structured to provide three types of notifications for each task:

1. **Upcoming Notification**: Sent 3 minutes before the scheduled task time
2. **Start Notification**: Sent at the scheduled task time
3. **Overdue Notification**: Sent 3 minutes after the scheduled task time if the task is not completed

Notifications are scheduled on a weekly basis for each day the task is set to repeat.

### Notification Flow

1. When a task is created or updated, `scheduleAllNotificationTasks` is called
2. Notifications are scheduled for each selected day of the week
3. When a notification is delivered, it's captured by the listener in `_layout.tsx`
4. The notification is saved to history via `saveNotificationToHistory`
5. Notifications appear in the Notifications screen

## Storage

The app uses AsyncStorage for persistent data storage:

- **Tasks**: Stored as JSON under the `tasks` key
- **Notifications**: Stored as JSON under the `notifications` key
- **Delivered Notifications**: Tracking of delivered notifications under `delivered_notifications`

## User Flows

### Creating a Task

1. User navigates to the Add Task screen
2. User enters task name, selects time, and selects days
3. Upon submission, the task is saved via `addTask`
4. Notifications are scheduled via `scheduleAllNotificationTasks`
5. User is redirected to the Tasks screen

### Completing a Task

1. User taps the complete button on a task
2. The task status is updated to COMPLETE via `updateTask`
3. All scheduled notifications for the task are canceled

### Task Status Updates

1. The app periodically calls `updateTaskStatuses` to update task statuses
2. Tasks are marked as overdue if the current time is 3+ minutes past the scheduled time
3. For recurring tasks, completed tasks are reset to incomplete on the next occurrence

### Notification Flow

1. User receives a notification before, at, or after the task time
2. Notification is added to notification history
3. User can view notifications in the Notifications screen
4. User can mark notifications as read or clear all notifications

## Installation and Setup

### Prerequisites

- Node.js (v12 or higher)
- npm or yarn
- Expo CLI

### Installation Steps

1. Clone the repository
   ```
   git clone <repository-url>
   cd expo-todo
   ```

2. Install dependencies
   ```
   npm install
   # or
   yarn install
   ```

3. Start the development server
   ```
   npx expo start
   ```

4. Run on a device or emulator
   - Scan the QR code with the Expo Go app (Android) or Camera app (iOS)
   - Press 'a' for Android emulator
   - Press 'i' for iOS simulator

### Building for Production

1. Configure app.json with appropriate details

2. Build for specific platforms
   ```
   npx expo build:android
   # or
   npx expo build:ios
   ```

### Environment Configuration

The app uses the Philippines timezone by default (`PHILIPPINES_TIMEZONE` constant in `utils/taskUtils.ts`). This can be modified to suit different deployment regions.
