import { config } from '../config/index.js';

export const thresholds = {
  // API Thresholds
  get API_LATENCY_WARNING_MS() {
    return config.monitoring.apiLatencyWarningMs;
  },
  get API_LATENCY_CRITICAL_MS() {
    return config.monitoring.apiLatencyCriticalMs;
  },
  
  // Database Thresholds
  get DB_LATENCY_WARNING_MS() {
    return config.monitoring.dbLatencyWarningMs;
  },
  get DB_LATENCY_CRITICAL_MS() {
    return config.monitoring.dbLatencyCriticalMs;
  },

  // Queue Thresholds
  get QUEUE_DEPTH_WARNING() {
    return config.monitoring.queueDepthWarning;
  },
  get QUEUE_DEPTH_CRITICAL() {
    return config.monitoring.queueDepthCritical;
  },
  get QUEUE_WAIT_TIME_WARNING_MS() {
    return config.monitoring.queueWaitTimeWarningMs;
  },
  get QUEUE_WAIT_TIME_CRITICAL_MS() {
    return config.monitoring.queueWaitTimeCriticalMs;
  },

  // AI Thresholds
  get AI_GENERATION_WARNING_MS() {
    return config.monitoring.aiGenerationWarningMs;
  },
  get AI_GENERATION_CRITICAL_MS() {
    return config.monitoring.aiGenerationCriticalMs;
  },
};
