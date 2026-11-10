/**
 * ADAPTIVE-PATH Showcase Landing Page (Route: / and /demo)
 * Single-page, demo-first autonomous driving workstation for SIH26037 (MathWorks).
 * Opens straight into the full-width compare stage above the fold at the cow step-out moment.
 * Powered by unified Scene3D WebGL renderer (zero legacy 2D SimCanvas).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SceneWorkstation } from '../components/scene/SceneWorkstation';
import { ResultsSection } from '../components/showcase/ResultsSection';
import { OurDataSection } from '../components/showcase/OurDataSection';
import { HowItWorksStrip } from '../components/showcase/HowItWorksStrip';
import { DetailsDrawer } from '../components/showcase/DetailsDrawer';
import { DemoTourModal } from '../components/showcase/DemoTourModal';
import { EvidencePanel } from '../components/showcase/EvidencePanel';
import { ShowcaseSummary, ProvenancePayload } from '../components/showcase/types';
import { useSettings } from '../context/SettingsContext';
import { useI18n } from '../context/I18nContext';
import {
  Play,
  ArrowRight,
  Code2,
  Settings,
  Compass,
  PlayCircle,
  BarChart3,
  FlaskConical,
  Check,
  Shield,
  Layers,
} from 'lucide-react';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { theme, setTheme, textScale, setTextScale } = useSettings();
  const { language, setLanguage } = useI18n();

  const [summaryData, setSummaryData] = useState<ShowcaseSummary | null>(null);
  const [provenanceData, setProvenanceData] = useState<ProvenancePayload | null>(null);

  // Drawer / Modal / Popover States
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  // Close settings on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Summary Data
  useEffect(() => {
    fetch('/showcase/summary.json')
      .then((res) => res.json())
      .then((data: ShowcaseSummary) => setSummaryData(data))
      .catch((err) => console.error('Error loading showcase summary:', err));
  }, []);

  // Fetch Provenance Data
  useEffect(() => {
    fetch('/showcase/provenance.json')
      .then((res) => res.json())
      .then((data: ProvenancePayload) => setProvenanceData(data))
      .catch((err) => console.error('Error loading provenance data:', err));
  }, []);

  const leftNavItems = [
    { label: 'HOME', icon: <Compass size={18} />, action: () => window.scrollTo({ top: 0, behavior: 'smooth' }), active: true },
    { label: 'SIMULATE', icon: <PlayCircle size={18} />, action: () => navigate('/app/scenarios'), active: false },
    { label: 'RESULTS', icon: <BarChart3 size={18} />, action: () => {
      const el = document.getElementById('results');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      else navigate('/app/runs');
    }, active: false },
    { label: 'RESEARCH', icon: <FlaskConical size={18} />, action: () => navigate('/app/benchmark'), active: false },
  ];

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#07080A',
        color: '#E2E8F0',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* 1. LEFT WORKSTATION RAIL: HOME / SIMULATE / RESULTS / RESEARCH */}
      <aside
        style={{
          width: '72px',
          backgroundColor: '#0B0C0F',
          borderRight: '1px solid #1E2430',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1rem 0',
          gap: '1.25rem',
          zIndex: 40,
          flexShrink: 0,
        }}
        aria-label="Workstation primary navigation rail"
      >
        {/* Brand Icon */}
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: '#2DD4BF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#090A0D',
            fontWeight: 900,
            fontSize: '1.1rem',
            marginBottom: '0.5rem',
          }}
          title="ADAPTIVE-PATH"
        >
          AP
        </div>

        {/* Rail Workspace Items */}
        {leftNavItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            style={{
              width: '56px',
              height: '52px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              borderRadius: '8px',
              border: item.active ? '1px solid #2DD4BF' : '1px solid transparent',
              backgroundColor: item.active ? 'rgba(45, 212, 191, 0.12)' : 'transparent',
              color: item.active ? '#2DD4BF' : '#94A3B8',
              cursor: 'pointer',
              fontSize: '0.62rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              transition: 'all 0.15s ease',
            }}
            title={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Details & Code Drawer Button */}
        <button
          onClick={() => setIsDetailsOpen(true)}
          style={{
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            border: '1px solid #1E2430',
            backgroundColor: 'transparent',
            color: '#CBD5E1',
            cursor: 'pointer',
          }}
          title="Audit details, code, and benchmark reconciliation"
        >
          <Code2 size={18} />
        </button>

        {/* Settings Popover */}
        <div style={{ position: 'relative' }} ref={settingsRef}>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid #1E2430',
              backgroundColor: isSettingsOpen ? '#1E2430' : 'transparent',
              color: '#CBD5E1',
              cursor: 'pointer',
            }}
            title="Settings & Appearance"
          >
            <Settings size={18} />
          </button>

          {isSettingsOpen && (
            <div
              style={{
                position: 'absolute',
                left: '60px',
                bottom: 0,
                width: '210px',
                backgroundColor: '#111318',
                border: '1px solid #1E2430',
                borderRadius: '8px',
                padding: '0.8rem',
                boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem',
                zIndex: 50,
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8' }}>THEME</div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    style={{
                      flex: 1,
                      padding: '0.3rem',
                      fontSize: '0.72rem',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: theme === t ? '#2DD4BF' : '#1E2430',
                      color: theme === t ? '#090A0D' : '#CBD5E1',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* 2. MAIN SCROLLABLE WORKSTATION VIEW */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        {/* ============================================================== */}
        {/* FULL-WIDTH COMPARE STAGE (ABOVE THE FOLD)                      */}
        {/* ============================================================== */}
        <section
          id="compare-stage"
          style={{
            height: '82vh',
            minHeight: '620px',
            maxHeight: '920px',
            display: 'flex',
            flexDirection: 'column',
            borderBottom: '1px solid #1E2430',
            position: 'relative',
          }}
        >
          {/* Header strip with "Watch it drive" prominent callout */}
          <div
            style={{
              padding: '0.5rem 1.2rem',
              backgroundColor: '#0F1116',
              borderBottom: '1px solid #1E2430',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFFFFF' }}>
                Adaptive Path Planning for Unstructured Indian Roads
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(45, 212, 191, 0.1)',
                  color: '#2DD4BF',
                  fontWeight: 700,
                  border: '1px solid rgba(45, 212, 191, 0.25)',
                }}
              >
                SIH26037 (MathWorks)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {/* Allowed Layers indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.68rem',
                  color: '#94A3B8',
                  marginRight: '0.5rem',
                }}
              >
                <Layers size={13} color="#2DD4BF" />
                <span>Allowed Layers: Path • Boxes • Predictions • Uncertainty envelope • Risk gauge</span>
              </div>

              <Link
                to="/app"
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  backgroundColor: '#2DD4BF',
                  color: '#090A0D',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span>Research Mode</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Unified SceneWorkstation (defaults to Cattle Crossing at t=2.5s cow step-out) */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <SceneWorkstation
              initialScenarioId="SCENARIO_5_CATTLE_CROSSING"
              initialPlannerId="P3"
            />
          </div>
        </section>

        {/* ============================================================== */}
        {/* LOWER SECTION: RESULTS, PROVENANCE DATA, HOW IT WORKS          */}
        {/* ============================================================== */}
        <main
          style={{
            maxWidth: '1280px',
            width: '100%',
            margin: '0 auto',
            padding: '3rem 2rem 5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '4.5rem',
          }}
        >
          {/* PERMANENT EVIDENCE PANEL: Research truth, 4-way reconciliation */}
          <section id="evidence">
            <EvidencePanel />
          </section>

          {/* SECTION 2: RESULTS (Validation B Benchmark & Physical Contact Callout) */}
          <section id="results">
            <ResultsSection summary={summaryData} />
          </section>

          {/* SECTION 3: OUR DATA (Dataset Provenance & Authentic Statuses) */}
          <section id="our-data">
            <OurDataSection provenance={provenanceData} />
          </section>

          {/* SECTION 4: HOW IT WORKS (Three-Pillar Pipeline) */}
          <section id="how-it-works">
            <HowItWorksStrip />
          </section>

          {/* Footer with strict engineering disclaimer */}
          <footer
            style={{
              borderTop: '1px solid #1E2430',
              paddingTop: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              color: '#64748B',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                ADAPTIVE-PATH • Autonomous Driving Research Workstation for SIH26037
              </div>
              <div style={{ fontFamily: 'monospace' }}>
                All replay data traces strictly to runs/val_b_manifest.json • REPLAY ONLY
              </div>
            </div>
            <div>
              Disclaimer: Simulation only. Rendered from simulation state, not a sensor image. Not approved for physical on-road vehicle deployment without real hardware SIL/HIL safety-envelope certification.
            </div>
          </footer>
        </main>
      </div>

      {/* Popups & Drawers */}
      <DetailsDrawer isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
      <DemoTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onSelectScenario={() => {}}
        onToggleLayer={() => {}}
        onSeekTime={() => {}}
        onPlayReplay={() => {}}
      />
    </div>
  );
};
export default Landing;
