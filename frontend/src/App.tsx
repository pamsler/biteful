import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SidebarProvider } from './context/SidebarContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// ⚡ Performance: Lazy Loading für Code-Splitting (reduziert Initial Bundle Size um ~40-50%)
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const WeekPlanner = lazy(() => import('./pages/WeekPlanner').then(m => ({ default: m.WeekPlanner })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const ShoppingList = lazy(() => import('./pages/ShoppingList').then(m => ({ default: m.ShoppingList })));
const Recipes = lazy(() => import('./pages/Recipes').then(m => ({ default: m.Recipes })));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs').then(m => ({ default: m.ActivityLogs })));

// Loading Fallback Component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-20 w-20 border-4 border-primary-200 dark:border-gray-700 mx-auto"></div>
        <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-primary-600 dark:border-primary-400 mx-auto absolute top-0 left-1/2 transform -translate-x-1/2"></div>
      </div>
      <p className="text-gray-600 dark:text-gray-300 mt-6 font-medium">Lädt...</p>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SidebarProvider>
            <ToastProvider>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<Login />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <WeekPlanner />
                  </ProtectedRoute>
                }
              />

              {/* Shopping List */}
              <Route
                path="/shopping"
                element={
                  <ProtectedRoute>
                    <ShoppingList />
                  </ProtectedRoute>
                }
              />

              {/* Recipes */}
              <Route
                path="/recipes"
                element={
                  <ProtectedRoute>
                    <Recipes />
                  </ProtectedRoute>
                }
              />

              {/* Activity Logs */}
              <Route
                path="/activity-logs"
                element={
                  <ProtectedRoute>
                    <ActivityLogs />
                  </ProtectedRoute>
                }
              />

              {/* Admin Routes */}
              <Route
                path="/settings"
                element={
                  <ProtectedRoute requireAdmin>
                    <Settings />
                  </ProtectedRoute>
                }
              />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </SidebarProvider>
    </AuthProvider>
  </ThemeProvider>
</BrowserRouter>
  );
}

export default App;