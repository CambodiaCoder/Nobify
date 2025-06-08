import { evaluateAllAlerts } from './alertService';

export class AlertScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private evaluationInProgress = false;

  /**
   * Start the alert scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('Alert scheduler is already running');
      return;
    }

    console.log('Starting alert scheduler...');
    
    // Run immediately on start
    this.runEvaluation();

    // Then run every minute
    this.intervalId = setInterval(() => {
      this.runEvaluation();
    }, 60 * 1000); // 60 seconds

    this.isRunning = true;
    console.log('Alert scheduler started successfully');
  }

  /**
   * Stop the alert scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Alert scheduler is not running');
      return;
    }

    console.log('Stopping alert scheduler...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('Alert scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    evaluationInProgress: boolean;
    nextEvaluation?: Date;
  } {
    return {
      isRunning: this.isRunning,
      evaluationInProgress: this.evaluationInProgress,
      nextEvaluation: this.isRunning ? new Date(Date.now() + 60 * 1000) : undefined
    };
  }

  /**
   * Run alert evaluation (with overlap protection)
   */
  private async runEvaluation(): Promise<void> {
    if (this.evaluationInProgress) {
      console.log('Alert evaluation already in progress, skipping...');
      return;
    }

    this.evaluationInProgress = true;
    const startTime = Date.now();

    try {
      console.log(`[${new Date().toISOString()}] Starting scheduled alert evaluation`);
      
      const results = await evaluateAllAlerts();
      
      const duration = Date.now() - startTime;
      const triggeredCount = results.filter(r => r.triggered).length;
      const notificationsSent = results.filter(r => r.notificationSent).length;
      const errors = results.filter(r => r.error).length;

      console.log(`[${new Date().toISOString()}] Alert evaluation completed in ${duration}ms:`);
      console.log(`  - Total alerts evaluated: ${results.length}`);
      console.log(`  - Alerts triggered: ${triggeredCount}`);
      console.log(`  - Notifications sent: ${notificationsSent}`);
      console.log(`  - Errors: ${errors}`);

      // Log errors if any
      if (errors > 0) {
        const errorMessages = results
          .filter(r => r.error)
          .map(r => `Alert ${r.alertId}: ${r.error}`)
          .join(', ');
        console.error('Alert evaluation errors:', errorMessages);
      }

    } catch (error) {
      console.error('Fatal error during alert evaluation:', error);
    } finally {
      this.evaluationInProgress = false;
    }
  }

  /**
   * Manually trigger alert evaluation (for testing)
   */
  async triggerEvaluation(): Promise<void> {
    console.log('Manually triggering alert evaluation...');
    await this.runEvaluation();
  }
}

// Create singleton instance
export const alertScheduler = new AlertScheduler();

/**
 * Initialize and start the alert scheduler
 */
export function initializeScheduler(): void {
  try {
    // Check if scheduling is enabled
    const schedulingEnabled = process.env.ALERT_SCHEDULING_ENABLED !== 'false';
    
    if (!schedulingEnabled) {
      console.log('Alert scheduling is disabled via environment variable');
      return;
    }

    alertScheduler.start();

    // Graceful shutdown handling
    process.on('SIGINT', () => {
      console.log('Received SIGINT, stopping alert scheduler...');
      alertScheduler.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, stopping alert scheduler...');
      alertScheduler.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to initialize alert scheduler:', error);
  }
}

/**
 * Health check for the scheduler
 */
export function getSchedulerHealth(): {
  status: 'healthy' | 'unhealthy';
  details: {
    isRunning: boolean;
    evaluationInProgress: boolean;
    uptime?: number;
    lastEvaluation?: Date;
  };
} {
  const status = alertScheduler.getStatus();
  
  return {
    status: status.isRunning ? 'healthy' : 'unhealthy',
    details: {
      isRunning: status.isRunning,
      evaluationInProgress: status.evaluationInProgress,
      uptime: status.isRunning ? process.uptime() : undefined,
      lastEvaluation: status.nextEvaluation ? new Date(status.nextEvaluation.getTime() - 60 * 1000) : undefined
    }
  };
}
