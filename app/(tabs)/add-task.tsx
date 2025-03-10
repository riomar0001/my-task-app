/**
 * ========================================================
 * Add Task Screen
 * 
 * This screen provides a form for creating new tasks with:
 * - Task name input
 * - Time picker for scheduling
 * - Day selection for recurring tasks
 * 
 * The screen handles task creation and scheduling notifications
 * for the new task.
 * ========================================================
 */

import React from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { router } from 'expo-router';

import TaskForm from '@/components/TaskForm';
import { addTask } from '@/utils/taskUtils';
import { requestNotificationPermissions } from '@/utils/notificationUtils';
import { scheduleAllNotificationTasks } from '@/utils/taskManagerUtils';
// import { scheduleBackgroundTaskUpdateStatuses } from '@/utils/backgroundTaskUtils';

export default function AddTaskScreen() {
  // Handle task submission
  const handleSubmitTask = async (task: {
    task: string;
    status: string;
    time: string;
    days: string;
  }) => {
    try {
      // Request notification permissions
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Notification Permission Required',
          'Please enable notifications to receive task reminders.'
        );
        return;
      }

      // Add the task to storage
      const updatedTasks = await addTask(task);
      
      // Get the newly added task (last in the array)
      const newTask = updatedTasks[updatedTasks.length - 1];
      
      // Schedule all notifications for the task
      await scheduleAllNotificationTasks(newTask);
      
      // Ensure background task is scheduled for updating task statuses
      // await scheduleBackgroundTaskUpdateStatuses();
      
      // Show success message
      Alert.alert(
        'Task Added',
        'Your task has been added successfully and notifications have been scheduled.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to the tasks screen
              router.navigate('/(tabs)' as any);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error adding task:', error);
      Alert.alert('Error', 'There was an error adding your task. Please try again.');
    }
  };
  
  return (
    <View style={styles.container}>
      <TaskForm onSubmit={handleSubmitTask} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
}); 