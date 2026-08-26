/**
 * Central API Endpoint Definitions
 * Aligned with FastAPI Backend Routers
 */

export const API_ENDPOINTS = {
  // Health
  HEALTH: '/api/v1/health',

  // AI Service (ai-service/router.py)
  AI_QUERY: '/api/v1/ai/query',
  AI_EMERGENCY_GUIDANCE: '/api/v1/ai/emergency',

  // Emergency Service (emergency-service/router.py)
  EMERGENCY_ALERT: '/api/v1/emergency/alert',
  EMERGENCY_PRESIGNED_URL: '/api/v1/emergency/presigned-url',
  EMERGENCY_HISTORY: '/api/v1/emergency/history',

  // Incident Timeline — Module 19 (Incident Timeline System)
  INCIDENTS: '/api/v1/incidents',
  EMERGENCY_INCIDENTS_SYNC: '/api/v1/emergency/incidents/sync',
  EMERGENCY_INCIDENTS_HISTORY: '/api/v1/emergency/incidents/history',

  // User Service (user-service/router.py)
  USER_PROFILE: '/api/v1/user/profile',
  USER_HISTORY: '/api/v1/user/history',
  USER_CONTACTS: '/api/v1/user/contacts',

  // GPS Service (gps-service/router.py)
  GPS_NEARBY: '/api/v1/gps/nearby',

  // Notification Service (notification-service/router.py)
  NOTIFICATION_SEND: '/api/v1/notification/send',

  // Auth Service (authentication-service/router.py)
  AUTH_VERIFY_TOKEN: '/api/v1/auth/verify-token',
} as const;
