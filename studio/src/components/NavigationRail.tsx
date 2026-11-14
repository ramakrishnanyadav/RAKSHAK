/**
 * Stage 4G.9: Streamlined Five-Section Primary Navigation Architecture.
 * 
 * 5 Primary Destinations:
 * 1. HOME (/app) - Overview & Activity
 * 2. SCENARIOS (/app/scenarios) - Indian Road Library
 * 3. SIMULATE (/app/workstation) - Live Simulation & 3D Workstation
 * 4. RESULTS (/app/runs) - Replay & Test History
 * 5. MATLAB STUDIO (/app/matlab) - Simulink SIL Plant
 * 
 * Collapsible Advanced Research Mode:
 * - Planner Comparison / Compare Runs (/app/compare)
 * - What Went Wrong (/app/failures)
 * - Ablation Benchmark (/app/benchmark)
 * - Validation Reports (/app/reports)
 * 
 * WCAG 2.2 AA compliant with >= 24px target sizes, visible focus rings, and high-contrast active states.
 */

import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  Compass,
  Map,
  PlayCircle,
  Box,
  Cpu,
  Columns,
  AlertTriangle,
  BarChart3,
  FileText,
  FlaskConical,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export interface PrimaryDestination {
  id: string;
  title: string;
  subtext: string;
  ariaLabel: string;
  icon: React.ReactNode;
  to: string;
  isActive: (pathname: string) => boolean;
}

