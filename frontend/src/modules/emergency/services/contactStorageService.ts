/**
 * Storage Service for Emergency Contacts Persistence using AsyncStorage
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { PhoneContact } from "../../../data/mock";

const CONTACTS_STORAGE_KEY = "@aegis_safety_circle";
const LEGACY_CONTACTS_STORAGE_KEY = "@aegis_emergency_contacts";

export const contactStorageService = {
  async getStoredEmergencyContacts(): Promise<PhoneContact[]> {
    try {
      const json = await AsyncStorage.getItem(CONTACTS_STORAGE_KEY);
      if (json) return JSON.parse(json) as PhoneContact[];

      // One-time migration: a device with contacts cached under the old key shouldn't
      // appear empty after this rename. Read the old key once and copy it forward.
      const legacyJson = await AsyncStorage.getItem(LEGACY_CONTACTS_STORAGE_KEY);
      if (!legacyJson) return [];
      const legacyContacts = JSON.parse(legacyJson) as PhoneContact[];
      await AsyncStorage.setItem(CONTACTS_STORAGE_KEY, legacyJson);
      return legacyContacts;
    } catch (err) {
      console.error("Failed to read emergency contacts from storage", err);
      return [];
    }
  },

  async saveEmergencyContacts(contacts: PhoneContact[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
    } catch (err) {
      console.error("Failed to save emergency contacts to storage", err);
    }
  },

  async clearEmergencyContacts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CONTACTS_STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear emergency contacts from storage", err);
    }
  },
};
