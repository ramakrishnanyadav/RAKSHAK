/**
 * ADAPTIVE-PATH Showcase Landing Page (Route: / and /demo)
 * Single-page, demo-first research product for Smart India Hackathon problem SIH26037 (MathWorks).
 * Fulfills all North Star criteria: dual synchronized canvas replay, 5 canonical scenarios,
 * 4 headline metrics traceable to runs/val_b_manifest.json, Grade 8 plain English explanations,
 * authentic dataset provenance audit, and seamless link to full research mode (/app).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ScenarioKey,
  ScenarioPicker,
} from '../components/showcase/ScenarioPicker';
import { SimCanvas } from '../components/showcase/SimCanvas';
import { TimelineScrubber } from '../components/showcase/TimelineScrubber';
import { ThinkingBox } from '../components/showcase/ThinkingBox';
import { OutcomeBanner } from '../components/showcase/OutcomeBanner';
import { ResultsSection } from '../components/showcase/ResultsSection';
import { OurDataSection } from '../components/showcase/OurDataSection';
import { HowItWorksStrip } from '../components/showcase/HowItWorksStrip';
import { DetailsDrawer } from '../components/showcase/DetailsDrawer';
import { DemoTourModal } from '../components/showcase/DemoTourModal';
import { ShowcaseScenarioFile, ShowcaseSummary, ProvenancePayload } from '../components/showcase/types';
import { useSettings } from '../context/SettingsContext';
import { useI18n } from '../context/I18nContext';
import {
  Play,
  ArrowRight,
  Eye,
  GitBranch,
  Shield,
  Code2,
  Settings,
  Check,
} from 'lucide-react';

export const Landing: React.FC = () => {
  const { theme, setTheme, textScale, setTextScale } = useSettings();
  const { language, setLanguage } = useI18n();

  // Selected scenario key (defaults to flagship Cattle Crossing)
  const [activeScenarioKey, setActiveScenarioKey] = useState<ScenarioKey>('cattle');
  const [scenarioData, setScenarioData] = useState<ShowcaseScenarioFile | null>(null);
  const [summaryData, setSummaryData] = useState<ShowcaseSummary | null>(null);
  const [provenanceData, setProvenanceData] = useState<ProvenancePayload | null>(null);
  const [, setIsLoading] = useState(true);

  // Playback & Scrubber State
  const [currentTime, setCurrentTime] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Layer Toggles
  const [showSensors, setShowSensors] = useState(true);
  const [showPredictions, setShowPredictions] = useState(true);
  const [showRiskField, setShowRiskField] = useState(true);

  // Modal / Drawer / Popover States
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Animation frame loop ref
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
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

  // 1. Fetch Summary Data
  useEffect(() => {
    fetch('/showcase/summary.json')
      .then((res) => res.json())
      .then((data: ShowcaseSummary) => {
        setSummaryData(data);
      })
      .catch((err) => console.error('Error loading showcase summary:', err));
  }, []);

  // 2. Fetch Provenance Data
  useEffect(() => {
    fetch('/showcase/provenance.json')
      .then((res) => res.json())
      .then((data: ProvenancePayload) => {
        setProvenanceData(data);
      })
      .catch((err) => console.error('Error loading provenance data:', err));
  }, []);

  // 3. Fetch Scenario Data when activeScenarioKey changes
  useEffect(() => {
    setIsLoading(true);
    fetch(`/showcase/${activeScenarioKey}.json`)
      .then((res) => res.json())
      .then((data: ShowcaseScenarioFile) => {
        setScenarioData(data);
        setCurrentTime(0.0);
        setIsPlaying(true);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(`Error loading ${activeScenarioKey}.json:`, err);
        setIsLoading(false);
      });
  }, [activeScenarioKey]);

  // Duration calculation
  const duration = Math.max(
    scenarioData?.adaptive.metrics.duration_s || 12.0,
    scenarioData?.standard.metrics.duration_s || 7.0
  );

  // Frame resolution based on currentTime (dt = 0.1s)
  const getFrameAtTime = (frames: any[], time: number) => {
    if (!frames || frames.length === 0) return undefined;
    const targetIdx = Math.min(frames.length - 1, Math.max(0, Math.round(time / 0.1)));
    return frames[targetIdx];
  };

  const adaptiveFrame = getFrameAtTime(scenarioData?.adaptive.frames || [], currentTime);
  const standardFrame = getFrameAtTime(scenarioData?.standard.frames || [], currentTime);

  // 4. Replay Animation Loop
  useEffect(() => {
    if (!isPlaying) {
      lastTimestampRef.current = null;
      return;
    }

    const onFrame = (timestamp: number) => {
      if (lastTimestampRef.current !== null) {
        const deltaSeconds = (timestamp - lastTimestampRef.current) / 1000;
        setCurrentTime((prev) => {
          const next = prev + deltaSeconds * playbackSpeed;
          if (next >= duration) {
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }
      lastTimestampRef.current = timestamp;
      animFrameRef.current = requestAnimationFrame(onFrame);
    };

    animFrameRef.current = requestAnimationFrame(onFrame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, duration]);

  // 5. Keyboard Shortcuts (Space: Play/Pause, Left/Right: scrub)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((prev) => Math.max(0, prev - 0.5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((prev) => Math.min(duration, prev + 0.5));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration]);

  const scrollToDemo = () => {
    const el = document.getElementById('demo-stage');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B0C0F',
        color: '#E2E8F0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      {/* ============================================================== */}
      {/* TOP NAVIGATION BAR                                            */}
      {/* ============================================================== */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: 'rgba(11, 12, 15, 0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0.75rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Wordmark & Problem Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
            ADAPTIVE-PATH
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              background: 'rgba(45, 212, 191, 0.12)',
              color: '#2DD4BF',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid rgba(45, 212, 191, 0.25)',
              letterSpacing: '0.04em',
            }}
          >
            SIH26037 • MATHWORKS
          </span>
        </div>

        {/* Center: Jump Anchors */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.875rem' }}>
          <a
            href="#demo-stage"
            style={{ color: '#CBD5E1', textDecoration: 'none', fontWeight: 500 }}
          >
            Demo
          </a>
          <a
            href="#results"
            style={{ color: '#CBD5E1', textDecoration: 'none', fontWeight: 500 }}
          >
            Results
          </a>
          <a
            href="#our-data"
            style={{ color: '#CBD5E1', textDecoration: 'none', fontWeight: 500 }}
          >
            Our data
          </a>
          <a
            href="#how-it-works"
            style={{ color: '#CBD5E1', textDecoration: 'none', fontWeight: 500 }}
          >
            How it works
          </a>
        </nav>

        {/* Right: Controls & Research Mode Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
          {/* Consolidated Settings Popover Button */}
          <div ref={settingsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              style={{
                background: isSettingsOpen ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#CBD5E1',
                padding: '0.4rem 0.65rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              aria-label="Application Settings"
              title="Settings (Language, Theme, Text Size)"
            >
              <Settings size={14} />
              <span>Settings</span>
            </button>

            {/* Floating Popover Card */}
            {isSettingsOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '240px',
                  background: '#14161E',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '1rem',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  zIndex: 2000,
                }}
              >
                {/* Language Option */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.4rem' }}>
                    LANGUAGE
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'hi', label: 'हिन्दी' },
                      { code: 'te', label: 'తెలుగు' },
                    ].map((l) => (
                      <button
                        key={l.code}
                        onClick={() => setLanguage(l.code as any)}
                        style={{
                          flex: 1,
                          padding: '0.3rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: 'none',
                          background: language === l.code ? '#2DD4BF' : 'rgba(255,255,255,0.06)',
                          color: language === l.code ? '#090A0D' : '#CBD5E1',
                          fontWeight: language === l.code ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme Option */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.4rem' }}>
                    APPEARANCE
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {(['dark', 'light'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        style={{
                          flex: 1,
                          padding: '0.3rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: 'none',
                          background: theme === t ? '#2DD4BF' : 'rgba(255,255,255,0.06)',
                          color: theme === t ? '#090A0D' : '#CBD5E1',
                          fontWeight: theme === t ? 700 : 500,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Size Option */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', marginBottom: '0.4rem' }}>
                    TEXT SIZE
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[100, 125].map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setTextScale(scale as any)}
                        style={{
                          flex: 1,
                          padding: '0.3rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          border: 'none',
                          background: textScale === scale ? '#2DD4BF' : 'rgba(255,255,255,0.06)',
                          color: textScale === scale ? '#090A0D' : '#CBD5E1',
                          fontWeight: textScale === scale ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {scale === 100 ? 'Default' : 'Large'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Details & Code button */}
          <button
            onClick={() => setIsDetailsOpen(true)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              color: '#FFFFFF',
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Code2 size={14} />
            <span>Details & Code</span>
          </button>

          {/* Link to Full Research Mode (/app) */}
          <Link
            to="/app"
            style={{
              background: '#2DD4BF',
              color: '#090A0D',
              borderRadius: '6px',
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>Research Mode</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* Main Content Container */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 2rem 5rem', display: 'flex', flexDirection: 'column', gap: '5rem' }}>
        {/* ============================================================== */}
        {/* SECTION 1 — HERO                                               */}
        {/* ============================================================== */}
        <section
          style={{
            padding: '4.5rem 0 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '1.5rem',
            position: 'relative',
          }}
        >
          {/* Subtle top indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.3rem 0.85rem',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.8rem',
              color: '#CBD5E1',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2DD4BF' }} />
            <span>Smart India Hackathon 2026 • Problem SIH26037</span>
          </div>

          {/* Headline (7 words <= 9 words) */}
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
              fontWeight: 900,
              color: '#FFFFFF',
              lineHeight: 1.15,
              maxWidth: '820px',
              margin: 0,
              letterSpacing: '-0.03em',
            }}
          >
            Self-driving navigation built for Indian roads.
          </h1>

          {/* Single Supporting Sentence */}
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              color: '#94A3B8',
              maxWidth: '680px',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Predicts what cows, rickshaws, and carts will do next, then plans a smooth path around them.
          </p>

          {/* Call to Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={scrollToDemo}
              style={{
                background: '#2DD4BF',
                color: '#090A0D',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(45, 212, 191, 0.3)',
              }}
            >
              <Play size={16} fill="#090A0D" />
              <span>Watch it drive</span>
            </button>

            <button
              onClick={() => setIsTourOpen(true)}
              style={{
                background: 'transparent',
                color: '#CBD5E1',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.75rem 1.25rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Play full demo tour (3 min)
            </button>
          </div>

          {/* 4 Dataset Chips linking to #our-data */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginTop: '1rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              DATA SOURCES:
            </span>

            <a
              href="#our-data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                color: '#CBD5E1',
                textDecoration: 'none',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }} />
              <span>IDD: Adapter only</span>
            </a>

            <a
              href="#our-data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                color: '#CBD5E1',
                textDecoration: 'none',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748B' }} />
              <span>Mendeley: Not yet ingested</span>
            </a>

            <a
              href="#our-data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                color: '#CBD5E1',
                textDecoration: 'none',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2DD4BF' }} />
              <span>MathWorks: In use</span>
            </a>

            <a
              href="#our-data"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                color: '#CBD5E1',
                textDecoration: 'none',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2DD4BF' }} />
              <span>Synthetic: In use (75 eps)</span>
            </a>
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 2 — THE DEMO STAGE (THE CORE)                         */}
        {/* ============================================================== */}
        <section
          id="demo-stage"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            background: '#0F1116',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '1.5rem',
          }}
        >
          {/* Top Controls Bar: Scenario Picker + Layer Chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ScenarioPicker activeKey={activeScenarioKey} onSelect={(k) => setActiveScenarioKey(k)} />

            {/* Layer Toggles */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                SYNCHRONIZED REPLAY LAYERS:
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowSensors(!showSensors)}
                  style={{
                    background: showSensors ? 'rgba(45, 212, 191, 0.15)' : 'transparent',
                    color: showSensors ? '#2DD4BF' : '#94A3B8',
                    border: `1px solid ${showSensors ? 'rgba(45, 212, 191, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '6px',
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Eye size={13} />
                  <span>Sensors (Camera/LiDAR/Radar)</span>
                </button>

                <button
                  onClick={() => setShowPredictions(!showPredictions)}
                  style={{
                    background: showPredictions ? 'rgba(45, 212, 191, 0.15)' : 'transparent',
                    color: showPredictions ? '#2DD4BF' : '#94A3B8',
                    border: `1px solid ${showPredictions ? 'rgba(45, 212, 191, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '6px',
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <GitBranch size={13} />
                  <span>Predictions (Multi-Hypothesis)</span>
                </button>

                <button
                  onClick={() => setShowRiskField(!showRiskField)}
                  style={{
                    background: showRiskField ? 'rgba(45, 212, 191, 0.15)' : 'transparent',
                    color: showRiskField ? '#2DD4BF' : '#94A3B8',
                    border: `1px solid ${showRiskField ? 'rgba(45, 212, 191, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: '6px',
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Shield size={13} />
                  <span>Risk Field (Danger Heatmap)</span>
                </button>
              </div>
            </div>
          </div>

          {/* DUAL SYNCHRONIZED TOP-DOWN VIEWS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* LEFT: Standard Planner (Dynamic Window Approach / Velocity Obstacles) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94A3B8' }}>
                  Standard planner (B1: DWA + velocity obstacles)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Fixed speed window</span>
              </div>

              <SimCanvas
                frame={standardFrame}
                variant="standard"
                showSensors={showSensors}
                showPredictions={showPredictions}
                showRiskField={showRiskField}
                height={380}
              />

              <OutcomeBanner metrics={scenarioData?.standard.metrics} variant="standard" />

              <ThinkingBox
                frame={standardFrame}
                variant="standard"
                plannerName="B1 Classical Controller"
              />
            </div>

            {/* RIGHT: ADAPTIVE-PATH (P3: Multi-Hypothesis + Conformal Safety) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2DD4BF' }}>
                  ADAPTIVE-PATH (P3: Conformal Risk Field)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#2DD4BF', background: 'rgba(45, 212, 191, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  Adaptive strategy
                </span>
              </div>

              <SimCanvas
                frame={adaptiveFrame}
                variant="adaptive"
                showSensors={showSensors}
                showPredictions={showPredictions}
                showRiskField={showRiskField}
                height={380}
              />

              <OutcomeBanner metrics={scenarioData?.adaptive.metrics} variant="adaptive" />

              <ThinkingBox
                frame={adaptiveFrame}
                variant="adaptive"
                plannerName="P3 Adaptive Controller"
              />
            </div>
          </div>

          {/* Shared Timeline Scrubber */}
          <TimelineScrubber
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSeek={(t) => setCurrentTime(t)}
            onReset={() => setCurrentTime(0.0)}
            onChangeSpeed={(spd) => setPlaybackSpeed(spd)}
          />
        </section>

        {/* ============================================================== */}
        {/* SECTION 3 — THE RESULTS                                        */}
        {/* ============================================================== */}
        <ResultsSection summary={summaryData} />

        {/* ============================================================== */}
        {/* SECTION 4 — OUR DATA (PROVENANCE & INTEGRITY)                  */}
        {/* ============================================================== */}
        <OurDataSection provenance={provenanceData} />

        {/* ============================================================== */}
        {/* SECTION 5 — HOW IT WORKS                                       */}
        {/* ============================================================== */}
        <HowItWorksStrip />
      </main>

      {/* ============================================================== */}
      {/* FOOTER                                                         */}
      {/* ============================================================== */}
      <footer
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#08090C',
          padding: '2.5rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 800, color: '#FFFFFF' }}>ADAPTIVE-PATH</span>
          <span style={{ color: '#4B5563' }}>•</span>
          <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>
            Smart India Hackathon SIH26037 (MathWorks)
          </span>
        </div>

        {/* Essential road-readiness disclaimer */}
        <div
          style={{
            fontSize: '0.8rem',
            color: '#FBBF24',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            padding: '0.35rem 0.85rem',
            borderRadius: '6px',
            maxWidth: '480px',
          }}
        >
          Simulation only. Not road-ready. Evaluated in synthetic 2D unstructured road environments.
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#64748B', marginTop: '0.5rem' }}>
          <Link to="/app" style={{ color: '#94A3B8', textDecoration: 'none' }}>
            Full Research Studio (/app)
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#94A3B8', textDecoration: 'none' }}
          >
            Repository & Code
          </a>
          <button
            onClick={() => setIsDetailsOpen(true)}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
          >
            Reproduction Command
          </button>
        </div>
      </footer>

      {/* Slide-over Technical Details Drawer */}
      <DetailsDrawer
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        provenance={provenanceData}
      />

      {/* 3-Minute Guided Demo Tour Overlay */}
      <DemoTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onSelectScenario={(k) => setActiveScenarioKey(k)}
        onToggleLayer={(layer, val) => {
          if (layer === 'sensors') setShowSensors(val);
          if (layer === 'predictions') setShowPredictions(val);
          if (layer === 'risk') setShowRiskField(val);
        }}
        onSeekTime={(t) => setCurrentTime(t)}
        onPlayReplay={() => setIsPlaying(true)}
      />
    </div>
  );
};
