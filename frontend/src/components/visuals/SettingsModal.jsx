import React, { useState } from 'react';
import {
  X,
  User,
  Shield,
  Sliders,
  Globe,
  Sun,
  Moon,
  Check,
  RotateCcw,
  FileText,
  Type,
  Eye,
  Activity,
  CheckCircle2,
  Lock,
  Building
} from 'lucide-react';
import { getTranslation } from '../../utils/i18n';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onOpenDossier
}) {
  if (!isOpen) return null;

  // Local state initialized from incoming settings
  const [activeTab, setActiveTab] = useState('personalization'); // 'personalization' | 'accessibility' | 'language' | 'appearance'
  const [formData, setFormData] = useState({
    officerName: settings.officerName || 'Vikramaditya Rathore',
    badgeId: settings.badgeId || 'RJ-POL-8821',
    station: settings.station || 'Cyber Crime Police Station, Jaipur',
    defaultView: settings.defaultView || 'tower-map',
    timeFormat: settings.timeFormat || '24h',
    theme: settings.theme || 'light',
    language: settings.language || 'en',
    fontSize: settings.fontSize || 'standard',
    highContrast: !!settings.highContrast,
    reducedMotion: !!settings.reducedMotion,
    screenReader: !!settings.screenReader
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const t = (key) => getTranslation(key, formData.language);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleReset = () => {
    const defaults = {
      officerName: 'Vikramaditya Rathore',
      badgeId: 'RJ-POL-8821',
      station: 'Cyber Crime Police Station, Jaipur',
      defaultView: 'tower-map',
      timeFormat: '24h',
      theme: 'light',
      language: 'en',
      fontSize: 'standard',
      highContrast: false,
      reducedMotion: false,
      screenReader: false
    };
    setFormData(defaults);
    onSaveSettings(defaults);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-base tracking-tight text-white">{t('settings_title')}</h3>
                <span className="text-[10px] font-mono uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-semibold">
                  v2.4 SEC-OPS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t('settings_subtitle')}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Settings"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 pt-2.5 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('personalization')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
              activeTab === 'personalization'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t('tab_personalization')}</span>
          </button>

          <button
            onClick={() => setActiveTab('accessibility')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
              activeTab === 'accessibility'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t('tab_accessibility')}</span>
          </button>

          <button
            onClick={() => setActiveTab('language')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
              activeTab === 'language'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{t('tab_language')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono uppercase">
              {formData.language.toUpperCase()}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            className={`pb-2.5 px-3 border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {formData.theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-blue-600" /> : <Sun className="w-3.5 h-3.5" />}
            <span>{t('tab_appearance')}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono uppercase">
              {formData.theme}
            </span>
          </button>
        </div>

        {/* Tab Contents Area */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1 custom-scrollbar">

          {/* TAB 1: PERSONALIZATION */}
          {activeTab === 'personalization' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start space-x-2.5">
                <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">{t('pers_saved_hint')}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Officer Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('pers_officer_name')}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={formData.officerName}
                      onChange={(e) => handleFieldChange('officerName', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none font-medium"
                      placeholder="Vikramaditya Rathore"
                    />
                  </div>
                </div>

                {/* Badge ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('pers_badge_id')}
                  </label>
                  <div className="relative">
                    <Shield className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={formData.badgeId}
                      onChange={(e) => handleFieldChange('badgeId', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none font-mono font-medium"
                      placeholder="RJ-POL-8821"
                    />
                  </div>
                </div>

                {/* Assigned Station / Cell */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('pers_station')}
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={formData.station}
                      onChange={(e) => handleFieldChange('station', e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none font-medium"
                      placeholder="Cyber Crime Police Station, Jaipur"
                    />
                  </div>
                </div>

                {/* Default Landing View */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('pers_default_view')}
                  </label>
                  <select
                    value={formData.defaultView}
                    onChange={(e) => handleFieldChange('defaultView', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none font-medium bg-white"
                  >
                    <option value="tower-map">{t('pers_view_tower')}</option>
                    <option value="network">{t('pers_view_network')}</option>
                    <option value="upload">{t('pers_view_ingest')}</option>
                    <option value="overview">{t('pers_view_overview')}</option>
                  </select>
                </div>

                {/* Forensic Time Format */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('pers_timezone')}
                  </label>
                  <select
                    value={formData.timeFormat}
                    onChange={(e) => handleFieldChange('timeFormat', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none font-medium bg-white"
                  >
                    <option value="24h">IST 24-Hour Military (YYYY-MM-DD HH:mm:ss)</option>
                    <option value="12h">IST Standard 12-Hour (DD/MM/YYYY hh:mm A)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACCESSIBILITY */}
          {activeTab === 'accessibility' && (
            <div className="space-y-4">
              {/* Text Scaling */}
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center space-x-2 text-slate-800">
                  <Type className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-xs">{t('access_text_scale')}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFieldChange('fontSize', 'standard')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors ${
                      formData.fontSize === 'standard'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {formData.fontSize === 'standard' && <Check className="w-3.5 h-3.5" />}
                    <span>{t('access_scale_std')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFieldChange('fontSize', 'large')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors ${
                      formData.fontSize === 'large'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {formData.fontSize === 'large' && <Check className="w-3.5 h-3.5" />}
                    <span className="font-semibold">{t('access_scale_large')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFieldChange('fontSize', 'xlarge')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors ${
                      formData.fontSize === 'xlarge'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {formData.fontSize === 'xlarge' && <Check className="w-3.5 h-3.5" />}
                    <span className="font-bold">{t('access_scale_xlarge')}</span>
                  </button>
                </div>
              </div>

              {/* High Contrast Mode Toggle */}
              <div className="p-4 rounded-lg border border-slate-200 bg-white flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-slate-900">{t('access_contrast_title')}</span>
                    {formData.highContrast && (
                      <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('access_contrast_desc')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleFieldChange('highContrast', !formData.highContrast)}
                  aria-pressed={formData.highContrast}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                    formData.highContrast ? 'bg-slate-900' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      formData.highContrast ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Reduced Motion Toggle */}
              <div className="p-4 rounded-lg border border-slate-200 bg-white flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-slate-900">{t('access_motion_title')}</span>
                    {formData.reducedMotion && (
                      <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                        ENABLED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('access_motion_desc')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleFieldChange('reducedMotion', !formData.reducedMotion)}
                  aria-pressed={formData.reducedMotion}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                    formData.reducedMotion ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      formData.reducedMotion ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Screen Reader Optimization */}
              <div className="p-4 rounded-lg border border-slate-200 bg-white flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-semibold text-xs text-slate-900">{t('access_reader_title')}</span>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('access_reader_desc')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleFieldChange('screenReader', !formData.screenReader)}
                  aria-pressed={formData.screenReader}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                    formData.screenReader ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      formData.screenReader ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LANGUAGE CONVERSION (HINDI / ENGLISH) */}
          {activeTab === 'language' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-slate-900">{t('lang_select_title')}</h4>
                <p className="text-xs text-slate-500">{t('lang_select_desc')}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* English Option */}
                <button
                  type="button"
                  onClick={() => handleFieldChange('language', 'en')}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    formData.language === 'en'
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center font-mono">
                        EN
                      </span>
                      <span className="font-bold text-slate-900 text-sm">English</span>
                    </div>
                    {formData.language === 'en' && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Official standard for cyber forensics reports & Indian Evidence Act filings.
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-slate-400 font-mono">
                    Sample: "Tower Map & Movement Trail"
                  </div>
                </button>

                {/* Hindi Option */}
                <button
                  type="button"
                  onClick={() => handleFieldChange('language', 'hi')}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    formData.language === 'hi'
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center font-serif">
                        हिं
                      </span>
                      <span className="font-bold text-slate-900 text-sm">हिंदी (Hindi)</span>
                    </div>
                    {formData.language === 'hi' && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    राजस्थान पुलिस की आधिकारिक भाषा, थानों और केस डायरी के सुगम उपयोग हेतु।
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-emerald-700 font-sans">
                    नमूना: "टावर मैप एवं आवागमन पथ"
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: THEME / APPEARANCE (LIGHT / DARK MODE) */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-slate-900">{t('theme_title')}</h4>
                <p className="text-xs text-slate-500">{t('theme_desc')}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Light Mode Tile */}
                <button
                  type="button"
                  onClick={() => handleFieldChange('theme', 'light')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.theme === 'light'
                      ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-400 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Sun className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-900 text-sm">{t('theme_light')}</span>
                    </div>
                    {formData.theme === 'light' && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mb-3">{t('theme_light_desc')}</p>

                  {/* Visual Preview Swatch */}
                  <div className="h-12 rounded-lg bg-slate-50 border border-slate-200 p-2 flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-white border border-slate-300" />
                    <div className="flex-1 space-y-1">
                      <div className="h-2 w-16 bg-slate-300 rounded" />
                      <div className="h-1.5 w-24 bg-slate-200 rounded" />
                    </div>
                  </div>
                </button>

                {/* Dark Mode Tile */}
                <button
                  type="button"
                  onClick={() => handleFieldChange('theme', 'dark')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData.theme === 'dark'
                      ? 'border-blue-600 bg-slate-900 text-white shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-400 bg-slate-900 text-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-900/60 text-blue-300 flex items-center justify-center border border-blue-700/50">
                        <Moon className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-white text-sm">{t('theme_dark')}</span>
                    </div>
                    {formData.theme === 'dark' && (
                      <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 mb-3">{t('theme_dark_desc')}</p>

                  {/* Visual Preview Swatch */}
                  <div className="h-12 rounded-lg bg-slate-950 border border-slate-800 p-2 flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700" />
                    <div className="flex-1 space-y-1">
                      <div className="h-2 w-16 bg-slate-700 rounded" />
                      <div className="h-1.5 w-24 bg-slate-800 rounded" />
                    </div>
                  </div>
                </button>
              </div>

              {/* Direct Instant Theme Toggle Bar */}
              <div className="mt-4 p-3 bg-slate-100 rounded-lg flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Quick Switch Theme:</span>
                <button
                  type="button"
                  onClick={() => handleFieldChange('theme', formData.theme === 'dark' ? 'light' : 'dark')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center space-x-1.5 shadow-xs"
                >
                  {formData.theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-600" />
                      <span>Switch to Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-blue-600" />
                      <span>Switch to Dark Mode</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Quick Access to Official Dossier (helpful if user expected dossier or wants both) */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Looking for official court case reports?</span>
            {onOpenDossier && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDossier();
                }}
                className="text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t('open_dossier_btn')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 flex items-center space-x-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('btn_reset')}</span>
            </button>

            {savedSuccess && (
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('status_saved')}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              {t('btn_close')}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{t('btn_save')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
