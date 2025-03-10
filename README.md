# Task Scheduler App

A React Native Expo application for scheduling and managing tasks with notifications.

## Features

- **Task Management**: Create, complete, and delete tasks
- **Task Scheduling**: Schedule tasks with specific times and days
- **Status Tracking**: Automatically track task status (pending, completed, overdue)
- **Notifications**: Receive notifications when tasks are due or overdue
- **Notification History**: View a history of all past notifications

## Technologies Used

- React Native with Expo (v52)
- TypeScript
- Expo Router for navigation
- AsyncStorage for local data persistence
- Expo Notifications for local notifications
- date-fns for date manipulation

## Project Structure

```
project-root/
├── app/                        # Main directory for Expo Router
│   ├── _layout.tsx             # Root layout component
│   ├── (tabs)/                 # Tab navigation group
│   │   ├── _layout.tsx         # Tab navigator configuration
│   │   ├── index.tsx           # Tasks screen
│   │   ├── add-task.tsx        # Add task screen
│   │   └── notifications.tsx   # Notifications screen
│
├── components/                 # Reusable components
│   ├── Task.tsx                # Task component
│   ├── TaskForm.tsx            # Task form component
│   └── NotificationItem.tsx    # Notification item component
│
├── utils/                      # Utility functions
│   ├── taskUtils.ts            # Task-related utilities
│   └── notificationUtils.ts    # Notification-related utilities
│
├── constants/                  # App constants
│   └── Colors.ts               # Color definitions
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm start
   ```

## Usage

- **View Tasks**: The main screen displays all tasks with filtering options
- **Add Task**: Navigate to the Add Task tab to create a new task
- **Complete/Delete Tasks**: Use the buttons on each task to mark as complete or delete
- **View Notifications**: Navigate to the Notifications tab to view notification history

## Task Status Logic

- Tasks become **pending** when within 3 hours of their scheduled time
- Tasks become **overdue** when 3 hours past their scheduled time
- Tasks can be manually marked as **completed**

## Notifications

The app sends two types of notifications:
1. **Task Start**: When it's time to start a task
2. **Task Overdue**: When a task is 3 hours past its scheduled time

## License

MIT 