import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, GuestRoute, RequireAuth, RequireRole } from './context/AuthContext.js';
import { PatientLayout } from './components/layout/PatientLayout.js';
import { DoctorLayout } from './components/layout/DoctorLayout.js';
import LandingPage from './pages/LandingPage.js';
import LoginPage from './pages/LoginPage.js';
import RegisterPage from './pages/RegisterPage.js';
import DashboardPage from './pages/DashboardPage.js';
import ReadingsPage from './pages/ReadingsPage.js';
import ReportsPage from './pages/ReportsPage.js';
import CareTeamPage from './pages/CareTeamPage.js';
import DoctorDashboardPage from './pages/DoctorDashboardPage.js';
import DoctorPatientsPage from './pages/DoctorPatientsPage.js';
import DoctorPatientPage from './pages/DoctorPatientPage.js';
import DoctorInvitationsPage from './pages/DoctorInvitationsPage.js';

/** Keeps old Phase 13 bookmarks working after the /doctor move. */
function LegacyPatientRedirect() {
  const { patientId } = useParams<{ patientId: string }>();

  return <Navigate to={patientId ? `/doctor/patients/${patientId}` : '/doctor/patients'} replace />;
}

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
          <Route element={<RequireRole role="patient" />}>
            {/* The patient home is /today; this alias keeps /patient/dashboard working. */}
            <Route path="patient/dashboard" element={<Navigate to="/today" replace />} />

            <Route element={<PatientLayout />}>
              <Route path="today" element={<DashboardPage />} />
              <Route path="readings" element={<ReadingsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="care-team" element={<CareTeamPage />} />
            </Route>
          </Route>

          <Route element={<RequireRole role="doctor" />}>
            <Route element={<DoctorLayout />}>
              <Route path="doctor/dashboard" element={<DoctorDashboardPage />} />
              <Route path="doctor/patients" element={<DoctorPatientsPage />} />
              <Route path="doctor/patients/:patientId" element={<DoctorPatientPage />} />
              <Route path="doctor/invitations" element={<DoctorInvitationsPage />} />

              <Route path="patients" element={<LegacyPatientRedirect />} />
              <Route path="patients/:patientId" element={<LegacyPatientRedirect />} />
            </Route>
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
