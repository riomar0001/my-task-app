/**
 * Tasks Screen - Displays all tasks with filtering, completion, and deletion functionality.
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

const FILTER_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Incomplete', value: TASK_STATUS.INCOMPLETE },
  { label: 'Complete', value: TASK_STATUS.COMPLETE },
  { label: 'Overdue', value: TASK_STATUS.OVERDUE },
];

export default function TasksScreen() {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => 
      selectedFilter === 'all' || task.taskStatus === selectedFilter
    );
  }, [tasks, selectedFilter]);

  const loadAndUpdateTasks = useCallback(async () => {
    try {
      const loadedTasks = await loadTasks();
      const updatedTasks = await updateTaskStatuses();
      setTasks(updatedTasks);
    } catch (error) {
      appLog(LogCategory.ERROR, 'Failed to load and update tasks', error);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAndUpdateTasks();
    setRefreshing(false);
  }, [loadAndUpdateTasks]);

  const handleTaskComplete = useCallback(async (taskId: string) => {
    try {
      const task = tasks.find(t => t.taskId === taskId);
      if (!task) return;

      const newStatus = task.taskStatus === TASK_STATUS.COMPLETE
        ? TASK_STATUS.INCOMPLETE
        : TASK_STATUS.COMPLETE;

      const updatedTasks = await updateTask(taskId, { taskStatus: newStatus });
      setTasks(updatedTasks);

      if (newStatus === TASK_STATUS.COMPLETE) {
        await cancelTaskNotifications(taskId);
      } else {
        const task = updatedTasks.find(t => t.taskId === taskId);
        if (task) {
          await scheduleAllNotificationTasks(task);
        }
      }
    } catch (error) {
      appLog(LogCategory.ERROR, 'Failed to update task completion status', error);
    }
  }, [tasks]);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    try {
      await cancelTaskNotifications(taskId);
      const updatedTasks = await deleteTask(taskId);
      setTasks(updatedTasks);
    } catch (error) {
      appLog(LogCategory.ERROR, 'Failed to delete task', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const setupScreen = async () => {
        await requestNotificationPermissions();
        await loadAndUpdateTasks();
      };

      setupScreen();
    }, [loadAndUpdateTasks])
  );

  const renderFilterButton = useCallback(({ label, value }: { label: string, value: string }) => (
    <TouchableOpacity
      key={value}
      style={[
        styles.filterButton,
        selectedFilter === value && styles.filterButtonActive
      ]}
      onPress={() => setSelectedFilter(value)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === value && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  ), [selectedFilter]);

  const renderTask = useCallback(({ item }: { item: TaskType }) => (
    <Task
      task={item}
      onComplete={() => handleTaskComplete(item.taskId)}
      onDelete={() => handleTaskDelete(item.taskId)}
    />
  ), [handleTaskComplete, handleTaskDelete]);

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        {FILTER_OPTIONS.map(renderFilterButton)}
      </View>

      <FlatList
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={item => item.taskId}
        contentContainerStyle={styles.taskList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="list" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No tasks found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  taskList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },
});
