/**
 * Notifications Screen - Displays notification history with read/unread status indicators
 */

import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import NotificationItem from '@/components/NotificationItem';
import { 
  NotificationRecord, 
  loadNotificationHistory, 
  markNotificationAsRead,
  clearAllNotificationHistory
} from '@/utils/notificationUtils';
import { LogCategory, appLog } from '@/utils/taskUtils';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Load notifications when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );
  
  // Load notifications from storage
  const loadNotifications = useCallback(async () => {
    try {
      const notificationHistory = await loadNotificationHistory();
      
      // Filter out duplicates by keeping only the first occurrence of each unique notification
      const uniqueNotifications: NotificationRecord[] = [];
      const seen = new Set<string>();
      
      notificationHistory.forEach(notification => {
        // Create a unique key for this notification
        const uniqueKey = `${notification.taskId}_${notification.type}_${notification.timestamp}`;
        
        // Only add if we haven't seen this combination before
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          uniqueNotifications.push(notification);
        }
      });
      
      // Sort notifications by timestamp (newest first)
      const sortedNotifications = uniqueNotifications.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      setNotifications(sortedNotifications);
    } catch (error) {
      appLog(LogCategory.ERROR, 'Failed to load notifications', error);
    }
  }, []);
  
  // Handle marking a notification as read
  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      
      // Update the local state
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => {
          if (notification.id === notificationId) {
            return { ...notification, read: true };
          }
          return notification;
        })
      );
    } catch (error) {
      appLog(LogCategory.ERROR, 'Failed to mark notification as read', error);
    }
  }, []);
  
  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);
  
  // Handle clearing all notifications
  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllNotificationHistory();
            await loadNotifications();
          },
        },
      ]
    );
  }, [loadNotifications]);
  
  // Render empty state when no notifications are available
  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>No notifications yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Notifications will appear here when your tasks are due or overdue
      </Text>
    </View>
  ), []);
  
  return (
    <View style={styles.container}>
      {notifications.length > 0 && (
        <TouchableOpacity 
          style={styles.clearAllButton}
          onPress={handleClearAll}
        >
          <Text style={styles.clearAllText}>Clear All</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onMarkAsRead={handleMarkAsRead}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    paddingHorizontal: 32,
  },
  clearAllButton: {
    backgroundColor: '#f44336',
    padding: 10,
    margin: 16,
    marginBottom: 0,
    borderRadius: 5,
    alignItems: 'center',
  },
  clearAllText: {
    color: 'white',
    fontWeight: 'bold',
  },
}); 