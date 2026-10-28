import React, { useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoadingView } from '../components/common/LoadingView';
import { AuthNavigator } from './AuthNavigator';
import { CustomerNavigator } from './CustomerNavigator';
import { DoctorNavigator } from './DoctorNavigator';
import { AdminNavigator } from './AdminNavigator';
import { ProviderNavigator } from './ProviderNavigator';

export const RootNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();

  // Only block on the initial session restore; login/logout toggle isLoading too and must not
  // unmount the auth stack (that would reset the form after a failed login).
  const booted = useRef(false);
  if (!isLoading) booted.current = true;
  if (!booted.current) return <LoadingView message="Starting VetConnect..." />;

  if (!user) return <AuthNavigator />;

  switch (user.role) {
    case 'ROLE_DOCTOR':
      return <DoctorNavigator />;
    case 'ROLE_PROVIDER':
      return <ProviderNavigator />;
    case 'ROLE_ADMIN':
      return <AdminNavigator />;
    default:
      return <CustomerNavigator />;
  }
};
