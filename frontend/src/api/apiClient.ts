/**
 * Central Production Axios API Client Instance
 * Configured with Base URL, 10s Timeout, Auth Interceptors,
 * Detailed Request/Response Logging, Response Error Formatters, and Retry Strategy.
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { API_CONFIG } from './apiConfig';
import { handleApiError, FormattedApiError } from './apiErrorHandler';
import { firebaseAuthService } from '../infrastructure/auth/firebaseAuthService';
import { networkMonitor } from './networkMonitor';
import { logger } from '../utils/logger';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: { startTime: number };
  _retryCount?: number;
}

// Create Central Axios Instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

// Request Interceptor: Attach Auth ID Token and Log Request Metadata
apiClient.interceptors.request.use(
  async (config: CustomAxiosRequestConfig) => {
    config.metadata = { startTime: Date.now() };
    const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
    console.log(`🚀 [API Request Outgoing] [${config.method?.toUpperCase()}] Full URL: ${fullUrl}`);

    // When uploading FormData (e.g. face images, evidence), delete Content-Type so React Native / Axios adds multipart/form-data with the correct boundary
    if (config.data instanceof FormData || (config.data && typeof (config.data as any).getParts === 'function')) {
      delete config.headers['Content-Type'];
    }

    try {
      const token = await firebaseAuthService.getIdToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      logger.warn('Failed to retrieve Auth ID Token for request:', err);
    }
    return config;
  },
  (error) => {
    console.error('❌ [API Request Error]:', error);
    return Promise.reject(error);
  }
);

// Response Interceptor: Detailed Response Time & Status Logging + Error Formatting
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as CustomAxiosRequestConfig;
    const startTime = config.metadata?.startTime || Date.now();
    const duration = Date.now() - startTime;
    const fullUrl = `${config.baseURL || ''}${config.url || ''}`;

    console.log(
      `✅ [API Response Success] [${config.method?.toUpperCase()}] Full URL: ${fullUrl} | Status: ${response.status} | Time: ${duration}ms`
    );

    networkMonitor.setOnlineStatus(true);
    return response;
  },
  async (error) => {
    const config = (error.config || {}) as CustomAxiosRequestConfig;
    const startTime = config.metadata?.startTime || Date.now();
    const duration = Date.now() - startTime;
    const fullUrl = `${config.baseURL || ''}${config.url || ''}`;

    console.error(
      `❌ [API Response Failed] [${config.method?.toUpperCase()}] Full URL: ${fullUrl} | Time: ${duration}ms | Error:`,
      error.message || error
    );

    const formattedError: FormattedApiError = handleApiError(error);

    if (formattedError.isNetworkError) {
      networkMonitor.setOnlineStatus(false);
    }

    // Retry Strategy for idempotent GET requests or transient network timeouts (max 2 retries)
    if (config && formattedError.isNetworkError && (!config._retryCount || config._retryCount < API_CONFIG.maxRetries)) {
      config._retryCount = (config._retryCount || 0) + 1;
      logger.info(`Retrying API Request [Attempt ${config._retryCount}/${API_CONFIG.maxRetries}] to ${fullUrl}...`);
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.retryDelayMs * config._retryCount!));
      return apiClient(config);
    }

    return Promise.reject(formattedError);
  }
);
