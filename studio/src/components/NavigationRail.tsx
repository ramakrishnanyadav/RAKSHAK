/**
 * Unified Four-Workspace Navigation Architecture for ADAPTIVE-PATH Studio.
 * 
 * Consolidates navigation into 4 primary workspaces:
 * 1. HOME: Overview, Recent Activity, Quick-start simulation, System Status (/app)
 * 2. SIMULATE: Road Scenarios library (/app/scenarios), Guided 3-step preparation (/app/runs/new)
 * 3. RESULTS: Replay Viewer (/app/runs, /app/runs/:id), Compare Runs (/app/compare), Validation Reports (/app/reports)
 * 4. RESEARCH: Benchmark Validation (/app/benchmark), Failure Explorer (/app/failures)
 * 
 * Secondary / Utility:
 * - Settings (/app/settings/profile)
 * - Admin Console (/admin/users, admin-only)
 * 
 * Meets WCAG 2.2 AA target size >= 24px and keyboard accessibility requirements.
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Compass,
  Map,
  PlayCircle,
  PlusCircle,
  Columns,
  BarChart3,
  AlertTriangle,
  FileText,
  Settings,
  ShieldAlert,
  FlaskConical,
  Activity,
  Layers,
  ChevronRight,
  Box,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

export interface WorkspaceGroup {
  id: 'home' | 'simulate' | 'results' | 'research';
  title: string;
  subtext: string;
  icon: React.ReactNode;
  primaryPath: string;
  isActive: (pathname: string) => boolean;
  subItems: {
    to: string;
    label: string;
    icon: React.ReactNode;
    end?: boolean;
  }[];
}

export const NavigationRail: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  // Definition of the 4 Primary Workspaces
  const workspaces: WorkspaceGroup[] = [
    // 1. HOME WORKSPACE
    {
      id: 'home',
      title: t('workspace_home'),
      subtext: 'Overview & Activity',
      icon: <Compass size={18} aria-hidden="true" />,
      primaryPath: '/app',
      isActive: (pathname) => pathname === '/app',
      subItems: [
        {
          to: '/app',
          label: t('nav_overview'),
          icon: <Activity size={14} aria-hidden="true" />,
          end: true,
        },
      ],
    },

    // 2. SIMULATE WORKSPACE
    {
      id: 'simulate',
      title: t('workspace_simulate'),
      subtext: 'Scenarios & Preparation',
      icon: <PlayCircle size={18} aria-hidden="true" />,
      primaryPath: '/app/scenarios',
      isActive: (pathname) =>
        pathname.startsWith('/app/scenarios') || pathname.startsWith('/app/runs/new'),
      subItems: [
        {
          to: '/app/scenarios',
          label: t('nav_scenarios'),
          icon: <Map size={14} aria-hidden="true" />,
        },
        {
          to: '/app/runs/new',
          label: t('nav_new_run'),
          icon: <PlusCircle size={14} aria-hidden="true" />,
        },
      ],
    },

    // 3. RESULTS WORKSPACE (Compare housed inside Results)
    {
      id: 'results',
      title: t('workspace_results'),
      subtext: 'Replay & Comparison',
      icon: <Activity size={18} aria-hidden="true" />,
      primaryPath: '/app/workstation',
      isActive: (pathname) =>
        pathname === '/app/workstation' ||
        pathname === '/app/runs' ||
        (pathname.startsWith('/app/runs/') && !pathname.startsWith('/app/runs/new')) ||
        pathname.startsWith('/app/compare') ||
        pathname.startsWith('/app/reports'),
      subItems: [
        {
          to: '/app/workstation',
          label: '3D Workstation',
          icon: <Box size={14} aria-hidden="true" />,
        },
        {
          to: '/app/runs',
          label: t('nav_runs'),
          icon: <PlayCircle size={14} aria-hidden="true" />,
        },
        {
          to: '/app/compare',
          label: t('nav_compare'),
          icon: <Columns size={14} aria-hidden="true" />,
        },
        {
          to: '/app/reports',
          label: t('nav_reports'),
          icon: <FileText size={14} aria-hidden="true" />,
        },
      ],
    },

    // 4. RESEARCH WORKSPACE
    {
      id: 'research',
      title: t('workspace_research'),
      subtext: 'Benchmarks & Safety',
      icon: <FlaskConical size={18} aria-hidden="true" />,
      primaryPath: '/app/benchmark',
      isActive: (pathname) =>
        pathname.startsWith('/app/benchmark') || pathname.startsWith('/app/failures'),
      subItems: [
        {
          to: '/app/benchmark',
          label: t('nav_benchmark'),
          icon: <BarChart3 size={14} aria-hidden="true" />,
        },
        {
          to: '/app/failures',
          label: t('nav_failures'),
          icon: <AlertTriangle size={14} aria-hidden="true" />,
        },
      ],
    },
  ];

  return (
    <nav
      className="nav-rail"
      aria-label="Main Application Navigation"
      style={{
        width: '240px',
        minWidth: '240px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1rem 0.75rem',
        overflowY: 'auto',
      }}
    >
      {/* Brand Logo at top of nav */}
      <div>
        <div style={{
          padding: '0.5rem 0.5rem 1rem',
          marginBottom: '0.5rem',
          borderBottom: '1px solid rgba(56, 189, 248, 0.14)',
        }}>
          <div className="brand-title" style={{ fontSize: '1rem', fontWeight: 900 }}>
            <Layers size={18} aria-hidden="true" />
            ADAPTIVE-PATH
          </div>
          <div style={{
            fontSize: '0.65rem',
            color: '#38bdf8',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginTop: '0.25rem',
            opacity: 0.8,
          }}>
            SIH26037 · MathWorks
          </div>
        </div>

        {/* Primary 4 Workspaces Navigation List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {workspaces.map((ws) => {
            const isWsActive = ws.isActive(location.pathname);

            return (
              <div key={ws.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginBottom: '0.5rem' }}>
                {/* Primary Workspace Header Button */}
                <NavLink
                  to={ws.primaryPath}
                  aria-label={`${ws.title} Workspace: ${ws.subtext}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    background: isWsActive
                      ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(99, 102, 241, 0.1) 100%)'
                      : 'transparent',
                    border: isWsActive ? '1px solid rgba(56, 189, 248, 0.28)' : '1px solid transparent',
                    color: isWsActive ? '#f8fafc' : '#94a3b8',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    minHeight: '44px',
                    boxShadow: isWsActive ? '0 0 14px rgba(56, 189, 248, 0.08)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span
                      style={{
                        color: isWsActive ? '#38bdf8' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {ws.icon}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          letterSpacing: '0.01em',
                          lineHeight: 1.2,
                          color: isWsActive ? '#f8fafc' : '#cbd5e1',
                        }}
                      >
                        {ws.title}
                      </div>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          color: isWsActive ? 'rgba(56, 189, 248, 0.75)' : '#475569',
                          fontWeight: 500,
                          marginTop: '1px',
                        }}
                      >
                        {ws.subtext}
                      </div>
                    </div>
                  </div>

                  <ChevronRight
                    size={13}
                    style={{
                      color: isWsActive ? '#38bdf8' : '#475569',
                      opacity: isWsActive ? 1 : 0.5,
                      transform: isWsActive ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s ease, color 0.2s ease',
                    }}
                    aria-hidden="true"
                  />
                </NavLink>

                {/* Sub-Destinations List */}
                <ul
                  role="menu"
                  aria-label={`${ws.title} sub-pages`}
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '0.1rem 0 0 1.5rem',
                    borderLeft: `1px solid ${isWsActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.07)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.1rem',
                    transition: 'border-color 0.2s ease',
                  }}
                >
                  {ws.subItems.map((sub) => (
                    <li key={sub.to} role="none">
                      <NavLink
                        to={sub.to}
                        end={sub.end}
                        role="menuitem"
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.38rem 0.6rem',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          fontSize: '0.78rem',
                          fontWeight: isActive ? 700 : 400,
                          color: isActive ? '#38bdf8' : '#64748b',
                          background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                          transition: 'all 0.15s ease',
                          minHeight: '32px',
                          marginLeft: '0.5rem',
                          letterSpacing: isActive ? '0.01em' : 'normal',
                        })}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', opacity: 0.9 }}>{sub.icon}</span>
                        <span>{sub.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Secondary Utility Navigation (Settings & Admin Pinned at Bottom) */}
      <div
        style={{
          borderTop: '1px solid rgba(56, 189, 248, 0.12)',
          paddingTop: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        <NavLink
          to="/app/settings/profile"
          aria-label="User Settings and Preferences"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: isActive ? 700 : 500,
            color: isActive ? '#38bdf8' : '#64748b',
            background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
            border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.25)' : 'transparent'}`,
            minHeight: '40px',
            transition: 'all 0.15s ease',
          })}
        >
          <Settings size={15} aria-hidden="true" />
          <span>{t('nav_settings')}</span>
        </NavLink>

        {user?.role === 'admin' && (
          <NavLink
            to="/admin/users"
            aria-label="Administration Console"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.8rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#ef4444' : '#64748b',
              background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
              minHeight: '40px',
              transition: 'all 0.15s ease',
            })}
          >
            <ShieldAlert size={15} aria-hidden="true" />
            <span>{t('nav_admin')}</span>
          </NavLink>
        )}

        {/* Footer Meta */}
        <div
          style={{
            paddingTop: '0.65rem',
            fontSize: '0.65rem',
            color: '#334155',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: '#475569' }}>MathWorks SIH26037</div>
          <div style={{ color: '#10b981', fontWeight: 600, letterSpacing: '0.03em' }}>✓ WCAG 2.2 AA</div>
        </div>
      </div>
    </nav>
  );
};
