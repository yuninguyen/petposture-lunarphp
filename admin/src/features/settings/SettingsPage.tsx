import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiSettingsForm } from './AiSettingsForm';
import { AnalyticsSettingsForm } from './AnalyticsSettingsForm';
import { BrandingSettingsForm } from './BrandingSettingsForm';
import { GeneralSettingsForm } from './GeneralSettingsForm';
import { SmtpSettingsForm } from './SmtpSettingsForm';

type SettingsTab = 'general' | 'branding' | 'analytics' | 'smtp' | 'ai';

const TABS: Array<{ key: SettingsTab; labelKey: string }> = [
  { key: 'general', labelKey: 'settings.tabs.general' },
  { key: 'branding', labelKey: 'settings.tabs.branding' },
  { key: 'analytics', labelKey: 'settings.tabs.analytics' },
  { key: 'smtp', labelKey: 'settings.tabs.smtp' },
  { key: 'ai', labelKey: 'settings.tabs.ai' },
];

const FORMS: Record<SettingsTab, () => JSX.Element> = {
  general: GeneralSettingsForm,
  branding: BrandingSettingsForm,
  analytics: AnalyticsSettingsForm,
  smtp: SmtpSettingsForm,
  ai: AiSettingsForm,
};

export function SettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const ActiveForm = FORMS[activeTab];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('settings.subtitle')}</p>
      </header>

      <div className="border-b border-slate-200">
        <div role="tablist" aria-label={t('settings.title')} className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`settings-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`settings-panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <section
        key={activeTab}
        id={`settings-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <ActiveForm />
      </section>
    </div>
  );
}
