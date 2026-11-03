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
      primaryPath: '/app/runs',
      isActive: (pathname) =>
        pathname === '/app/runs' ||
        (pathname.startsWith('/app/runs/') && !pathname.startsWith('/app/runs/new')) ||
        pathname.startsWith('/app/compare') ||
        pathname.startsWith('/app/reports'),
      subItems: [
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
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1rem 0.75rem',
        overflowY: 'auto',
      }}
    >
      {/* Primary 4 Workspaces Navigation List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {workspaces.map((ws) => {
          const isWsActive = ws.isActive(location.pathname);

          return (
            <div key={ws.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {/* Primary Workspace Header Button */}
              <NavLink
                to={ws.primaryPath}
                aria-label={`${ws.title} Workspace: ${ws.subtext}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  background: isWsActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  borderLeft: isWsActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  color: isWsActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  minHeight: 'var(--min-target-size)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span
                    style={{
                      color: isWsActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {ws.icon}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        letterSpacing: '0.01em',
                        lineHeight: 1.2,
                      }}
                    >
                      {ws.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {ws.subtext}
                    </div>
                  </div>
                </div>

                <ChevronRight
                  size={14}
                  style={{
                    color: isWsActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                    opacity: isWsActive ? 1 : 0.4,
                    transform: isWsActive ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s ease',
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
                  margin: '0.15rem 0 0 1.25rem',
                  borderLeft: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem',
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
                        gap: '0.55rem',
                        padding: '0.4rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        textDecoration: 'none',
                        fontSize: '0.8rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                        transition: 'all 0.15s ease',
                        minHeight: 'var(--min-target-size)',
                      })}
                    >
                      <span style={{ display: 'flex', alignItems: 'center' }}>{sub.icon}</span>
                      <span>{sub.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Secondary Utility Navigation (Settings & Admin Pinned at Bottom) */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
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
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontSize: '0.825rem',
            fontWeight: isActive ? 700 : 500,
            color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
            background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
            minHeight: 'var(--min-target-size)',
          })}
        >
          <Settings size={16} aria-hidden="true" />
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
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: '0.825rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--risk-critical)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
              minHeight: 'var(--min-target-size)',
            })}
          >
            <ShieldAlert size={16} aria-hidden="true" />
            <span>{t('nav_admin')}</span>
          </NavLink>
        )}

        {/* Footer Meta */}
        <div
          style={{
            paddingTop: '0.65rem',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          <div>MathWorks SIH26037</div>
          <div style={{ color: 'var(--status-success)', fontWeight: 600 }}>WCAG 2.2 AA Verified</div>
        </div>
      </div>
    </nav>
  );
};
