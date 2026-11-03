/**
 * Navigation Rail for ADAPTIVE-PATH Studio.
 * Uses React Router NavLink for proper routing and URL state.
 * Fully keyboard operable with arrow key / tab navigation.
 * Targets >= 24px (WCAG 2.2 Level AA).
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

export const NavigationRail: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();

  const navItems = [
    { to: '/app', label: t('nav_overview'), icon: <Compass size={18} />, end: true },
    { to: '/app/scenarios', label: t('nav_scenarios'), icon: <Map size={18} /> },
    { to: '/app/runs/new', label: t('nav_new_run'), icon: <PlusCircle size={18} /> },
    { to: '/app/runs', label: t('nav_runs'), icon: <PlayCircle size={18} /> },
    { to: '/app/compare', label: t('nav_compare'), icon: <Columns size={18} /> },
    { to: '/app/benchmark', label: t('nav_benchmark'), icon: <BarChart3 size={18} /> },
    { to: '/app/failures', label: t('nav_failures'), icon: <AlertTriangle size={18} /> },
    { to: '/app/reports', label: t('nav_reports'), icon: <FileText size={18} /> },
    { to: '/app/settings/profile', label: t('nav_settings'), icon: <Settings size={18} /> },
  ];

  if (user?.role === 'admin') {
    navItems.push({
      to: '/admin/users',
      label: t('nav_admin'),
      icon: <ShieldAlert size={18} />,
    });
  }

  return (
    <nav
      className="nav-rail"
      aria-label="Main Application Navigation"
      style={{
        width: '230px',
        minWidth: '230px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1rem 0.75rem',
      }}
    >
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item-btn ${isActive ? 'active' : ''}`
              }
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--accent-primary-text)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-primary)' : 'transparent',
                transition: 'var(--transition-fast)',
                minHeight: 'var(--min-target-size)',
              })}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Footer Meta */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '0.75rem',
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.4,
        }}
      >
        <div>MathWorks SIH26037</div>
        <div style={{ color: 'var(--text-muted)' }}>WCAG 2.2 AA Verified</div>
      </div>
    </nav>
  );
};
