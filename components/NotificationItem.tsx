/**
 * Notification Item Component - Renders an individual notification with timestamp and status indicator
 */

import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { NotificationRecord } from '../utils/notificationUtils';

interface NotificationItemProps {
  notification: NotificationRecord;
  onMarkAsRead: (notificationId: string) => void;
}

export default function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  // Format the notification timestamp for display
  const formattedTime = useMemo(() => {
    return format(parseISO(notification.timestamp), 'MMM d, yyyy h:mm a');
  }, [notification.timestamp]);
  
  // Determine the icon based on notification type
  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'task_start':
        return 'alarm-outline';
      case 'task_overdue':
        return 'alert-circle-outline';
      default:
        return 'notifications-outline';
    }
  };
  
  return (
    <View style={[
      styles.container,
      !notification.read && styles.unreadContainer
    ]}>
      <View style={styles.iconContainer}>
        <Ionicons 
          name={getNotificationIcon()} 
          size={24} 
          color={notification.type === 'task_overdue' ? '#F44336' : '#2196F3'} 
        />
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.body}>{notification.body}</Text>
        <Text style={styles.timestamp}>{formattedTime}</Text>
      </View>
      
      {!notification.read && (
        <TouchableOpacity 
          style={styles.readButton}
          onPress={() => onMarkAsRead(notification.id)}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="#4CAF50" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
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
  unreadContainer: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  iconContainer: {
    marginRight: 16,
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#757575',
  },
  readButton: {
    justifyContent: 'center',
    paddingLeft: 8,
  },
}); 