import React, { createContext, useContext, useEffect, useState } from 'react';
import { takeDocuments } from '../utils/pendingDocuments';
import { documentApi } from '../api/documentApi';
import { notify } from '../utils/helpers';
import { authApi, AuthResponseData, LoginPayload, RegisterPayload, RegistrationResult } from '../api/authApi';
import { clearTokens, onSessionExpired, saveTokens, storage } from '../api/client';
import { clearNewUserRegistered, isNewUserRegistered as checkIsNewUserRegistered, setNewUserRegistered } from '../utils/guideStorage';

const USER_STORAGE_KEY = 'vetconnect_user_data';

interface AuthContextType {
  user: AuthResponseData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isNewRegistration: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponseData>;
  register: (payload: RegisterPayload) => Promise<RegistrationResult>;
  verifyOtp: (mobile: string, otp: string) => Promise<AuthResponseData>;
  logout: () => Promise<void>;
  updateUserData: (updated: Partial<AuthResponseData>) => void;
  clearNewRegistrationFlag: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthResponseData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNewRegistration, setIsNewRegistration] = useState<boolean>(false);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const savedUserStr = await storage.getItem(USER_STORAGE_KEY);
        if (savedUserStr) {
          const savedUser = JSON.parse(savedUserStr);
          setUser(savedUser);
        }
        // Restoring existing session is not a new registration
        await clearNewUserRegistered();
        setIsNewRegistration(false);
      } catch (e) {
        console.warn('Failed to restore auth session', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  // Refresh failed: drop the saved user so the navigator shows the login screen
  useEffect(() => {
    onSessionExpired(() => {
      storage.removeItem(USER_STORAGE_KEY);
      clearNewUserRegistered();
      setIsNewRegistration(false);
      setUser(null);
    });
    return () => onSessionExpired(null);
  }, []);

  const login = async (payload: LoginPayload): Promise<AuthResponseData> => {
    setIsLoading(true);
    try {
      const res = await authApi.login(payload);
      const authData = res.data;
      await saveTokens(authData.accessToken, authData.refreshToken);
      await storage.setItem(USER_STORAGE_KEY, JSON.stringify(authData));
      // Normal logins should NEVER be treated as new user registrations
      await clearNewUserRegistered();
      setIsNewRegistration(false);
      setUser(authData);
      return authData;
    } finally {
      setIsLoading(false);
    }
  };

  /** Creates the account only; the user is signed in later, by {@link verifyOtp}. */
  const register = async (payload: RegisterPayload): Promise<RegistrationResult> => {
    return (await authApi.register(payload)).data;
  };

  const verifyOtp = async (mobile: string, otp: string): Promise<AuthResponseData> => {
    const res = await authApi.verifyOtp(mobile, otp);
    const authData = res.data;
    await saveTokens(authData.accessToken, authData.refreshToken);
    // certificates picked on the sign-up form go up now that there is a signed-in account to own them
    const queued = takeDocuments();
    let notSent = 0;
    for (const d of queued) {
      try { await documentApi.upload(d.type, d.file); } catch { notSent++; }
    }
    await storage.setItem(USER_STORAGE_KEY, JSON.stringify(authData));
    // Set flag ONLY here when user completes registration
    await setNewUserRegistered();
    setIsNewRegistration(true);
    setUser(authData);
    if (notSent > 0) notify('Some documents were not uploaded', `${notSent} of ${queued.length} could not be uploaded. Add them from your Profile.`);
    return authData;
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout().catch(() => {});
    } finally {
      await clearTokens();
      await storage.removeItem(USER_STORAGE_KEY);
      await clearNewUserRegistered();
      setIsNewRegistration(false);
      setUser(null);
      setIsLoading(false);
    }
  };

  const clearNewRegistrationFlag = () => {
    setIsNewRegistration(false);
    clearNewUserRegistered();
  };

  const updateUserData = (updated: Partial<AuthResponseData>) => {
    if (user) {
      const newUser = { ...user, ...updated };
      setUser(newUser);
      storage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isNewRegistration,
        login,
        register,
        verifyOtp,
        logout,
        updateUserData,
        clearNewRegistrationFlag,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
