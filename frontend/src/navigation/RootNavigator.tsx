import React, { useRef } from 'react';
import { PetFoundScreen } from '../screens/shared/PetFoundScreen';
import { useScannedPet, closeScannedPet } from '../utils/petLink';
import { useAuth } from '../context/AuthContext';
import { LoadingView } from '../components/common/LoadingView';
import { AuthNavigator } from './AuthNavigator';
import { CustomerNavigator } from './CustomerNavigator';
import { DoctorNavigator } from './DoctorNavigator';
import { AdminNavigator } from './AdminNavigator';
import { ProviderNavigator } from './ProviderNavigator';

export const RootNavigator: React.FC = () => {
  const { user, isLoading } = useAuth();
  const scanned = useScannedPet();

  // Only block on the initial session restore; login/logout toggle isLoading too and must not
  // unmount the auth stack (that would reset the form after a failed login).
  const booted = useRef(false);
  if (!isLoading) booted.current = true;
  // a pet's QR code was scanned: show its owner's details first, whether or not anyone is signed in (even while the session is still loading)
  if (scanned) return <PetFoundScreen number={scanned} onClose={closeScannedPet} />;

  if (!booted.current) return <LoadingView message="Starting Jenni..." />;

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
