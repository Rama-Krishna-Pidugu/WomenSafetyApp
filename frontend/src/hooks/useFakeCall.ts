/**
 * Module 8: Fake Call Generator Custom Hook
 * Connects Fake Call UI to the fakeCallService layer and manages call state & timers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fakeCallService } from '../services/fakeCallService';
import { ApiError } from '../types/api';
import { CallerProfile, FakeCallState } from '../types/fakeCall';
import { parseError } from '../utils/errorHandler';

export function useFakeCall() {
  const [profiles, setProfiles] = useState<CallerProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<CallerProfile | null>(null);
  const [callState, setCallState] = useState<FakeCallState>({
    isCallActive: false,
    isRinging: false,
    scheduledTime: null,
    activeProfile: null,
    durationSeconds: 0,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Fetch available caller profiles
   */
  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fakeCallService.getCallerProfiles();
      setProfiles(data);
      if (data.length > 0 && !activeProfile) {
        setActiveProfile(data[0]);
      }
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    fetchProfiles();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [fetchProfiles]);

  /**
   * Trigger an instant fake call screen
   */
  const triggerInstantCall = useCallback(async (profile?: CallerProfile) => {
    const targetProfile = profile || activeProfile || profiles[0];
    if (!targetProfile) return;

    setIsLoading(true);
    setError(null);

    try {
      await fakeCallService.triggerImmediateFakeCall();

      setCallState({
        isCallActive: true,
        isRinging: true,
        scheduledTime: null,
        activeProfile: targetProfile,
        durationSeconds: 0,
      });
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile, profiles]);

  /**
   * Schedule a call after specified delay in seconds
   */
  const scheduleCall = useCallback(async (delaySeconds: number, profile?: CallerProfile) => {
    const targetProfile = profile || activeProfile || profiles[0];
    if (!targetProfile) return;

    setIsLoading(true);
    setError(null);

    try {
      await fakeCallService.scheduleFakeCall(delaySeconds);

      const triggerTimestamp = Date.now() + delaySeconds * 1000;
      setCallState((prev) => ({
        ...prev,
        scheduledTime: triggerTimestamp,
        activeProfile: targetProfile,
      }));

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        setCallState({
          isCallActive: true,
          isRinging: true,
          scheduledTime: null,
          activeProfile: targetProfile,
          durationSeconds: 0,
        });
      }, delaySeconds * 1000);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile, profiles]);

  /**
   * Accept incoming call & start duration timer
   */
  const acceptCall = useCallback(() => {
    setCallState((prev) => ({ ...prev, isRinging: false, durationSeconds: 0 }));

    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

    durationIntervalRef.current = setInterval(() => {
      setCallState((prev) => ({ ...prev, durationSeconds: prev.durationSeconds + 1 }));
    }, 1000);
  }, []);

  /**
   * End or decline fake call
   */
  const endCall = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);

    setCallState({
      isCallActive: false,
      isRinging: false,
      scheduledTime: null,
      activeProfile: null,
      durationSeconds: 0,
    });
  }, []);

  return {
    profiles,
    activeProfile,
    setActiveProfile,
    callState,
    isLoading,
    error,
    fetchProfiles,
    triggerInstantCall,
    scheduleCall,
    acceptCall,
    endCall,
  };
}
