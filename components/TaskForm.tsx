/**
 * ========================================================
 * Task Form Component
 * 
 * This component provides a form for creating new tasks with:
 * - Task name input
 * - Time picker for scheduling
 * - Day selection for recurring tasks
 * - Submit button
 * 
 * The form collects user input and passes it to the parent component
 * for task creation.
 * ========================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Platform,
  ScrollView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { TASK_STATUS, PHILIPPINES_TIMEZONE } from '../utils/taskUtils';

// Days of the week for selection - defined outside to prevent recreation
const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

interface TaskFormProps {
  onSubmit: (task: {
    task: string;
    status: string;
    time: string;
    days: string;
  }) => void;
}

const TaskForm = ({ onSubmit }: TaskFormProps) => {
  // Form state
  const [taskName, setTaskName] = useState('');
  const [selectedTime, setSelectedTime] = useState(toZonedTime(new Date(), PHILIPPINES_TIMEZONE));
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  
  // Get today's day name once - memoized
  const today = useMemo(() => {
    const now = new Date();
    const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
    return format(philippinesNow, 'EEEE');
  }, []);
  
  // Initialize with today's day when component mounts
  useEffect(() => {
    setSelectedDays([today]);
  }, [today]);
  
  // Format time for display - memoized
  const formattedTime = useMemo(() => {
    return formatInTimeZone(selectedTime, PHILIPPINES_TIMEZONE, 'h:mm a');
  }, [selectedTime]);
  
  // Handle time change - memoized
  const handleTimeChange = useCallback((event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || selectedTime;
    setShowTimePicker(Platform.OS === 'ios');
    setSelectedTime(currentDate);
  }, [selectedTime]);
  
  // Toggle day selection - memoized
  const toggleDay = useCallback((day: string) => {
    setSelectedDays(prevDays => {
      if (prevDays.includes(day)) {
        // Don't allow deselecting the last day
        if (prevDays.length > 1) {
          return prevDays.filter(d => d !== day);
        }
        return prevDays;
      } else {
        return [...prevDays, day];
      }
    });
  }, []);
  
  // Handle form submission - memoized
  const handleSubmit = useCallback(() => {
    // Validate form
    if (!taskName.trim()) {
      alert('Please enter a task name');
      return;
    }
    
    // If no days selected, automatically select today's day
    let daysToSubmit = selectedDays;
    if (daysToSubmit.length === 0) {
      daysToSubmit = [today];
    }
    
    // Create task object
    const newTask = {
      task: taskName,
      status: TASK_STATUS.PENDING,
      time: selectedTime.toISOString(),
      days: JSON.stringify(daysToSubmit),
    };
    
    // Submit task
    onSubmit(newTask);
    
    // Reset form
    setTaskName('');
    setSelectedTime(toZonedTime(new Date(), PHILIPPINES_TIMEZONE));
    setSelectedDays([today]);
  }, [taskName, selectedTime, selectedDays, today, onSubmit]);
  
  // Memoize day buttons to prevent unnecessary re-renders
  const dayButtons = useMemo(() => {
    return DAYS_OF_WEEK.map(day => (
      <TouchableOpacity
        key={day}
        style={[
          styles.dayButton,
          selectedDays.includes(day) && styles.selectedDayButton,
        ]}
        onPress={() => toggleDay(day)}
      >
        <Text
          style={[
            styles.dayButtonText,
            selectedDays.includes(day) && styles.selectedDayButtonText,
          ]}
        >
          {day.substring(0, 3)}
        </Text>
      </TouchableOpacity>
    ));
  }, [selectedDays, toggleDay]);
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Task Name</Text>
      <TextInput
        style={styles.input}
        value={taskName}
        onChangeText={setTaskName}
        placeholder="Enter task name"
      />
      
      <Text style={styles.label}>Task Time</Text>
      <TouchableOpacity
        style={styles.timeSelector}
        onPress={() => setShowTimePicker(true)}
      >
        <Text>{formattedTime}</Text>
      </TouchableOpacity>
      
      {showTimePicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handleTimeChange}
        />
      )}
      
      <Text style={styles.label}>Days</Text>
      <View style={styles.daysContainer}>
        {dayButtons}
      </View>
      
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Add Task</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  timeSelector: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  dayButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
  },
  selectedDayButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  dayButtonText: {
    color: '#333',
  },
  selectedDayButtonText: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 

// Wrap the component with React.memo to prevent unnecessary re-renders
export default React.memo(TaskForm); 