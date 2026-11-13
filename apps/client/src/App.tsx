import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, GuestRoute, RequireAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import LandingPage from './pages/LandingPage.js';
import LoginPage from './pages/LoginPage.js';
import RegisterPage from './pages/RegisterPage.js';
import DashboardPage from './pages/DashboardPage.js';
import ReadingsPage from './pages/ReadingsPage.js';
import ReportsPage from './pages/ReportsPage.js';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          index
          element={
            <GuestRoute>
              <LandingPage />
            </GuestRoute>
          }
        />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="today" element={<DashboardPage />} />
            <Route path="readings" element={<ReadingsPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
        </Route>

        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
