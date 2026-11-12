import { Navigate } from 'react-router-dom';

export const route = {
  path: '/change-password',
  layout: 'owner',
  access: 'authenticated',
};

// Password changes live on the profile page now.
export default function ChangePassword() {
  return <Navigate to="/account#sign-in" replace />;
}
