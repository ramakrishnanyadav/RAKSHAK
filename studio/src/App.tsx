/**
 * ADAPTIVE-PATH Studio Main Application Router.
 * Configures React Router, TanStack Query, I18nProvider, SettingsProvider,
 * AuthProvider, AnnouncerProvider, and global keyboard shortcuts modal.
 * Fulfills all hard WCAG 2.2 AA accessibility requirements with zero 'any' types.
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { I18nProvider } from './context/I18nContext';
import { AnnouncerProvider, useAnnouncer } from './components/LiveAnnouncer';

import { HeaderBar } from './components/HeaderBar';
import { NavigationRail } from './components/NavigationRail';
import { KeyboardHelpModal } from './components/KeyboardHelpModal';

// Screens
import { Landing } from './pages/Landing';
import { Demo } from './pages/Demo';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { ResetPassword } from './pages/ResetPassword';
import { Dashboard } from './pages/Dashboard';
import { Scenarios } from './pages/Scenarios';
import { ScenarioDetail } from './pages/ScenarioDetail';
import { NewRun } from './pages/NewRun';
import { ReplayView } from './pages/ReplayView';
import { CompareView } from './pages/CompareView';
import { BenchmarkView } from './pages/BenchmarkView';
import { FailuresView } from './pages/FailuresView';
import { ReportsView } from './pages/ReportsView';
import { SettingsView } from './pages/SettingsView';
import { AdminView } from './pages/AdminView';
import { NotFound } from './pages/NotFound';
import { SceneWorkstation } from './components/scene/SceneWorkstation';
import { MatlabValidationView } from './pages/MatlabValidationView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Studio Application Shell Layout
const StudioLayout: React.FC<{ isBackendConnected: boolean }> = ({ isBackendConnected }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const location = useLocation();
  const { announce } = useAnnouncer();

  // Focus management and page title announcement after route changes (WCAG 2.4.3 & 2.4.2)
  useEffect(() => {
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.focus();
    }
    const routeTitles: Record<string, string> = {
      '/app': 'Dashboard',
      '/app/workstation': '3D Workstation',
      '/app/matlab': 'MATLAB SIL Validation Studio',
      '/app/scenarios': 'Scenarios Library',
      '/app/runs/new': 'Launch Simulation Run',
      '/app/runs': 'Simulation Replay Viewer',
      '/app/experiments': 'Experiment Directory',
      '/app/compare': 'Comparative Replay',
      '/app/benchmark': 'Ablation Benchmark',
      '/app/failures': 'Failure Explorer',
      '/app/reports': 'Audit & Validation Reports',
      '/app/settings/profile': 'User Profile & Settings',
    };
    const title = routeTitles[location.pathname] || 'Simulation Studio';
    document.title = `${title} | ADAPTIVE-PATH Studio`;
    announce(`Navigated to ${title}`, 'polite');
  }, [location.pathname, announce]);

  // Global '?' key listener to trigger keyboard shortcuts modal
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      <HeaderBar
        onOpenKeyboardHelp={() => setIsHelpOpen(true)}
        isBackendConnected={isBackendConnected}
      />

      <div
        style={{
          display: 'flex',
          flex: 1,
          width: '100%',
        }}
      >
        <NavigationRail />

        <main
          id="main-content"
          tabIndex={-1}
          style={{
            flex: 1,
            overflowY: 'auto',
            minWidth: 0,
            outline: 'none',
          }}
        >
          <Outlet />
        </main>
      </div>

      <KeyboardHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

const ParamRedirect: React.FC<{ to: string }> = ({ to }) => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `${to}/${id}` : to} replace />;
};

export const App: React.FC = () => {
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  // Ping backend to detect live vs offline mode
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('/api/runs?limit=1');
        if (res.ok) {
          setIsBackendConnected(true);
          return;
        }
      } catch {}
      setIsBackendConnected(false);
    };
    checkBackend();
    const interval = setInterval(checkBackend, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <I18nProvider>
          <AuthProvider>
            <AnnouncerProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public Entry Routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/index.html" element={<Landing />} />
                  <Route path="/demo" element={<Demo />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/reset" element={<ResetPassword />} />

                  {/* Root Aliases for Direct User Navigation & Typo Tolerance */}
                  <Route path="/matlab" element={<Navigate to="/app/matlab" replace />} />
                  <Route path="/matlab/:id" element={<Navigate to="/app/matlab" replace />} />
                  <Route path="/matlab-studio" element={<Navigate to="/app/matlab" replace />} />
                  <Route path="/matlab-studio/:id" element={<Navigate to="/app/matlab" replace />} />
                  <Route path="/simulink" element={<Navigate to="/app/matlab" replace />} />
                  <Route path="/sil" element={<Navigate to="/app/matlab" replace />} />
                  <Route path="/validation" element={<Navigate to="/app/matlab" replace />} />
                  <Route path="/workstation" element={<Navigate to="/app/workstation" replace />} />
                  <Route path="/workstation/:id" element={<Navigate to="/app/workstation" replace />} />
                  <Route path="/live" element={<Navigate to="/app/workstation" replace />} />
                  <Route path="/live/:id" element={<Navigate to="/app/workstation" replace />} />
                  <Route path="/live-simulation" element={<Navigate to="/app/workstation" replace />} />
                  <Route path="/live-simulation/:id" element={<Navigate to="/app/workstation" replace />} />
                  <Route path="/3d" element={<Navigate to="/app/workstation" replace />} />
                  <Route path="/dashboard" element={<Navigate to="/app" replace />} />
                  <Route path="/overview" element={<Navigate to="/app" replace />} />
                  <Route path="/scenarios" element={<Navigate to="/app/scenarios" replace />} />
                  <Route path="/scenario" element={<Navigate to="/app/scenarios" replace />} />
                  <Route path="/scenarios/:id" element={<ParamRedirect to="/app/scenarios" />} />
                  <Route path="/scenario/:id" element={<ParamRedirect to="/app/scenarios" />} />
                  <Route path="/runs" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/run" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/runs/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/run/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/runs/new" element={<Navigate to="/app/runs/new" replace />} />
                  <Route path="/results" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/results/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/test-results" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/test-results/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/test-history" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/test-history/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/experiments" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/experiment" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/experiments/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/experiment/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/experiment-runs" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/experiment-runs/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/replay" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/replays" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/replay/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/simulations" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/simulation" element={<Navigate to="/app/runs" replace />} />
                  <Route path="/simulation/:id" element={<ParamRedirect to="/app/runs" />} />
                  <Route path="/compare" element={<Navigate to="/app/compare" replace />} />
                  <Route path="/compare/:id" element={<Navigate to="/app/compare" replace />} />
                  <Route path="/benchmark" element={<Navigate to="/app/benchmark" replace />} />
                  <Route path="/benchmarks" element={<Navigate to="/app/benchmark" replace />} />
                  <Route path="/failures" element={<Navigate to="/app/failures" replace />} />
                  <Route path="/failure" element={<Navigate to="/app/failures" replace />} />
                  <Route path="/what-went-wrong" element={<Navigate to="/app/failures" replace />} />
                  <Route path="/reports" element={<Navigate to="/app/reports" replace />} />
                  <Route path="/report" element={<Navigate to="/app/reports" replace />} />
                  <Route path="/settings" element={<Navigate to="/app/settings/profile" replace />} />
                  <Route path="/settings/*" element={<Navigate to="/app/settings/profile" replace />} />
                  <Route path="/profile" element={<Navigate to="/app/settings/profile" replace />} />
                  <Route path="/studio" element={<Navigate to="/app" replace />} />
                  <Route path="/studio/*" element={<Navigate to="/app" replace />} />
                  <Route path="/home" element={<Navigate to="/app" replace />} />

                  {/* Authenticated / Guest Studio App Shell */}
                  <Route path="/app" element={<StudioLayout isBackendConnected={isBackendConnected} />}>
                    <Route index element={<Dashboard />} />
                    <Route path="index.html" element={<Navigate to="/app" replace />} />
                    <Route path="dashboard" element={<Navigate to="/app" replace />} />
                    <Route path="overview" element={<Navigate to="/app" replace />} />
                    <Route path="workstation" element={<SceneWorkstation />} />
                    <Route path="workstation/:id" element={<SceneWorkstation />} />
                    <Route path="live" element={<SceneWorkstation />} />
                    <Route path="live/:id" element={<SceneWorkstation />} />
                    <Route path="live-simulation" element={<SceneWorkstation />} />
                    <Route path="live-simulation/:id" element={<SceneWorkstation />} />
                    <Route path="matlab" element={<MatlabValidationView />} />
                    <Route path="matlab/:id" element={<MatlabValidationView />} />
                    <Route path="matlab-studio" element={<MatlabValidationView />} />
                    <Route path="matlab-studio/:id" element={<MatlabValidationView />} />
                    <Route path="simulink" element={<Navigate to="/app/matlab" replace />} />
                    <Route path="sil" element={<Navigate to="/app/matlab" replace />} />
                    <Route path="validation" element={<Navigate to="/app/matlab" replace />} />
                    <Route path="3d" element={<Navigate to="/app/workstation" replace />} />
                    <Route path="scenarios" element={<Scenarios />} />
                    <Route path="scenarios/:id" element={<ScenarioDetail />} />
                    <Route path="scenario/:id" element={<ScenarioDetail />} />
                    <Route path="runs/new" element={<NewRun />} />
                    <Route path="runs" element={<ReplayView />} />
                    <Route path="runs/:id" element={<ReplayView />} />
                    <Route path="results" element={<ReplayView />} />
                    <Route path="results/:id" element={<ReplayView />} />
                    <Route path="test-results" element={<ReplayView />} />
                    <Route path="test-results/:id" element={<ReplayView />} />
                    <Route path="test-history" element={<ReplayView />} />
                    <Route path="test-history/:id" element={<ReplayView />} />
                    <Route path="experiments" element={<ReplayView />} />
                    <Route path="experiments/:id" element={<ReplayView />} />
                    <Route path="experiment" element={<ReplayView />} />
                    <Route path="experiment/:id" element={<ReplayView />} />
                    <Route path="run/:id" element={<ReplayView />} />
                    <Route path="replay" element={<ReplayView />} />
                    <Route path="replay/:id" element={<ReplayView />} />
                    <Route path="simulations" element={<ReplayView />} />
                    <Route path="simulation" element={<ReplayView />} />
                    <Route path="simulation/:id" element={<ReplayView />} />
                    <Route path="experiment-runs" element={<ReplayView />} />
                    <Route path="experiment-runs/:id" element={<ReplayView />} />
                    <Route path="compare" element={<CompareView />} />
                    <Route path="compare/:id" element={<CompareView />} />
                    <Route path="benchmark" element={<BenchmarkView />} />
                    <Route path="benchmarks" element={<Navigate to="/app/benchmark" replace />} />
                    <Route path="failures" element={<FailuresView />} />
                    <Route path="failure" element={<Navigate to="/app/failures" replace />} />
                    <Route path="what-went-wrong" element={<FailuresView />} />
                    <Route path="reports" element={<ReportsView />} />
                    <Route path="report" element={<Navigate to="/app/reports" replace />} />
                    <Route path="settings" element={<Navigate to="/app/settings/profile" replace />} />
                    <Route path="settings/*" element={<SettingsView />} />
                    <Route path="profile" element={<Navigate to="/app/settings/profile" replace />} />
                    <Route path="demo" element={<Navigate to="/demo" replace />} />
                    <Route path="admin/*" element={<Navigate to="/admin/users" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>

                  {/* Admin Console */}
                  <Route path="/admin" element={<StudioLayout isBackendConnected={isBackendConnected} />}>
                    <Route index element={<Navigate to="/admin/users" replace />} />
                    <Route path="*" element={<AdminView />} />
                  </Route>

                  {/* Catch-all Helpful 404 Route inside StudioLayout so user is never lost */}
                  <Route element={<StudioLayout isBackendConnected={isBackendConnected} />}>
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </AnnouncerProvider>
          </AuthProvider>
        </I18nProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
};
export default App;
