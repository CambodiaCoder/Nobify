import prisma from '../lib/prisma';
import { getPrices } from '../lib/cryptoApi';
import { sendNotificationToUser } from './notificationService';

export interface AlertEvaluationResult {
  alertId: string;
  triggered: boolean;
  message?: string;
  notificationSent?: boolean;
  error?: string;
}

/**
 * Evaluate all active alerts and send notifications for triggered ones
 */
export async function evaluateAllAlerts(): Promise<AlertEvaluationResult[]> {
  try {
    console.log('Starting alert evaluation...');
    
    // Get all active alerts
    const alerts = await prisma.alert.findMany({
      where: { active: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailNotifications: true,
            pushNotifications: true
          }
        }
      }
    });

    console.log(`Found ${alerts.length} active alerts to evaluate`);

    const results: AlertEvaluationResult[] = [];

    // Group alerts by type for efficient processing
    const priceAlerts = alerts.filter(alert => alert.type === 'price');
    const airdropAlerts = alerts.filter(alert => alert.type === 'airdrop');

    // Evaluate price alerts
    if (priceAlerts.length > 0) {
      const priceResults = await evaluatePriceAlerts(priceAlerts);
      results.push(...priceResults);
    }

    // Evaluate airdrop deadline alerts
    if (airdropAlerts.length > 0) {
      const airdropResults = await evaluateAirdropAlerts(airdropAlerts);
      results.push(...airdropResults);
    }

    const triggeredCount = results.filter(r => r.triggered).length;
    console.log(`Alert evaluation completed. ${triggeredCount} alerts triggered.`);

    return results;

  } catch (error) {
    console.error('Error during alert evaluation:', error);
    return [];
  }
}

/**
 * Evaluate price-based alerts
 */
async function evaluatePriceAlerts(alerts: any[]): Promise<AlertEvaluationResult[]> {
  const results: AlertEvaluationResult[] = [];

  try {
    // Get unique token symbols from alerts
    const tokenSymbols = [...new Set(alerts.map(alert => alert.tokenSymbol).filter(Boolean))];
    
    if (tokenSymbols.length === 0) {
      return results;
    }

    // Fetch current prices for all tokens
    const prices = await getPrices(tokenSymbols);

    for (const alert of alerts) {
      try {
        const result = await evaluatePriceAlert(alert, prices);
        results.push(result);
      } catch (error) {
        console.error(`Error evaluating price alert ${alert.id}:`, error);
        results.push({
          alertId: alert.id,
          triggered: false,
          error: `Evaluation failed: ${error}`
        });
      }
    }

  } catch (error) {
    console.error('Error fetching prices for alert evaluation:', error);
    
    // Return failed results for all alerts
    for (const alert of alerts) {
      results.push({
        alertId: alert.id,
        triggered: false,
        error: 'Failed to fetch price data'
      });
    }
  }

  return results;
}

/**
 * Evaluate a single price alert
 */
async function evaluatePriceAlert(alert: any, prices: any): Promise<AlertEvaluationResult> {
  const tokenSymbol = alert.tokenSymbol?.toLowerCase();
  const currentPrice = prices[tokenSymbol]?.usd;

  if (!currentPrice || !alert.threshold) {
    return {
      alertId: alert.id,
      triggered: false,
      error: 'Missing price data or threshold'
    };
  }

  let triggered = false;
  let message = '';

  // Check alert condition
  switch (alert.condition) {
    case 'above':
      triggered = currentPrice > alert.threshold;
      if (triggered) {
        message = `${alert.tokenSymbol} price is now $${currentPrice.toFixed(2)}, above your alert threshold of $${alert.threshold.toFixed(2)}`;
      }
      break;

    case 'below':
      triggered = currentPrice < alert.threshold;
      if (triggered) {
        message = `${alert.tokenSymbol} price is now $${currentPrice.toFixed(2)}, below your alert threshold of $${alert.threshold.toFixed(2)}`;
      }
      break;

    case 'change_up':
      // Check for percentage increase (threshold as percentage)
      const change24h = prices[tokenSymbol]?.usd_24h_change || 0;
      triggered = change24h > alert.threshold;
      if (triggered) {
        message = `${alert.tokenSymbol} is up ${change24h.toFixed(2)}% in the last 24 hours (current price: $${currentPrice.toFixed(2)})`;
      }
      break;

    case 'change_down':
      // Check for percentage decrease (threshold as negative percentage)
      const change24hDown = prices[tokenSymbol]?.usd_24h_change || 0;
      triggered = change24hDown < -Math.abs(alert.threshold);
      if (triggered) {
        message = `${alert.tokenSymbol} is down ${Math.abs(change24hDown).toFixed(2)}% in the last 24 hours (current price: $${currentPrice.toFixed(2)})`;
      }
      break;

    default:
      return {
        alertId: alert.id,
        triggered: false,
        error: `Unknown condition: ${alert.condition}`
      };
  }

  // If triggered, check if we should send notification (avoid duplicates)
  let notificationSent = false;
  if (triggered) {
    const shouldSendNotification = await shouldSendAlertNotification(alert);
    
    if (shouldSendNotification) {
      // Send notification
      const notificationResult = await sendNotificationToUser(alert.userId, {
        title: `${alert.tokenSymbol} Price Alert`,
        body: message,
        type: 'price_alert',
        data: {
          alertId: alert.id,
          tokenSymbol: alert.tokenSymbol,
          currentPrice: currentPrice.toString(),
          threshold: alert.threshold.toString(),
          condition: alert.condition
        }
      });

      notificationSent = notificationResult.success;

      // Update alert's lastTriggered timestamp
      if (notificationSent) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: { lastTriggered: new Date() }
        });
      }
    }
  }

  return {
    alertId: alert.id,
    triggered,
    message: triggered ? message : undefined,
    notificationSent
  };
}

