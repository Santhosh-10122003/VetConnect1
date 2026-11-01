import { storage } from '../api/client';

const JUST_REGISTERED_KEY = 'vetconnect_just_registered';
const GUIDE_SEEN_PREFIX = 'vetconnect_guide_seen_';

/** Returns whether the user has just registered in this session. */
export const isNewUserRegistered = async (): Promise<boolean> => {
  try {
    const val = await storage.getItem(JUST_REGISTERED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
};

/** Mark that a user has just successfully completed registration. */
export const setNewUserRegistered = async (): Promise<void> => {
  try {
    await storage.setItem(JUST_REGISTERED_KEY, 'true');
  } catch (e) {
    console.warn('Failed to set new registration flag', e);
  }
};

/** Clears the one-time registration flag. */
export const clearNewUserRegistered = async (): Promise<void> => {
  try {
    await storage.removeItem(JUST_REGISTERED_KEY);
  } catch (e) {
    console.warn('Failed to clear new registration flag', e);
  }
};

/** Returns whether a specific user has seen/completed the screen guide. */
export const hasSeenGuide = async (userId: number | string): Promise<boolean> => {
  try {
    const val = await storage.getItem(`${GUIDE_SEEN_PREFIX}${userId}`);
    return val === 'true';
  } catch {
    return false;
  }
};

/** Marks the screen guide as seen for a specific user and clears the just-registered flag. */
export const markGuideSeen = async (userId: number | string): Promise<void> => {
  try {
    await storage.setItem(`${GUIDE_SEEN_PREFIX}${userId}`, 'true');
    await clearNewUserRegistered();
  } catch (e) {
    console.warn('Failed to mark guide as seen', e);
  }
};

/** Resets guide completion status (e.g. for retaking the tour). */
export const resetGuideSeen = async (userId: number | string): Promise<void> => {
  try {
    await storage.removeItem(`${GUIDE_SEEN_PREFIX}${userId}`);
  } catch (e) {
    console.warn('Failed to reset guide seen flag', e);
  }
};

