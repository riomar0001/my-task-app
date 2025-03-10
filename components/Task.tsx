/**
 * ========================================================
 * Task Component
 * 
 * This component renders an individual task item with:
 * - Task name and scheduled time
 * - Status indicator (pending, completed, overdue)
 * - Action buttons for completing or deleting tasks
 * 
 * The component handles task status display and user interactions
 * for managing tasks.
 * ========================================================
 */

import React, { useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Task as TaskType, TASK_STATUS, dayNumberToName } from '../utils/taskUtils';
import { MaterialIcons } from '@expo/vector-icons';

interface TaskProps {
  task: TaskType;
  onComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

const Task = ({ task, onComplete, onDelete }: TaskProps) => {
  // Parse the days array and convert numbers to day names - memoized to prevent parsing on every render
  const formattedDays = useMemo(() => {
    try {
      const daysData = JSON.parse(task.days);
      return daysData.map((day: string | number) => {
        // If day is already a string name (e.g., "Monday"), use it directly
        if (typeof day === 'string' && isNaN(parseInt(day))) {
          return day;
        }
        
        // If day is a number or string number, convert to day name
        const dayNumber = typeof day === 'string' ? parseInt(day) : day;
        if (!isNaN(dayNumber)) {
          return dayNumberToName(dayNumber); // Convert 1-7 to Sunday-Saturday
        }
        
        return day; // Fallback to original value if conversion fails
      }).join(', ');
    } catch (error) {
      console.error('Error parsing days:', error);
      return 'Error';
    }
  }, [task.days]);
  
  // Format the task time for display - memoized to prevent recalculation on every render
  const formattedTime = useMemo(() => {
    try {
      // Make sure we have a valid date string
      if (!task.time) return 'No time set';
      
      // Parse the ISO date string
      const date = parseISO(task.time);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) return 'Invalid time';
      
      // Format the time
      return format(date, 'h:mm a');
    } catch (error) {
      console.error('Error formatting task time:', error);
      return 'Error';
    }
  }, [task.time]);
  
  // Determine the status color - memoized to prevent recalculation on every render
  const statusColor = useMemo(() => {
    switch (task.status) {
      case TASK_STATUS.INCOMPLETE:
        return '#FFA500'; // Orange
      case TASK_STATUS.COMPLETE:
        return '#4CAF50'; // Green
      case TASK_STATUS.OVERDUE:
        return '#F44336'; // Red
      default:
        return '#757575'; // Gray
    }
  }, [task.status]);
  
  // Determine the status text - memoized to prevent recalculation on every render
  const statusText = useMemo(() => {
    switch (task.status) {
      case TASK_STATUS.INCOMPLETE:
        return 'Incomplete';
      case TASK_STATUS.COMPLETE:
        return 'Complete';
      case TASK_STATUS.OVERDUE:
        return 'Overdue';
      default:
        return 'Unknown';
    }
  }, [task.status]);
  
  // Memoize callback functions to prevent unnecessary re-renders
  const handleComplete = useCallback(() => onComplete(task.id), [onComplete, task.id]);
  const handleDelete = useCallback(() => onDelete(task.id), [onDelete, task.id]);
  
  return (
    <View style={styles.container}>
      <View style={styles.taskInfo}>
        <Text style={styles.taskName}>{task.task}</Text>
        <View style={styles.taskDetails}>
          <Text style={styles.taskTime}>{formattedTime}</Text>
          <Text style={styles.taskDays}>{formattedDays}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>
      
      <View style={styles.actions}>
        {task.status !== TASK_STATUS.COMPLETE && (
          <TouchableOpacity 
            style={styles.completeButton} 
            onPress={handleComplete}
          >
            <MaterialIcons name="check-circle-outline" size={24} color="#4CAF50" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={24} color="#F44336" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  taskInfo: {
    flex: 1,
  },
  taskName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  taskDetails: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  taskTime: {
    fontSize: 14,
    color: '#757575',
    marginRight: 8,
  },
  taskDays: {
    fontSize: 14,
    color: '#757575',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeButton: {
    marginRight: 12,
  },
  deleteButton: {
    // No specific styles needed
  },
}); 

// Wrap the component with React.memo to prevent unnecessary re-renders
export default React.memo(Task); 