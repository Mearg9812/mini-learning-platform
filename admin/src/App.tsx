import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Videos from './pages/Videos';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Users from './pages/Users';
import Enrollments from './pages/Enrollments';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* PUBLIC ROUTE: Anyone can see this */}
        <Route path="/login" element={<Login />} />
        
        {/* PROTECTED ROUTES: Wrapped inside the Bouncer! */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* These are the pages that get injected into the <Outlet /> hole in Layout.tsx */}
          <Route index element={<Navigate to="/dashboard/videos" replace />} /> {/* Auto-redirect to videos */}
          <Route path="videos" element={<Videos />} /> 
          <Route path="enrollment/enroll-students" element={<Enrollments />} />
          <Route path="enrollment/students" element={<Users section="students" />} />
          <Route path="enrollments" element={<Navigate to="/dashboard/enrollment/enroll-students" replace />} />
          <Route path="users" element={<Users section="admins" />} />
        </Route>
        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/login" replace />} />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;
