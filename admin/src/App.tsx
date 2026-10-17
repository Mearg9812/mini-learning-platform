import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Videos from "./pages/Videos";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Users from "./pages/Users";
import Enrollments from "./pages/Enrollments";
import Notifications from "./pages/Notifications";
import Security from "./pages/Security";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTE: */}
        <Route path="/login" element={<Login />} />

        {/* PROTECTED ROUTES */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard/videos" replace />} />
          <Route path="videos" element={<Videos />} />
          <Route path="enrollment/enroll-students" element={<Enrollments />} />
          <Route
            path="enrollment/students"
            element={<Users section="students" />}
          />
          <Route
            path="enrollments"
            element={
              <Navigate to="/dashboard/enrollment/enroll-students" replace />
            }
          />
          <Route path="users" element={<Users section="admins" />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="security" element={<Security />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
