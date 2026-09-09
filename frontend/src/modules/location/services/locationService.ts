/**
 * Expo Location Service Implementation
 * Handles GPS coordinate acquisition, live tracking subscriptions, reverse geocoding, and permission checks.
 */

import * as Location from 'expo-location';
import { LocationData, Coordinates, AddressDetails } from '../types/location.types';
import { logger } from '../../../utils/logger';

export class LocationService {
  private static instance: LocationService;
  private watchSubscription: Location.LocationSubscription | null = null;
  private lastKnownLocation: LocationData | null = null;

  private constructor() {}

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Request foreground location permission from device
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status === 'granted') {
        return true;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      logger.info(`Location permission status: [${status}]`);
      return granted;
    } catch (err) {
      logger.error('Failed to request location permissions:', err);
      return false;
    }
  }

  /**
   * Get current GPS location and reverse geocode human-readable address
   */
  public async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        logger.warn('Location permission denied. Returning cached or default fallback location.');
        return this.lastKnownLocation || this.getDefaultFallbackLocation();
      }

      // 1. Try fast last known position first (available immediately on device)
      let loc: Location.LocationObject | null = null;
      try {
        loc = await Location.getLastKnownPositionAsync({});
      } catch (e) {
        // Fallback to active GPS fix
      }

      // 2. Query fresh GPS position
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      }

      if (!loc) {
        return this.lastKnownLocation || this.getDefaultFallbackLocation();
      }

      const coordinates: Coordinates = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        altitude: loc.coords.altitude,
        accuracy: loc.coords.accuracy,
      };

      const address = await this.reverseGeocode(loc.coords.latitude, loc.coords.longitude);

      const locationData: LocationData = {
        coordinates,
        address: address || undefined,
        timestamp: new Date(loc.timestamp).toISOString(),
      };

      this.lastKnownLocation = locationData;
      return locationData;
    } catch (err) {
      logger.error('Error fetching current position:', err);
      return this.lastKnownLocation || this.getDefaultFallbackLocation();
    }
  }

  /**
   * Reverse geocode latitude and longitude to street address
   */
  public async reverseGeocode(latitude: number, longitude: number): Promise<AddressDetails | null> {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const item = results[0];
        const formattedAddress = [item.name, item.street, item.city, item.region, item.postalCode]
          .filter(Boolean)
          .join(', ');

        return {
          street: item.street || item.name,
          city: item.city,
          region: item.region,
          postalCode: item.postalCode,
          country: item.country,
          formattedAddress: formattedAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        };
      }
    } catch (err) {
      logger.error('Reverse geocoding failed:', err);
    }

    return {
      formattedAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    };
  }

  /**
   * Calculate Haversine distance between two coordinates in kilometers
   */
  public calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * Estimate Arrival Time (in minutes) based on remaining distance and average speed (km/h)
   */
  public calculateETA(distanceKm: number, averageSpeedKmH: number = 15): number {
    if (distanceKm <= 0) return 0;
    const timeHours = distanceKm / averageSpeedKmH;
    return Math.max(1, Math.ceil(timeHours * 60));
  }

  /**
   * Check if user is inside a target geofence radius (in meters)
   */
  public isInsideGeofence(
    currentLat: number,
    currentLng: number,
    centerLat: number,
    centerLng: number,
    radiusMeters: number = 500
  ): boolean {
    const distKm = this.calculateDistanceKm(currentLat, currentLng, centerLat, centerLng);
    return distKm * 1000 <= radiusMeters;
  }

  /**
   * Start live GPS position tracking with 4-5s interval updates
   */
  public async startLocationTracking(
    callback: (location: LocationData) => void
  ): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      if (this.watchSubscription) {
        this.watchSubscription.remove();
      }

      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000, // 4 seconds auto update
          distanceInterval: 5,
        },
        async (loc) => {
          const coordinates: Coordinates = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy,
          };
          const address = await this.reverseGeocode(loc.coords.latitude, loc.coords.longitude);
          const locationData: LocationData = {
            coordinates,
            address: address || undefined,
            timestamp: new Date(loc.timestamp).toISOString(),
          };
          this.lastKnownLocation = locationData;
          callback(locationData);
        }
      );
      logger.info('Live GPS location tracking started with 4-5s auto-update interval.');
    } catch (err) {
      logger.error('Failed to start location tracking:', err);
    }
  }

  /**
   * Stop live GPS tracking subscription
   */
  public stopLocationTracking(): void {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
      logger.info('Live GPS location tracking stopped.');
    }
  }

  public getLastKnownLocation(): LocationData | null {
    return this.lastKnownLocation;
  }

  private getDefaultFallbackLocation(): LocationData {
    return {
      coordinates: {
        latitude: 16.5062,
        longitude: 80.6480,
      },
      address: {
        formattedAddress: 'Vijayawada, Andhra Pradesh',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export const locationService = LocationService.getInstance();

