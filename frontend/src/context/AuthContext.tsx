import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, AuthResponseData, LoginPayload, RegisterPayload, RegistrationResult } from '../api/authApi';
import { clearTokens, onSessionExpired, saveTokens, storage } from '../api/client';

const USER_STORAGE_KEY = 'vetconnect_user_data';

interface AuthContextType {
  user: AuthResponseData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<AuthResponseData>;
  register: (payload: RegisterPayload) => Promise<RegistrationResult>;
  verifyOtp: (mobile: string, otp: string) => Promise<AuthResponseData>;
  logout: () => Promise<void>;
  updateUserData: (updated: Partial<AuthResponseData>) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthResponseData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const savedUserStr = await storage.getItem(USER_STORAGE_KEY);
        if (savedUserStr) {
          const savedUser = JSON.parse(savedUserStr);
          setUser(savedUser);
        }
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
    await storage.setItem(USER_STORAGE_KEY, JSON.stringify(authData));
    setUser(authData);
    return authData;
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout().catch(() => {});
    } finally {
      await clearTokens();
      await storage.removeItem(USER_STORAGE_KEY);
      setUser(null);
      setIsLoading(false);
    }
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
        login,
        register,
        verifyOtp,
        logout,
        updateUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
