/**
 * Add Task Screen - Provides a form for creating new tasks and scheduling notifications
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { router } from 'expo-router';

import TaskForm from '@/components/TaskForm';
import { addTask, LogCategory, appLog } from '@/utils/taskUtils';
import { requestNotificationPermissions } from '@/utils/notificationUtils';
import { scheduleAllNotificationTasks } from '@/utils/taskManagerUtils';

export default function AddTaskScreen() {
  // Handle task submission
  const handleSubmitTask = useCallback(async (task: {
    taskName: string;
    taskStatus: string;
    taskTime: string;
    repeatDay: string[];
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
      
      // Show success message
      Alert.alert(
        'Task Added',
        'Your task has been added successfully and notifications have been scheduled.',
        [
          {
            text: 'OK',
            onPress: () => router.navigate('/(tabs)' as any),
          },
        ]
      );
    } catch (error) {
      appLog(LogCategory.ERROR, 'Error adding task', error);
      Alert.alert('Error', 'There was an error adding your task. Please try again.');
    }
  }, []);
  
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