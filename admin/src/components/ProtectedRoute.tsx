import React from 'react';
import { Navigate } from 'react-router-dom';

// "children" is whatever we wrap inside this component (like the Dashboard page)
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Check if they have a token in their browser memory
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  // If there is NO token, immediately kick them back to the login page
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return <Navigate to="/login" replace />;
  }

  // If they DO have a token, let them see the page!
  return <>{children}</>;
}
