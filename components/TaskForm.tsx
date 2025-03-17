/**
 * Task Form Component - Provides a form for creating new tasks with
 * task name, time picker, day selection, and submit button.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { TASK_STATUS, PHILIPPINES_TIMEZONE } from "../utils/taskUtils";

// Days of the week for selection using Expo's weekly trigger format (1-7, with 1 being Sunday)
const DAYS_OF_WEEK = [
  { name: "Sunday", number: 1 },
  { name: "Monday", number: 2 },
  { name: "Tuesday", number: 3 },
  { name: "Wednesday", number: 4 },
  { name: "Thursday", number: 5 },
  { name: "Friday", number: 6 },
  { name: "Saturday", number: 7 },
];

interface TaskFormProps {
  onSubmit: (task: {
    taskName: string;
    taskStatus: string;
    taskTime: string;
    repeatDay: string[];
  }) => void;
}

const TaskForm = ({ onSubmit }: TaskFormProps) => {
  // Form state
  const [taskName, setTaskName] = useState("");
  const [selectedTime, setSelectedTime] = useState(
    toZonedTime(new Date(), PHILIPPINES_TIMEZONE)
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Get today's day number - memoized
  const todayNumber = useMemo(() => {
    const now = new Date();
    const philippinesNow = toZonedTime(now, PHILIPPINES_TIMEZONE);
    return philippinesNow.getDay() + 1; // getDay returns 0-6, convert to 1-7
  }, []);

  // Initialize with today's day when component mounts
  useEffect(() => {
    setSelectedDays([todayNumber]);
  }, [todayNumber]);

  // Format time for display - memoized
  const formattedTime = useMemo(() => {
    return formatInTimeZone(selectedTime, PHILIPPINES_TIMEZONE, "h:mm a");
  }, [selectedTime]);

  // Handle time change
  const handleTimeChange = useCallback(
    (event: any, selectedDate?: Date) => {
      const currentDate = selectedDate || selectedTime;
      setShowTimePicker(Platform.OS === "ios");
      setSelectedTime(currentDate);
    },
    [selectedTime]
  );

  // Toggle day selection
  const toggleDay = useCallback((dayNumber: number) => {
    setSelectedDays((prevDays) => {
      if (prevDays.includes(dayNumber)) {
        // Don't allow deselecting the last day
        if (prevDays.length > 1) {
          return prevDays.filter((d) => d !== dayNumber);
        }
        return prevDays;
      } else {
        return [...prevDays, dayNumber];
      }
    });
  }, []);

  // Reset form state
  const resetForm = useCallback(() => {
    setTaskName("");
    setSelectedTime(toZonedTime(new Date(), PHILIPPINES_TIMEZONE));
    setSelectedDays([todayNumber]);
  }, [todayNumber]);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    // Don't submit if task name is empty
    if (!taskName.trim()) {
      return;
    }

    // Convert day numbers to day names for storage
    const repeatDays = selectedDays.map((dayNum) => {
      const day = DAYS_OF_WEEK.find((d) => d.number === dayNum);
      return day ? day.name : "";
    }).filter(Boolean);

    // Create task object
    const task = {
      taskName: taskName.trim(),
      taskStatus: TASK_STATUS.INCOMPLETE,
      taskTime: selectedTime.toISOString(),
      repeatDay: repeatDays,
    };

    // Submit task and reset form
    onSubmit(task);
    resetForm();
  }, [taskName, selectedTime, selectedDays, onSubmit, resetForm]);

  return (
    <ScrollView>
      <View style={styles.container}>
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
          <Text style={styles.timeText}>{formattedTime}</Text>
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

        <Text style={styles.label}>Repeat on Days</Text>
        <View style={styles.daysContainer}>
          {DAYS_OF_WEEK.map((day) => (
            <TouchableOpacity
              key={day.number}
              style={[
                styles.dayButton,
                selectedDays.includes(day.number) && styles.selectedDay,
              ]}
              onPress={() => toggleDay(day.number)}
            >
              <Text
                style={[
                  styles.dayText,
                  selectedDays.includes(day.number) && styles.selectedDayText,
                ]}
              >
                {day.name.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Create Task</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  timeSelector: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    justifyContent: "center",
    padding: 15,
  },
  timeText: {
    fontSize: 16,
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    justifyContent: "space-between",
  },
  dayButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 1,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  selectedDay: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  dayText: {
    fontSize: 14,
  },
  selectedDayText: {
    color: "white",
  },
  submitButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 15,
    alignItems: "center",
    marginTop: 30,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default TaskForm;
