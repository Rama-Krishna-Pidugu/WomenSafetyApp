import AsyncStorage from "@react-native-async-storage/async-storage";
import { contactStorageService } from "./contactStorageService";
import { PhoneContact } from "../../../data/mock";

const CONTACT: PhoneContact = {
  id: "c1",
  name: "Mom",
  initials: "MO",
  phone: "+911234567890",
  relation: "MOTHER",
  priority: 1,
};

describe("contactStorageService — key rename + legacy migration", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("reads from the new @aegis_safety_circle key when present", async () => {
    await AsyncStorage.setItem("@aegis_safety_circle", JSON.stringify([CONTACT]));

    const result = await contactStorageService.getStoredEmergencyContacts();

    expect(result).toEqual([CONTACT]);
  });

  it("migrates data from the legacy @aegis_emergency_contacts key when the new key is empty", async () => {
    await AsyncStorage.setItem("@aegis_emergency_contacts", JSON.stringify([CONTACT]));

    const result = await contactStorageService.getStoredEmergencyContacts();

    expect(result).toEqual([CONTACT]);
    const migrated = await AsyncStorage.getItem("@aegis_safety_circle");
    expect(JSON.parse(migrated as string)).toEqual([CONTACT]);
  });

  it("returns an empty array when neither key has data", async () => {
    const result = await contactStorageService.getStoredEmergencyContacts();
    expect(result).toEqual([]);
  });

  it("saveEmergencyContacts writes to the new key", async () => {
    await contactStorageService.saveEmergencyContacts([CONTACT]);
    const stored = await AsyncStorage.getItem("@aegis_safety_circle");
    expect(JSON.parse(stored as string)).toEqual([CONTACT]);
  });
});
