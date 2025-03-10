/**
 * ========================================================
 * Notifications Screen
 * 
 * This screen displays the notification history with:
 * - List of past notifications
 * - Read/unread status indicators
 * - Ability to mark notifications as read
 * 
 * The screen provides a user interface for viewing and managing
 * notification history.
 * ========================================================
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

export default function NotificationsScreen() {
  // State for notifications
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Load notifications when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );
  
  // Load notifications from storage
  const loadNotifications = async () => {
    try {
      console.log('[Notifications Screen] Loading notifications...');
      
      const notificationHistory = await loadNotificationHistory();
      console.log(`[Notifications Screen] Loaded ${notificationHistory.length} notifications from history`);
      
      // Filter out duplicates by keeping only the first occurrence of each unique notification
      // We consider notifications duplicate if they have the same taskId, type, and timestamp
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
      
      console.log(`[Notifications Screen] Filtered to ${uniqueNotifications.length} unique notifications`);
      
      // Sort notifications by timestamp (newest first)
      const sortedNotifications = uniqueNotifications.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      console.log('[Notifications Screen] Setting notifications state');
      setNotifications(sortedNotifications);
    } catch (error) {
      console.error('[Notifications Screen] Error loading notifications:', error);
    }
  };
  
  // Handle marking a notification as read
  const handleMarkAsRead = async (notificationId: string) => {
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
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };
  
  // Handle clearing all notifications
  const handleClearAll = async () => {
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
  };
  
  // Render empty state when no notifications are available
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateText}>No notifications yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Notifications will appear here when your tasks are due or overdue
      </Text>
    </View>
  );
  
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
        keyExtractor={item => `${item.id}_${item.taskId}_${item.type}`}
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
            colors={['#2196F3']}
            tintColor="#2196F3"
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