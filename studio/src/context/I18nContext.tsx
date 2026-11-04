/**
 * Internationalization (i18n) Context.
 * Supports English, Hindi (हिन्दी), and Telugu (తెలుగు).
 * Fulfills hard requirement for regional language accessibility (WCAG 2.2 AA).
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'hi' | 'te';

interface Translations {
  [key: string]: {
    en: string;
    hi: string;
    te: string;
  };
}

const DICTIONARY: Translations = {
  // Mode switcher
  mode_simple: { en: 'Simple Mode', hi: 'सरल मोड', te: 'సాధారణ మోడ్' },
  mode_research: { en: 'Research Mode', hi: 'अनुसंधान मोड', te: 'పరిశోధన మోడ్' },
  mode_simple_desc: {
    en: 'Streamlined experience for first-time visitors, evaluators, and judges with plain-English decisions',
    hi: 'सरल अनुभव',
    te: 'సరళమైన అనుభవం',
  },
  mode_research_desc: {
    en: 'Full research telemetry, all 6 planners, conformal uncertainty envelopes, and validation provenance',
    hi: 'पूर्ण अनुसंधान टेलीमेट्री',
    te: 'పరిశోధన టెలిమెట్రీ',
  },
  // Navigation & 4-Workspace Architecture
  workspace_home: { en: 'Home', hi: 'होम', te: 'హోమ్' },
  workspace_simulate: { en: 'Simulate', hi: 'सिमुलेट', te: 'సిమ్యులేట్' },
  workspace_results: { en: 'Results', hi: 'परिणाम', te: 'ఫలితాలు' },
  workspace_research: { en: 'Research', hi: 'अनुसंधान', te: 'పరిశోధన' },
  nav_overview: { en: 'Dashboard', hi: 'डैशबोर्ड', te: 'డ్యాష్‌బోర్డ్' },
  nav_scenarios: { en: 'Scenarios', hi: 'परिदृश्य', te: 'సన్నివేశాలు' },
  nav_new_run: { en: 'Start Simulation', hi: 'सिमुलेशन शुरू करें', te: 'రన్ ప్రారంభించండి' },
  nav_runs: { en: 'Replay Viewer', hi: 'रीप्ले दर्शक', te: 'రీప్లే వ్యూయర్' },
  nav_compare: { en: 'Compare', hi: 'तुलना करें', te: 'పోల్చండి' },
  nav_benchmark: { en: 'Strategy Benchmark', hi: 'बेंचमार्क मूल्यांकन', te: 'బెంచ్‌మార్క్' },
  nav_failures: { en: 'Failure Analysis', hi: 'विफलता अन्वेषक', te: 'వైఫల్యాల విశ్లేషణ' },
  nav_reports: { en: 'Research Reports', hi: 'अनुसंधान रिपोर्ट', te: 'పరిశోధన నివేదికలు' },
  nav_settings: { en: 'Settings', hi: 'सेटिंग्स', te: 'సెట్టింగ్‌లు' },
  nav_admin: { en: 'Administration', hi: 'प्रशासन', te: 'నిర్వాహణ' },

  // App Title & Tagline
  app_title: { en: 'ADAPTIVE-PATH Studio', hi: 'अडैप्टिव-पाथ स्टूडियो', te: 'అడాప్టివ్-పాత్ స్టూడియో' },
  app_subtitle: {
    en: 'Smart driving simulation and collision avoidance for unstructured Indian roads (SIH 2026)',
    hi: 'असंरचित भारतीय सड़कों के लिए जोखिम-जागरूक भविष्यसूचक पथ नियोजन एवं सिमुलेशन (SIH 2026)',
    te: 'అసంఘటిత భారతీయ రహదారుల కోసం ప్రమాద-అవగాహన ప్రిడిక్టివ్ పాత్ ప్లానింగ్ & సిమ్యులేషన్ (SIH 2026)',
  },

  // Replay & Controls
  play: { en: 'Play', hi: 'चलाएं', te: 'ప్లే చేయండి' },
  pause: { en: 'Pause', hi: 'रोकें', te: 'పాజ్ చేయండి' },
  speed: { en: 'Speed', hi: 'गति', te: 'వేగం' },
  layers: { en: 'Layers', hi: 'परतें', te: 'పొరలు' },
  layer_world: { en: 'Road & Boundaries', hi: 'सड़क और सीमाएं', te: 'రహదారి & సరిహద్దులు' },
  layer_tracks: { en: 'Moving Traffic', hi: 'गतिशील वाहन/एजेंट', te: 'వాహనాలు / ఏజెంట్లు' },
  layer_cones: { en: 'Safety Margins', hi: 'अनिश्चितता शंकु', te: 'అనిశ్చితి కోన్స్' },
  layer_risk: { en: 'Hazard Risk Areas', hi: 'जोखिम क्षेत्र', te: 'ప్రమాద క్షేత్రం' },
  layer_path: { en: 'Planned Driving Route', hi: 'नियोजित पथ', te: 'ప్రణాళికా మార్గం' },
  reset: { en: 'Reset to Start', hi: 'प्रारंभ पर लौटें', te: 'మొదటికి రీసెట్' },
  step_back: { en: 'Step Back (0.1s)', hi: 'पीछे जाएं (0.1s)', te: 'వెనక్కి వెళ్ళండి (0.1s)' },
  step_forward: { en: 'Step Forward (0.1s)', hi: 'आगे जाएं (0.1s)', te: 'ముందుకు వెళ్ళండి (0.1s)' },

  // Telemetry
  risk_score: { en: 'Estimated Collision Risk', hi: 'जोखिम मान R(t)', te: 'ప్రమాద స్కోరు R(t)' },
  clearance: { en: 'Closest Hazard Buffer', hi: 'न्यूनतम दूरी', te: 'కనిష్ట దూరం' },
  speed_metric: { en: 'Vehicle Speed', hi: 'वाहन गति', te: 'వాహన వేగం' },
  replan_count: { en: 'Path Adjustments', hi: 'पुनर्निर्मित पथ', te: 'రీప్లాన్‌లు' },
  max_jerk: { en: 'Ride Smoothness (Jerk)', hi: 'अधिकतम जर्क', te: 'గరిష్ట జెర్క్' },
  p95_latency: { en: 'Average Planning Time', hi: 'P95 विलंबता', te: 'P95 ఆలస్యం' },

  // Risk badges (Never color alone)
  risk_low: { en: 'LOW HAZARD', hi: 'कम जोखिम', te: 'తక్కువ ప్రమాదం' },
  risk_medium: { en: 'MEDIUM RISK', hi: 'मध्यम जोखिम', te: 'మధ్యస్థ ప్రమాదం' },
  risk_high: { en: 'HIGH RISK', hi: 'उच्च जोखिम', te: 'అధిక ప్రమాదం' },
  risk_critical: { en: 'CRITICAL HAZARD', hi: 'गंभीर संकट', te: 'తీవ్రమైన ప్రమాదం' },

  // Chart data toggle
  toggle_data_table: { en: 'Toggle Data Table', hi: 'डेटा तालिका दिखाएं/छुपाएं', te: 'డేటా పట్టిక టోగుల్' },
  accessible_view: { en: 'Accessible Table View', hi: 'सुलभ तालिका दृश्य', te: 'పట్టిక వీక్షణ' },
  visual_view: { en: 'Visual Chart View', hi: 'दृश्य चार्ट दृश्य', te: 'చార్ట్ వీక్షణ' },

  // Common buttons & states
  demo_mode: { en: 'Demo Guest Mode', hi: 'डेमो अतिथि मोड', te: 'డెమో మోడ్' },
  login: { en: 'Sign In', hi: 'साइन इन करें', te: 'సైన్ ఇన్' },
  signup: { en: 'Create Account', hi: 'खाता बनाएं', te: 'ఖాతా సృష్టించండి' },
  logout: { en: 'Sign Out', hi: 'साइन आउट', te: 'సైన్ అవుట్' },
  offline_notice: {
    en: 'Offline Mode: Browsing 14 pre-bundled verified SIH2026 runs.',
    hi: 'ऑफ़लाइन मोड: 14 पूर्व-संलग्न सत्यापित रन देख रहे हैं।',
    te: 'ఆఫ్‌లైన్ మోడ్: 14 రికార్డ్ చేసిన రన్‌లను చూస్తున్నారు.',
  },
  keyboard_shortcuts: { en: 'Keyboard Shortcuts', hi: 'कीबोर्ड शॉर्टकट', te: 'కీబోర్డ్ సత్వరమార్గాలు' },
  export_report: { en: 'Export Report', hi: 'रिपोर्ट निर्यात करें', te: 'నివేదికను ఎగుమతి చేయండి' },
  launch_batch: { en: 'Launch Batch Ablation', hi: 'बैच स्वीप शुरू करें', te: 'బ్యాచ్ రన్ ప్రారంభించండి' },
  filter_by_split: { en: 'Filter by Split', hi: 'स्प्लिट अनुसार फ़िल्टर', te: 'స్ప్లిట్ ద్వారా ఫిల్టర్' },
  search_placeholder: { en: 'Search scenarios, runs, tags...', hi: 'खोजें...', te: 'శోధించండి...' },
  not_found_title: { en: 'Page Not Found', hi: 'पृष्ठ नहीं मिला', te: 'పేజీ కనుగొనబడలేదు' },
  not_found_desc: {
    en: 'The requested studio route does not exist. Use the navigation links below.',
    hi: 'अनुरोधित पृष्ठ मौजूद नहीं है। नीचे दिए गए लिंक का उपयोग करें।',
    te: 'అభ్యర్థించిన పేజీ లేదు. దయచేసి క్రింది లింక్‌లను ఉపయోగించండి.',
  },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('apath_language') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('apath_language', lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    const item = DICTIONARY[key];
    if (!item) return key;
    return item[language] || item.en || key;
  };

  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => useContext(I18nContext);
