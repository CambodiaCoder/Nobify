import admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';
import prisma from '../lib/prisma';

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App | null = null;

export function initializeFirebase() {
  if (!firebaseApp) {
    try {
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const projectId = process.env.FIREBASE_PROJECT_ID;

      if (!serviceAccountKey || !projectId) {
        console.warn('Firebase credentials not found. Push notifications will be disabled.');
        return false;
      }

      const serviceAccount = JSON.parse(serviceAccountKey);
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });

      console.log('Firebase Admin SDK initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      return false;
    }
  }
  return true;
}

// Initialize SendGrid
export function initializeSendGrid() {
  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      console.warn('SendGrid API key not found. Email notifications will be disabled.');
      return false;
    }

    sgMail.setApiKey(apiKey);
    console.log('SendGrid initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize SendGrid:', error);
    return false;
  }
}

// Notification interfaces
export interface PushNotification {
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
}

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send push notification via Firebase Cloud Messaging
 */
export async function sendPushNotification(
  fcmToken: string,
  notification: PushNotification
): Promise<NotificationResult> {
  try {
    if (!firebaseApp) {
      const initialized = initializeFirebase();
      if (!initialized) {
        return { success: false, error: 'Firebase not initialized' };
      }
    }

    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl })
      },
      data: notification.data || {},
      android: {
        notification: {
          channelId: 'nobify_alerts',
          priority: 'high' as const,
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    
    return {
      success: true,
      messageId: response
    };

  } catch (error: any) {
    console.error('Failed to send push notification:', error);
    
    // Handle specific Firebase errors
    if (error.code === 'messaging/registration-token-not-registered') {
      return { success: false, error: 'Invalid or expired FCM token' };
    }
    
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred' 
    };
  }
}

/**
 * Send email notification via SendGrid
 */
export async function sendEmailNotification(
  notification: EmailNotification
): Promise<NotificationResult> {
  try {
    const initialized = initializeSendGrid();
    if (!initialized) {
      return { success: false, error: 'SendGrid not initialized' };
    }

    const msg = {
      to: notification.to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@nobify.app',
      subject: notification.subject,
      html: notification.html,
      text: notification.text || notification.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    const response = await sgMail.send(msg);
    
    return {
      success: true,
      messageId: response[0].headers['x-message-id']
    };

  } catch (error: any) {
    console.error('Failed to send email notification:', error);
    
    return { 
      success: false, 
      error: error.message || 'Unknown error occurred' 
    };
  }
}

/**
 * Send notification to user via all available channels
 */
export async function sendNotificationToUser(
  userId: string,
  notification: {
    title: string;
    body: string;
    type: 'price_alert' | 'airdrop_deadline' | 'portfolio_update' | 'general';
    data?: { [key: string]: string };
  }
): Promise<{
  pushResult?: NotificationResult;
  emailResult?: NotificationResult;
  success: boolean;
}> {
  try {
    // Get user's notification preferences and contact info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        fcmToken: true,
        emailNotifications: true,
        pushNotifications: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const results: {
      pushResult?: NotificationResult;
      emailResult?: NotificationResult;
      success: boolean;
    } = { success: false };

    // Send push notification if enabled and token available
    if (user.pushNotifications && user.fcmToken) {
      results.pushResult = await sendPushNotification(user.fcmToken, {
        title: notification.title,
        body: notification.body,
        data: notification.data
      });
    }

    // Send email notification if enabled
    if (user.emailNotifications && user.email) {
      const emailHtml = generateEmailTemplate(notification);
      
      results.emailResult = await sendEmailNotification({
        to: user.email,
        subject: notification.title,
        html: emailHtml
      });
    }

    // Consider success if at least one notification was sent successfully
    results.success = Boolean(
      (results.pushResult?.success) || 
      (results.emailResult?.success)
    );

    return results;

  } catch (error) {
    console.error('Failed to send notification to user:', error);
    return { success: false };
  }
}

/**
 * Generate HTML email template for notifications
 */
function generateEmailTemplate(notification: {
  title: string;
  body: string;
  type: string;
  data?: { [key: string]: string };
}): string {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${notification.title}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nobify Alert</h1>
        </div>
        <div class="content">
          <h2>${notification.title}</h2>
          <p>${notification.body}</p>
          ${notification.data?.actionUrl ? `
            <p>
              <a href="${notification.data.actionUrl}" class="button">View Details</a>
            </p>
          ` : ''}
        </div>
        <div class="footer">
          <p>This is an automated notification from Nobify.</p>
          <p><a href="${baseUrl}/settings/notifications">Manage your notification preferences</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Initialize services on module load
initializeFirebase();
initializeSendGrid();
