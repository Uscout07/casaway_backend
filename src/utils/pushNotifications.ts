import { Expo } from 'expo-server-sdk';

// Create a new Expo SDK client
const expo = new Expo();

export interface NotificationData {
  type: 'message' | 'post' | 'listing' | 'comment' | 'reply';
  id?: string;
  chatId?: string;
  postId?: string;
  listingId?: string;
  senderName?: string;
  content?: string;
  parentEntityId?: string;
  parentEntityType?: string;
}

export interface PushNotificationPayload {
  to: string;
  title: string;
  body: string;
  data?: NotificationData;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

/**
 * Send a push notification to a single device
 */
export async function sendPushNotification(payload: PushNotificationPayload): Promise<boolean> {
  try {
    // Check that the push token is valid
    if (!Expo.isExpoPushToken(payload.to)) {
      console.error(`Push token ${payload.to} is not a valid Expo push token`);
      return false;
    }

    // Create the message
    const message = {
      to: payload.to,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: payload.sound || 'default',
      badge: payload.badge,
      channelId: payload.channelId || 'default',
    };

    // Send the notification
    const ticket = await expo.sendPushNotificationsAsync([message]);
    
    console.log('Push notification sent:', ticket);
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

/**
 * Send push notifications to multiple devices
 */
export async function sendBulkPushNotifications(payloads: PushNotificationPayload[]): Promise<void> {
  try {
    // Filter out invalid tokens
    const validPayloads = payloads.filter(payload => Expo.isExpoPushToken(payload.to));
    
    if (validPayloads.length === 0) {
      console.log('No valid push tokens found');
      return;
    }

    // Create messages
    const messages = validPayloads.map(payload => ({
      to: payload.to,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: payload.sound || 'default',
      badge: payload.badge,
      channelId: payload.channelId || 'default',
    }));

    // Send notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending notification chunk:', error);
      }
    }

    console.log('Bulk push notifications sent:', tickets.length, 'notifications');
  } catch (error) {
    console.error('Error sending bulk push notifications:', error);
  }
}

/**
 * Send a message notification
 */
export async function sendMessageNotification(
  recipientToken: string,
  senderName: string,
  messageContent: string,
  chatId: string
): Promise<boolean> {
  const payload: PushNotificationPayload = {
    to: recipientToken,
    title: `New message from ${senderName}`,
    body: messageContent.length > 50 ? `${messageContent.substring(0, 50)}...` : messageContent,
    data: {
      type: 'message',
      chatId: chatId,
      senderName: senderName,
      content: messageContent,
    },
    sound: 'default',
    channelId: 'messages',
  };

  return await sendPushNotification(payload);
}

/**
 * Send a post/listing notification
 */
export async function sendPostNotification(
  recipientToken: string,
  notificationType: 'post' | 'listing',
  content: string,
  entityId: string,
  senderName?: string
): Promise<boolean> {
  const title = notificationType === 'post' 
    ? (senderName ? `New post from ${senderName}` : 'New post')
    : 'New listing available';
  
  const payload: PushNotificationPayload = {
    to: recipientToken,
    title: title,
    body: content.length > 50 ? `${content.substring(0, 50)}...` : content,
    data: {
      type: notificationType,
      [notificationType === 'post' ? 'postId' : 'listingId']: entityId,
      senderName: senderName,
      content: content,
    },
    sound: 'default',
    channelId: notificationType === 'post' ? 'posts' : 'listings',
  };

  return await sendPushNotification(payload);
}

/**
 * Send a comment/reply notification
 */
export async function sendCommentNotification(
  recipientToken: string,
  commentType: 'comment' | 'reply',
  content: string,
  entityId: string,
  senderName: string,
  parentEntityId?: string,
  parentEntityType?: 'post' | 'listing'
): Promise<boolean> {
  const title = commentType === 'reply' 
    ? `New reply from ${senderName}`
    : `New comment from ${senderName}`;
  
  const payload: PushNotificationPayload = {
    to: recipientToken,
    title: title,
    body: content.length > 50 ? `${content.substring(0, 50)}...` : content,
    data: {
      type: commentType,
      id: entityId,
      senderName: senderName,
      content: content,
      parentEntityId: parentEntityId,
      parentEntityType: parentEntityType,
    },
    sound: 'default',
    channelId: 'comments',
  };

  return await sendPushNotification(payload);
}