export const NavigationRail: React.FC = () => {
  const { presentationMode } = useSettings();
  const location = useLocation();

  const isResearchPath =
    location.pathname.startsWith('/app/compare') ||
    location.pathname.startsWith('/app/failures') ||
    location.pathname.startsWith('/app/what-went-wrong') ||
    location.pathname.startsWith('/app/benchmark') ||
    location.pathname.startsWith('/app/reports');

  const [researchOpen, setResearchOpen] = useState<boolean>(true);

  // 5 Primary Navigation Destinations
  const primaryDestinations: PrimaryDestination[] = [
    {
      id: 'home',
      title: 'Home',
      subtext: 'Overview & Activity',
      ariaLabel: 'Home: Overview & Activity',
      icon: <Compass size={18} aria-hidden="true" />,
      to: '/app',
      isActive: (pathname) => pathname === '/app' || pathname === '/app/',
    },
    {
      id: 'scenarios',
      title: 'Scenarios',
      subtext: 'Indian Road Library',
      ariaLabel: 'Scenarios: Indian Road Library',
      icon: <Map size={18} aria-hidden="true" />,
      to: '/app/scenarios',
      isActive: (pathname) => pathname.startsWith('/app/scenarios'),
    },
    {
      id: 'simulate',
      title: 'Live Simulation',
      subtext: '3D Workstation',
      ariaLabel: 'Live Simulation: 3D Workstation',
      icon: <Box size={18} aria-hidden="true" />,
      to: '/app/workstation',
      isActive: (pathname) =>
        pathname.startsWith('/app/workstation') ||
        pathname.startsWith('/app/runs/new') ||
        pathname.startsWith('/app/live'),
    },
    {
      id: 'results',
      title: 'Results',
      subtext: 'Replay & Test History',
      ariaLabel: 'Results: Replay & Test History',
      icon: <PlayCircle size={18} aria-hidden="true" />,
      to: '/app/runs',
      isActive: (pathname) =>
        (pathname.startsWith('/app/runs') && !pathname.startsWith('/app/runs/new')) ||
        pathname.startsWith('/app/results'),
    },
    {
      id: 'matlab',
      title: 'MATLAB Studio',
      subtext: 'Simulink SIL Plant',
      ariaLabel: 'MATLAB Studio: Simulink SIL Plant',
      icon: <Cpu size={18} aria-hidden="true" />,
      to: '/app/matlab',
      isActive: (pathname) =>
        pathname.startsWith('/app/matlab') || pathname.startsWith('/app/sil'),
    },
  ];

  // Advanced Research Items
  const researchItems = [
    {
      to: '/app/compare',
      label: 'Compare Runs',
      desc: 'Multi-planner benchmarking',
      icon: <Columns size={15} aria-hidden="true" />,
    },
    {
      to: '/app/failures',
      label: 'What Went Wrong',
      desc: 'Failure classification & analysis',
      icon: <AlertTriangle size={15} aria-hidden="true" />,
    },
    {
      to: '/app/benchmark',
      label: 'Ablation Benchmark',
      desc: 'Statistical component sweeps',
      icon: <BarChart3 size={15} aria-hidden="true" />,
    },
    {
      to: '/app/reports',
      label: 'Validation Reports',
      desc: 'Safety dossiers & compliance',
      icon: <FileText size={15} aria-hidden="true" />,
    },
  ];

  const showResearch = researchOpen || presentationMode === 'research' || isResearchPath;

  return (
    <nav
      className="nav-rail"
      aria-label="Main Application Navigation"
      style={{
        width: '230px',
        minWidth: '230px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '0.85rem 0.65rem',
        overflowY: 'auto',
        background: '#070a10',
        borderRight: '1px solid rgba(56, 189, 248, 0.1)',
      }}
    >
      <div>
        {/* Navigation Category Label */}
        <div
          style={{
            fontSize: '0.66rem',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 800,
            padding: '0.4rem 0.65rem 0.6rem',
          }}
        >
          Primary
        </div>

        {/* 5 Primary Navigation Destinations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {primaryDestinations.map((dest) => {
            const isActive = dest.isActive(location.pathname);

            return (
              <NavLink
                key={dest.id}
                to={dest.to}
                aria-label={dest.ariaLabel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(99, 102, 241, 0.12) 100%)'
                    : 'transparent',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  transition: 'all 0.15s ease',
                  minHeight: '44px',
                  boxShadow: isActive ? '0 0 14px rgba(56, 189, 248, 0.1)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <span
                    style={{
                      color: isActive ? '#38bdf8' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      filter: isActive ? 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.5))' : 'none',
                    }}
                  >
                    {dest.icon}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: isActive ? 800 : 600,
                        letterSpacing: '0.01em',
                        lineHeight: 1.2,
                        color: isActive ? '#f8fafc' : '#cbd5e1',
                      }}
                    >
                      {dest.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.66rem',
                        color: isActive ? 'rgba(56, 189, 248, 0.9)' : '#64748b',
                        fontWeight: 500,
                        marginTop: '1px',
                      }}
                    >
                      {dest.subtext}
                    </div>
                  </div>
                </div>
              </NavLink>
            );
          })}
        </div>

        {/* Collapsible Advanced Research Section */}
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(99, 102, 241, 0.18)', paddingTop: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setResearchOpen(!researchOpen)}
            aria-expanded={showResearch}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.4rem 0.65rem',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: isResearchPath ? '#a5b4fc' : '#818cf8',
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <FlaskConical size={13} color="#818cf8" aria-hidden="true" />
              <span>Advanced Research</span>
            </div>
            <ChevronDown
              size={14}
              style={{
                transform: showResearch ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </button>

          {showResearch && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.35rem' }}>
              {researchItems.map((item) => {
                const isActive = location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontSize: '0.78rem',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#a5b4fc' : '#94a3b8',
                      background: isActive ? 'rgba(99, 102, 241, 0.16)' : 'transparent',
                      border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                      minHeight: '34px',
                    }}
                  >
                    <span style={{ color: isActive ? '#818cf8' : '#64748b', display: 'flex', alignItems: 'center' }}>
                      {item.icon}
                    </span>
                    <div>
                      <div style={{ lineHeight: 1.2 }}>{item.label}</div>
                      <div style={{ fontSize: '0.63rem', color: '#64748b', marginTop: '1px' }}>{item.desc}</div>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pinned Bottom Settings Link */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: '0.65rem',
        }}
      >
        <NavLink
          to="/app/settings/profile"
          aria-label="User Settings and Preferences"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.45rem 0.65rem',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: isActive ? '#38bdf8' : '#64748b',
            background: isActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
            transition: 'all 0.15s ease',
          })}
        >
          <Settings size={15} />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
};
