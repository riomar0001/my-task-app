/**
 * ========================================================
 * Tasks Screen
 * 
 * This screen displays all tasks with:
 * - Filtering by status (pending, completed, overdue)
 * - Task completion functionality
 * - Task deletion functionality
 * - Status updates based on scheduled times
 * 
 * The screen manages task data and provides a user interface
 * for viewing and interacting with tasks.
 * ========================================================
 */

import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Task from '@/components/Task';
import { 
  Task as TaskType, 
  TASK_STATUS, 
  loadTasks, 
  updateTask, 
  deleteTask,
  updateTaskStatuses,
  checkAndResetCompletedTask,
  LogCategory,
  appLog
} from '@/utils/taskUtils';
import { 
  requestNotificationPermissions,
  cancelTaskNotifications
} from '@/utils/notificationUtils';
import {
  cancelAllNotificationTasks,
  scheduleAllNotificationTasks
} from '@/utils/taskManagerUtils';
// import { scheduleBackgroundTaskUpdateStatuses } from '@/utils/backgroundTaskUtils';

// Filter options for tasks - defined outside component to prevent recreation on renders
const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Incomplete', value: TASK_STATUS.INCOMPLETE },
  { label: 'Complete', value: TASK_STATUS.COMPLETE },
  { label: 'Overdue', value: TASK_STATUS.OVERDUE },
];

// Check for completed tasks that should be reset to incomplete
const checkCompletedTasks = async () => {
  try {
    const allTasks = await loadTasks();
    const completedTasks = allTasks.filter(task => task.taskStatus === TASK_STATUS.COMPLETE);
    
    // Check each completed task
    for (const task of completedTasks) {
      const wasReset = await checkAndResetCompletedTask(task.taskId);
      
      if (wasReset) {
        console.log(`Task ${task.taskId} was reset from complete to incomplete`);
        // Schedule notifications for the reset task
        await scheduleAllNotificationTasks(task);
      }
    }
  } catch (error) {
    console.error('Error checking completed tasks:', error);
  }
};

export default function TasksScreen() {
  // State for tasks and UI
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Memoize filtered tasks to prevent unnecessary recalculations
  const filteredTasks = useMemo(() => {
    if (activeFilter === 'all') {
      return tasks;
    }
    return tasks.filter(task => task.taskStatus === activeFilter);
  }, [tasks, activeFilter]);
  
  // Load tasks and set up notifications when the screen comes into focus - memoized to prevent recreation
  useFocusEffect(
    useCallback(() => {
      loadTasksAndUpdateStatuses();
      setupNotifications();
      
      
      // Set up interval to update task statuses and check completed tasks
      const intervalId = setInterval(() => {
        loadTasksAndUpdateStatuses();
        checkCompletedTasks(); // Only check completed tasks on the timer, not on every tab switch
      }, 60000); // Check every minute
      
      return () => clearInterval(intervalId);
    }, [])
  );
  
  // Load tasks and update their statuses - memoized to prevent recreation
  const loadTasksAndUpdateStatuses = useCallback(async () => {
    try {
      // Update task statuses based on current time
      const updatedTasks = await updateTaskStatuses();
      setTasks(updatedTasks);
      
      // Schedule notifications for all non-completed tasks (only once for improved performance)
      const nonCompletedTasks = updatedTasks.filter(task => task.taskStatus !== TASK_STATUS.COMPLETE);
      await Promise.all(nonCompletedTasks.map(task => scheduleAllNotificationTasks(task)));
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, []);
  
  // Set up notifications - memoized to prevent recreation
  const setupNotifications = useCallback(async () => {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Notification permissions not granted');
    }
  }, []);
  
  // Handle task completion - memoized to prevent recreation
  const handleCompleteTask = useCallback(async (taskId: string) => {
    try {
      setIsLoading(true);
      const updatedTasks = await updateTask(taskId, { taskStatus: TASK_STATUS.COMPLETE });
      setTasks(updatedTasks);
      
      // Cancel any scheduled notifications for this task
      await cancelAllNotificationTasks(taskId);
    } catch (error) {
      console.error('Error completing task:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Handle task deletion - memoized to prevent recreation
  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      // Delete the task
      const updatedTasks = await deleteTask(taskId);
      setTasks(updatedTasks);
      
      // Cancel any scheduled notifications for this task
      await cancelAllNotificationTasks(taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  }, []);
  
  // Handle pull-to-refresh - memoized to prevent recreation
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasksAndUpdateStatuses();
    setRefreshing(false);
  }, [loadTasksAndUpdateStatuses]);
  
  // Render empty state when no tasks are available - memoized to prevent recreation
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>No tasks found</Text>
      <Text style={styles.emptyStateSubtext}>
        {activeFilter === 'all' 
          ? 'Add a new task to get started' 
          : `No ${activeFilter} tasks found`}
      </Text>
    </View>
  ), [activeFilter]);
  
  // Optimize list rendering with key extractor and item rendering functions
  const keyExtractor = useCallback((item: TaskType) => item.taskId, []);
  
  const renderItem = useCallback(({ item }: { item: TaskType }) => (
    <Task
      task={item}
      onComplete={handleCompleteTask}
      onDelete={handleDeleteTask}
    />
  ), [handleCompleteTask, handleDeleteTask]);
  
  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        {FILTER_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.filterButton,
              activeFilter === option.value && styles.activeFilterButton,
            ]}
            onPress={() => setActiveFilter(option.value)}
          >
            <Text
              style={[
                styles.filterButtonText,
                activeFilter === option.value && styles.activeFilterButtonText,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Task list */}
      <FlatList
        data={filteredTasks}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
        removeClippedSubviews={true} // Optimize memory usage for long lists
        maxToRenderPerBatch={10} // Limit number of items rendered per batch
        windowSize={21} // Control the number of items rendered outside the viewport (10 screens worth in each direction plus current screen)
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  activeFilterButton: {
    backgroundColor: '#2196F3',
  },
  filterButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#333',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#757575',
    marginTop: 8,
    textAlign: 'center',
  },
});
