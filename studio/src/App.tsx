/**
 * ADAPTIVE-PATH Studio Main Application Router.
 * Configures React Router, TanStack Query, I18nProvider, SettingsProvider,
 * AuthProvider, AnnouncerProvider, and global keyboard shortcuts modal.
 * Fulfills all hard WCAG 2.2 AA accessibility requirements with zero 'any' types.
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
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
      '/app/scenarios': 'Scenarios Library',
      '/app/runs/new': 'Launch Simulation Run',
      '/app/runs': 'Simulation Replay Viewer',
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
                  <Route path="/demo" element={<Demo />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/reset" element={<ResetPassword />} />

                  {/* Authenticated / Guest Studio App Shell */}
                  <Route path="/app" element={<StudioLayout isBackendConnected={isBackendConnected} />}>
                    <Route index element={<Dashboard />} />
                    <Route path="scenarios" element={<Scenarios />} />
                    <Route path="scenarios/:id" element={<ScenarioDetail />} />
                    <Route path="runs/new" element={<NewRun />} />
                    <Route path="runs" element={<ReplayView />} />
                    <Route path="runs/:id" element={<ReplayView />} />
                    <Route path="compare" element={<CompareView />} />
                    <Route path="benchmark" element={<BenchmarkView />} />
                    <Route path="failures" element={<FailuresView />} />
                    <Route path="reports" element={<ReportsView />} />
                    <Route path="settings/*" element={<SettingsView />} />
                  </Route>

                  {/* Admin Console */}
                  <Route path="/admin" element={<StudioLayout isBackendConnected={isBackendConnected} />}>
                    <Route index element={<Navigate to="/admin/users" replace />} />
                    <Route path="*" element={<AdminView />} />
                  </Route>

                  {/* Helpful 404 Route */}
                  <Route path="*" element={<NotFound />} />
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
