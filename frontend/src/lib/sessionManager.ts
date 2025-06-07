/**
 * Session management utilities for handling token expiration and session timeouts
 */

// Default session timeout in milliseconds (30 minutes)
const DEFAULT_SESSION_TIMEOUT = 3600 * 1000; // 1 hour, matching token expiry

// Key for storing session expiration time
const SESSION_EXPIRY_KEY = 'session_expiry';

// Key for storing inactivity timeout
const INACTIVITY_TIMEOUT_KEY = 'inactivity_timeout';

// Key for storing refresh token
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * Initialize the session timer
 * @param expiresIn Time in seconds until the token expires
 */
export function initializeSession(expiresIn: number = 3600) {
  if (typeof window !== 'undefined') {
    // Calculate expiry time (current time + token expiration)
    const expiryTime = Date.now() + (expiresIn * 1000);
    
    // Store expiry time in localStorage
    localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());
    
    // Initialize inactivity timeout
    resetInactivityTimer();
  }
}

/**
 * Reset the inactivity timer
 */
export function resetInactivityTimer() {
  if (typeof window !== 'undefined') {
    const inactivityTimeout = Date.now() + DEFAULT_SESSION_TIMEOUT;
    localStorage.setItem(INACTIVITY_TIMEOUT_KEY, inactivityTimeout.toString());
  }
}

/**
 * Check if the session is expired
 * @returns True if the session is expired, false otherwise
 */
export function isSessionExpired(): boolean {
  if (typeof window === 'undefined') {
    return true; // Session is expired if localStorage is not available
  }
  const expiryTimeStr = localStorage.getItem(SESSION_EXPIRY_KEY);
  const inactivityTimeoutStr = localStorage.getItem(INACTIVITY_TIMEOUT_KEY);
  
  if (!expiryTimeStr || !inactivityTimeoutStr) {
    return true; // If no expiry time is set, consider session expired
  }
  
  const expiryTime = parseInt(expiryTimeStr, 10);
  const inactivityTimeout = parseInt(inactivityTimeoutStr, 10);
  const currentTime = Date.now();
  
  // Session is expired if either the token is expired or user has been inactive
  return currentTime > expiryTime || currentTime > inactivityTimeout;
}

/**
 * Get the refresh token from localStorage.
 * @returns The refresh token string or null if not found.
 */
export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
}

/**
 * Set the refresh token in localStorage.
 * @param token The refresh token string.
 */
export function setRefreshToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

/**
 * Remove the refresh token from localStorage.
 */
export function removeRefreshToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

/**
 * Clear all session data, including tokens and expiry times.
 */
export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    localStorage.removeItem(INACTIVITY_TIMEOUT_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY); // Also remove refresh token
  }
}

/**
 * Setup activity listeners to reset inactivity timer
 */
export function setupActivityListeners() {
  if (typeof window !== 'undefined') {
    // Reset inactivity timer on user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, () => resetInactivityTimer());
    });
  }
}

/**
 * Get remaining session time in seconds
 * @returns Remaining session time in seconds
 */
export function getRemainingSessionTime(): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  const expiryTimeStr = localStorage.getItem(SESSION_EXPIRY_KEY);
  
  if (!expiryTimeStr) {
    return 0;
  }
  
  const expiryTime = parseInt(expiryTimeStr, 10);
  const currentTime = Date.now();
  
  return Math.max(0, Math.floor((expiryTime - currentTime) / 1000));
}
