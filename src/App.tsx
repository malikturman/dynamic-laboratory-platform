import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminPage } from './pages/AdminPage';
import { CalculationPage } from './pages/CalculationPage';
import { DashboardPage } from './pages/DashboardPage';
import { DevelopmentModulePage } from './pages/DevelopmentModulePage';
import { HistoryPage } from './pages/HistoryPage';
import { LaboratoryPage } from './pages/LaboratoryPage';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/laboratories/:labId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LaboratoryPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/laboratories/:labId/indicators/:indicatorId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CalculationPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/modules/:moduleId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DevelopmentModulePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AppLayout>
              <HistoryPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      {/* TODO(sample-reports): add protected /samples/:sampleId route for the combined sample page. */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AppLayout>
              <AdminPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