/**
 * Evaluate airdrop deadline alerts
 */
async function evaluateAirdropAlerts(alerts: any[]): Promise<AlertEvaluationResult[]> {
  const results: AlertEvaluationResult[] = [];

  for (const alert of alerts) {
    try {
      const result = await evaluateAirdropAlert(alert);
      results.push(result);
    } catch (error) {
      console.error(`Error evaluating airdrop alert ${alert.id}:`, error);
      results.push({
        alertId: alert.id,
        triggered: false,
        error: `Evaluation failed: ${error}`
      });
    }
  }

  return results;
}

/**
 * Evaluate a single airdrop deadline alert
 */
async function evaluateAirdropAlert(alert: any): Promise<AlertEvaluationResult> {
  if (!alert.airdropId) {
    return {
      alertId: alert.id,
      triggered: false,
      error: 'No airdrop ID specified'
    };
  }

  // Get airdrop details
  const airdrop = await prisma.airdrop.findUnique({
    where: { id: alert.airdropId }
  });

  if (!airdrop) {
    return {
      alertId: alert.id,
      triggered: false,
      error: 'Airdrop not found'
    };
  }

  const now = new Date();
  const deadline = new Date(airdrop.deadline);
  const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  let triggered = false;
  let message = '';

  // Check different deadline conditions
  switch (alert.condition) {
    case 'deadline_24h':
      triggered = hoursUntilDeadline <= 24 && hoursUntilDeadline > 0;
      if (triggered) {
        message = `${airdrop.title} airdrop deadline is in ${Math.round(hoursUntilDeadline)} hours!`;
      }
      break;

    case 'deadline_1h':
      triggered = hoursUntilDeadline <= 1 && hoursUntilDeadline > 0;
      if (triggered) {
        message = `${airdrop.title} airdrop deadline is in less than 1 hour!`;
      }
      break;

    case 'deadline_passed':
      triggered = hoursUntilDeadline <= 0;
      if (triggered) {
        message = `${airdrop.title} airdrop deadline has passed.`;
      }
      break;

    default:
      return {
        alertId: alert.id,
        triggered: false,
        error: `Unknown condition: ${alert.condition}`
      };
  }

  // If triggered, send notification
  let notificationSent = false;
  if (triggered) {
    const shouldSendNotification = await shouldSendAlertNotification(alert);
    
    if (shouldSendNotification) {
      const notificationResult = await sendNotificationToUser(alert.userId, {
        title: 'Airdrop Deadline Alert',
        body: message,
        type: 'airdrop_deadline',
        data: {
          alertId: alert.id,
          airdropId: alert.airdropId,
          airdropTitle: airdrop.title,
          deadline: deadline.toISOString()
        }
      });

      notificationSent = notificationResult.success;

      // Update alert's lastTriggered timestamp
      if (notificationSent) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: { lastTriggered: new Date() }
        });
      }
    }
  }

  return {
    alertId: alert.id,
    triggered,
    message: triggered ? message : undefined,
    notificationSent
  };
}

/**
 * Check if we should send notification for this alert (avoid spam)
 */
async function shouldSendAlertNotification(alert: any): Promise<boolean> {
  // Don't send if alert was triggered recently (within last hour for price alerts, 6 hours for airdrop alerts)
  if (alert.lastTriggered) {
    const hoursSinceLastTrigger = (Date.now() - alert.lastTriggered.getTime()) / (1000 * 60 * 60);
    const cooldownHours = alert.type === 'price' ? 1 : 6; // Different cooldowns for different alert types
    
    if (hoursSinceLastTrigger < cooldownHours) {
      return false;
    }
  }

  return true;
}
