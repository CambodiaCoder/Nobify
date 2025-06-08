# Alerts and Notification System

## Overview

This document describes the comprehensive alerts and notification system that provides real-time price alerts, airdrop deadline notifications, and multi-channel notification delivery via Firebase Cloud Messaging (push notifications) and SendGrid (email notifications).

## Features Implemented

### 1. Alert Management System
- **CRUD Operations**: Complete alert lifecycle management
- **Alert Types**: Price alerts, airdrop deadline alerts, portfolio alerts
- **Condition Types**: Above/below thresholds, percentage changes, deadline warnings
- **User Authentication**: Secure, user-specific alert management
- **Alert Status Management**: Active/inactive states with toggle functionality

### 2. Multi-Channel Notification System
- **Push Notifications**: Firebase Cloud Messaging integration
- **Email Notifications**: SendGrid integration with HTML templates
- **Notification Preferences**: User-configurable notification channels
- **Graceful Degradation**: Continues operation when services are unavailable

### 3. Background Alert Scheduler
- **Automated Evaluation**: Runs every minute to check alert conditions
- **Price Monitoring**: Real-time cryptocurrency price monitoring
- **Deadline Tracking**: Airdrop deadline monitoring and warnings
- **Duplicate Prevention**: Cooldown periods to prevent notification spam
- **Performance Monitoring**: Comprehensive logging and health checks

### 4. Alert Evaluation Engine
- **Price Conditions**: Above, below, percentage change monitoring
- **Deadline Conditions**: 24h, 1h, and deadline passed notifications
- **Batch Processing**: Efficient evaluation of multiple alerts
- **Error Handling**: Robust error handling with detailed logging

## API Endpoints

### Alert Management

#### Get User Alerts
```
GET /api/alerts
Authorization: Bearer <token>
```

#### Create Alert
```
POST /api/alerts
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "price",
  "condition": "above",
  "threshold": 50000,
  "tokenSymbol": "BTC"
}
```

#### Update Alert
```
PUT /api/alerts/:id
Content-Type: application/json

{
  "threshold": 55000,
  "active": false
}
```

#### Delete Alert
```
DELETE /api/alerts/:id
```

#### Toggle Alert Status
```
PUT /api/alerts/:id/toggle
```

### Scheduler Management

#### Get Scheduler Status
```
GET /api/alerts/scheduler/status
```

#### Trigger Manual Evaluation
```
POST /api/alerts/scheduler/trigger
```

#### Test Notification
```
POST /api/alerts/test-notification
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Test Alert",
  "body": "This is a test notification"
}
```

## Alert Types and Conditions

### Price Alerts
- **Type**: `price`
- **Conditions**:
  - `above`: Trigger when price goes above threshold
  - `below`: Trigger when price goes below threshold
  - `change_up`: Trigger when 24h change exceeds threshold percentage
  - `change_down`: Trigger when 24h change drops below threshold percentage
- **Required Fields**: `tokenSymbol`, `threshold`

### Airdrop Alerts
- **Type**: `airdrop`
- **Conditions**:
  - `deadline_24h`: Trigger 24 hours before deadline
  - `deadline_1h`: Trigger 1 hour before deadline
  - `deadline_passed`: Trigger when deadline has passed
- **Required Fields**: `airdropId`

## Notification Channels

### Push Notifications (Firebase)
- **Platform Support**: iOS and Android
- **Features**: Rich notifications with custom data
- **Configuration**: Requires Firebase service account key
- **Fallback**: Graceful degradation when unavailable

### Email Notifications (SendGrid)
- **HTML Templates**: Professional email templates
- **Personalization**: User-specific content and preferences
- **Configuration**: Requires SendGrid API key
- **Fallback**: Graceful degradation when unavailable

## Environment Variables

### Required for Full Functionality
```env
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
FIREBASE_PROJECT_ID=your-project-id

# SendGrid Configuration
SENDGRID_API_KEY=SG.your-api-key
SENDGRID_FROM_EMAIL=noreply@nobify.app

# Frontend URL for email links
FRONTEND_URL=http://localhost:5173

# Optional: Disable scheduling for testing
ALERT_SCHEDULING_ENABLED=true
```

