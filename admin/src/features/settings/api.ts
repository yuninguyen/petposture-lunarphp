import { fetchJson } from '@/lib/api';

export type SettingSource = 'database' | 'environment' | 'mixed' | 'none';
export type FieldSource = Exclude<SettingSource, 'mixed'>;
export type AiProvider = 'auto' | 'anthropic' | 'openai' | 'grok' | 'gemini';

export interface SafeSecretField {
  configured: boolean;
  source: FieldSource;
  hint: string;
}

export interface ValueField<T = string | null> extends SafeSecretField {
  value: T;
}

export interface MediaSettingValue {
  id: string | null;
  url: string;
}

export interface GeneralSettingsState {
  shop_name: string | null;
  shop_logo: MediaSettingValue | null;
  shop_favicon: MediaSettingValue | null;
  shop_description: string | null;
}

export interface BrandingSettingsState {
  admin_logo: MediaSettingValue | null;
  admin_favicon: MediaSettingValue | null;
}

export interface AnalyticsSettingsState {
  google_analytics_id: string | null;
}

export interface GeneralSettingsUpdatePayload {
  shop_name?: string;
  shop_logo?: { media_id: string } | null;
  shop_favicon?: { media_id: string } | null;
  shop_description?: string | null;
}

export interface BrandingSettingsUpdatePayload {
  admin_logo?: { media_id: string } | null;
  admin_favicon?: { media_id: string } | null;
}

export interface AnalyticsSettingsUpdatePayload {
  google_analytics_id?: string | null;
}

export interface SecureSettingsState<Fields> {
  configured: boolean;
  source: SettingSource;
  fields: Fields;
}

export interface SmtpSettingsFields {
  smtp_host: ValueField<string | null>;
  smtp_port: ValueField<number | null>;
  smtp_user: ValueField<string | null>;
  smtp_pass: SafeSecretField;
  smtp_encryption: ValueField<string | null>;
  mail_from_address: ValueField<string | null>;
}

export type SmtpSettingsState = SecureSettingsState<SmtpSettingsFields>;

export interface SmtpCandidateFields {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_encryption?: string;
  mail_from_address?: string;
}

export interface SmtpSettingsPayload {
  fields?: SmtpCandidateFields;
  clear_fields?: Array<keyof SmtpSettingsFields>;
}

export interface SmtpTestResult {
  status: 'sent' | 'invalid' | 'rejected' | 'unavailable';
  message: string;
}

export interface AiSettingsFields {
  ai_seo_provider: ValueField<AiProvider>;
  anthropic_api_key: SafeSecretField;
  anthropic_model: ValueField<string | null>;
  openai_api_key: SafeSecretField;
  openai_model: ValueField<string | null>;
  openai_base_url: ValueField<string | null>;
  xai_api_key: SafeSecretField;
  xai_model: ValueField<string | null>;
  gemini_api_key: SafeSecretField;
  gemini_model: ValueField<string | null>;
}

export type AiSettingsState = SecureSettingsState<AiSettingsFields>;

export interface AiCandidateFields {
  ai_seo_provider?: AiProvider;
  anthropic_api_key?: string;
  anthropic_model?: string;
  openai_api_key?: string;
  openai_model?: string;
  openai_base_url?: string;
  xai_api_key?: string;
  xai_model?: string;
  gemini_api_key?: string;
  gemini_model?: string;
}

export interface AiSettingsPayload {
  fields?: AiCandidateFields;
  clear_fields?: Array<keyof AiSettingsFields>;
}

export interface AiModelFetchPayload {
  fields?: Pick<AiCandidateFields, 'openai_api_key' | 'openai_base_url' | 'openai_model'>;
  clear_fields?: Array<'openai_api_key' | 'openai_base_url' | 'openai_model'>;
}

export interface AiModelFetchResult {
  status: 'loaded' | 'invalid' | 'unavailable';
  models: string[];
}

export interface ApiError<T = unknown> extends Error {
  status?: number;
  data?: T;
}

export function apiErrorData<T>(error: unknown): T | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null;
  return (error as ApiError<T>).data ?? null;
}

export function fetchGeneralSettings(): Promise<{ data: GeneralSettingsState }> {
  return fetchJson('/admin/settings/general');
}

export function updateGeneralSettings(payload: GeneralSettingsUpdatePayload): Promise<{ data: GeneralSettingsState }> {
  return fetchJson('/admin/settings/general', { method: 'PUT', body: { ...payload } });
}

export function fetchBrandingSettings(): Promise<{ data: BrandingSettingsState }> {
  return fetchJson('/admin/settings/branding');
}

export function updateBrandingSettings(payload: BrandingSettingsUpdatePayload): Promise<{ data: BrandingSettingsState }> {
  return fetchJson('/admin/settings/branding', { method: 'PUT', body: { ...payload } });
}

export function fetchAnalyticsSettings(): Promise<{ data: AnalyticsSettingsState }> {
  return fetchJson('/admin/settings/analytics');
}

export function updateAnalyticsSettings(payload: AnalyticsSettingsUpdatePayload): Promise<{ data: AnalyticsSettingsState }> {
  return fetchJson('/admin/settings/analytics', { method: 'PUT', body: { ...payload } });
}

export function fetchSmtpSettings(): Promise<{ data: SmtpSettingsState }> {
  return fetchJson('/admin/settings/smtp');
}

export function updateSmtpSettings(payload: SmtpSettingsPayload): Promise<{ data: SmtpSettingsState }> {
  return fetchJson('/admin/settings/smtp', { method: 'PUT', body: { ...payload } });
}

export function testSmtpSettings(payload: SmtpSettingsPayload): Promise<{ data: SmtpTestResult }> {
  return fetchJson('/admin/settings/smtp/test', { method: 'POST', body: { ...payload } });
}

export function fetchAiSettings(): Promise<{ data: AiSettingsState }> {
  return fetchJson('/admin/settings/ai');
}

export function updateAiSettings(payload: AiSettingsPayload): Promise<{ data: AiSettingsState }> {
  return fetchJson('/admin/settings/ai', { method: 'PUT', body: { ...payload } });
}

export function fetchAiModels(payload: AiModelFetchPayload): Promise<{ data: AiModelFetchResult }> {
  return fetchJson('/admin/settings/ai/fetch-models', { method: 'POST', body: { ...payload } });
}
