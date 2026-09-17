import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJson = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ fetchJson }));

import {
  fetchAiModels,
  fetchAiSettings,
  fetchAnalyticsSettings,
  fetchBrandingSettings,
  fetchGeneralSettings,
  fetchSmtpSettings,
  testSmtpSettings,
  updateAiSettings,
  updateAnalyticsSettings,
  updateBrandingSettings,
  updateGeneralSettings,
  updateSmtpSettings,
  type AiModelFetchPayload,
  type AiSettingsPayload,
  type GeneralSettingsUpdatePayload,
  type SmtpSettingsPayload,
} from './api';

type IsExact<Actual, Expected> =
  [Actual] extends [Expected]
    ? [Expected] extends [Actual]
      ? true
      : false
    : false;
type Assert<Condition extends true> = Condition;
type GeneralShopNameRejectsNull = Assert<
  IsExact<GeneralSettingsUpdatePayload['shop_name'], string | undefined>
>;

const generalShopNameRejectsNull: GeneralShopNameRejectsNull = true;

describe('system settings API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('keeps the required shop name update type non-nullable', () => {
    expect(generalShopNameRejectsNull).toBe(true);
  });

  it('uses the five dedicated Laravel read endpoints', async () => {
    const responses = Array.from({ length: 5 }, (_, index) => ({ data: { index } }));
    responses.forEach((response) => fetchJson.mockResolvedValueOnce(response));

    await expect(fetchGeneralSettings()).resolves.toBe(responses[0]);
    await expect(fetchBrandingSettings()).resolves.toBe(responses[1]);
    await expect(fetchAnalyticsSettings()).resolves.toBe(responses[2]);
    await expect(fetchSmtpSettings()).resolves.toBe(responses[3]);
    await expect(fetchAiSettings()).resolves.toBe(responses[4]);

    expect(fetchJson).toHaveBeenNthCalledWith(1, '/admin/settings/general');
    expect(fetchJson).toHaveBeenNthCalledWith(2, '/admin/settings/branding');
    expect(fetchJson).toHaveBeenNthCalledWith(3, '/admin/settings/analytics');
    expect(fetchJson).toHaveBeenNthCalledWith(4, '/admin/settings/smtp');
    expect(fetchJson).toHaveBeenNthCalledWith(5, '/admin/settings/ai');
  });

  it('uses plain object bodies for all five update endpoints', async () => {
    const response = { data: {} };
    fetchJson.mockResolvedValue(response);
    const general = { shop_name: 'PetPosture', shop_logo: { media_id: '11' } };
    const branding = { admin_logo: null };
    const analytics = { google_analytics_id: 'G-TEST' };
    const smtp = { fields: { smtp_host: 'smtp.example.com', smtp_port: 587 }, clear_fields: ['smtp_pass'] } satisfies SmtpSettingsPayload;
    const ai = { fields: { ai_seo_provider: 'grok', openai_api_key: 'candidate' }, clear_fields: ['gemini_api_key'] } satisfies AiSettingsPayload;

    await updateGeneralSettings(general);
    await updateBrandingSettings(branding);
    await updateAnalyticsSettings(analytics);
    await updateSmtpSettings(smtp);
    await updateAiSettings(ai);

    expect(fetchJson).toHaveBeenNthCalledWith(1, '/admin/settings/general', { method: 'PUT', body: general });
    expect(fetchJson).toHaveBeenNthCalledWith(2, '/admin/settings/branding', { method: 'PUT', body: branding });
    expect(fetchJson).toHaveBeenNthCalledWith(3, '/admin/settings/analytics', { method: 'PUT', body: analytics });
    expect(fetchJson).toHaveBeenNthCalledWith(4, '/admin/settings/smtp', { method: 'PUT', body: smtp });
    expect(fetchJson).toHaveBeenNthCalledWith(5, '/admin/settings/ai', { method: 'PUT', body: ai });
    for (const [, options] of fetchJson.mock.calls) {
      expect(options.body).not.toBeInstanceOf(String);
      expect(typeof options.body).toBe('object');
    }
  });

  it('posts candidate payloads only to the Laravel SMTP test and AI model endpoints', async () => {
    const smtpResponse = { data: { status: 'sent', message: 'SMTP test email sent.' } };
    const modelsResponse = { data: { status: 'loaded', models: ['gpt-5'] } };
    fetchJson.mockResolvedValueOnce(smtpResponse).mockResolvedValueOnce(modelsResponse);
    const smtpPayload = { fields: { smtp_pass: 'smtp-candidate' }, clear_fields: ['smtp_user'] } satisfies SmtpSettingsPayload;
    const aiPayload = { fields: { openai_api_key: 'openai-candidate' }, clear_fields: ['openai_base_url'] } satisfies AiModelFetchPayload;

    await expect(testSmtpSettings(smtpPayload)).resolves.toBe(smtpResponse);
    await expect(fetchAiModels(aiPayload)).resolves.toBe(modelsResponse);

    expect(fetchJson).toHaveBeenNthCalledWith(1, '/admin/settings/smtp/test', { method: 'POST', body: smtpPayload });
    expect(fetchJson).toHaveBeenNthCalledWith(2, '/admin/settings/ai/fetch-models', { method: 'POST', body: aiPayload });
    expect(fetchJson.mock.calls.flatMap(([endpoint]) => endpoint)).not.toContain(expect.stringMatching(/^https?:\/\//));
  });
});