### Firebase Service Account Setup
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Copy the entire JSON content to `FIREBASE_SERVICE_ACCOUNT_KEY`

### SendGrid Setup
1. Create SendGrid account and verify sender identity
2. Generate API key with Mail Send permissions
3. Set `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`

## Database Schema

### User Model Extensions
```sql
-- Added notification preference fields
fcmToken            String?   -- Firebase Cloud Messaging token
emailNotifications  Boolean   -- Enable/disable email notifications
pushNotifications   Boolean   -- Enable/disable push notifications
```

### Alert Model
```sql
id            String    -- Unique alert identifier
userId        String    -- Owner of the alert
type          String    -- Alert type (price, airdrop, etc.)
condition     String    -- Trigger condition
threshold     Float?    -- Threshold value for price alerts
tokenSymbol   String?   -- Token symbol for price alerts
airdropId     String?   -- Airdrop ID for deadline alerts
active        Boolean   -- Alert active status
lastTriggered DateTime? -- Last time alert was triggered
```

## Service Architecture

### NotificationService
- **Firebase Integration**: Push notification delivery
- **SendGrid Integration**: Email notification delivery
- **Template Generation**: HTML email template creation
- **User Preferences**: Respects user notification settings

### AlertService
- **Alert Evaluation**: Condition checking and triggering
- **Price Monitoring**: Integration with crypto price APIs
- **Deadline Tracking**: Airdrop deadline monitoring
- **Notification Dispatch**: Coordinates with notification service

### SchedulerService
- **Background Processing**: Automated alert evaluation
- **Health Monitoring**: System health and performance tracking
- **Graceful Shutdown**: Proper cleanup on application termination
- **Manual Triggers**: Support for manual evaluation

## Performance Considerations

### Optimization Strategies
- **Batch Processing**: Group alerts by type for efficient evaluation
- **Caching**: Price data caching to reduce API calls
- **Cooldown Periods**: Prevent notification spam
- **Parallel Processing**: Concurrent notification sending

### Monitoring and Logging
- **Evaluation Metrics**: Track evaluation time and success rates
- **Error Logging**: Comprehensive error tracking and reporting
- **Health Checks**: Scheduler status and service availability
- **Performance Metrics**: Notification delivery success rates

## Error Handling

### Graceful Degradation
- **Service Unavailability**: Continue operation when external services fail
- **Invalid Tokens**: Handle expired or invalid FCM tokens
- **API Failures**: Retry logic for transient failures
- **Data Validation**: Comprehensive input validation

### Error Recovery
- **Automatic Retry**: Retry failed notifications with exponential backoff
- **Fallback Channels**: Use alternative notification channels when primary fails
- **Error Reporting**: Detailed error logging for debugging

## Testing Strategy

### Unit Tests
- **Service Functions**: Test individual notification and alert functions
- **Condition Evaluation**: Test alert condition logic
- **Error Scenarios**: Test error handling and edge cases

### Integration Tests
- **API Endpoints**: Test complete alert management workflow
- **Notification Flow**: Test end-to-end notification delivery
- **Scheduler Operations**: Test background processing

### Mock Services
- **Firebase Mocking**: Mock Firebase for testing without real tokens
- **SendGrid Mocking**: Mock email service for testing
- **Price API Mocking**: Mock price data for consistent testing

## Usage Examples

### Create Price Alert
```javascript
const response = await fetch('/api/alerts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'price',
    condition: 'above',
    threshold: 50000,
    tokenSymbol: 'BTC'
  })
});
```

### Monitor Scheduler Health
```javascript
const response = await fetch('/api/alerts/scheduler/status');
const { scheduler } = await response.json();
console.log('Scheduler status:', scheduler.status);
```

### Send Test Notification
```javascript
const response = await fetch('/api/alerts/test-notification', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Test Alert',
    body: 'Testing notification system'
  })
});
```

## Future Enhancements

1. **Advanced Alert Types**: Portfolio performance alerts, news-based alerts
2. **Smart Notifications**: AI-powered notification timing optimization
3. **Webhook Support**: External webhook notifications for integrations
4. **Alert Templates**: Pre-configured alert templates for common scenarios
5. **Notification Analytics**: Detailed analytics on notification effectiveness
6. **Multi-Language Support**: Localized notifications and templates
