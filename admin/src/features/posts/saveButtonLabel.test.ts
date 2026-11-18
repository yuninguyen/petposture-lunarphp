import { describe, expect, it } from 'vitest';
import en from '../../locales/en.json';
import vi from '../../locales/vi.json';
import { saveButtonLabelKey } from './saveButtonLabel';

describe('saveButtonLabelKey', () => {
  it('says "Save Schedule" for a scheduled post, not "Save Draft"', () => {
    expect(saveButtonLabelKey('scheduled', false)).toBe('posts.form_button_save_schedule');
  });

  it('keeps the other labels as they were', () => {
    expect(saveButtonLabelKey('draft', false)).toBe('posts.form_button_save_draft');
    expect(saveButtonLabelKey(undefined, false)).toBe('posts.form_button_save_draft');
    expect(saveButtonLabelKey('archived', false)).toBe('posts.form_button_save_draft');
    expect(saveButtonLabelKey('published', false)).toBe('posts.form_button_update_publish');
  });

  it('shows "Saving..." whatever the status while a save is running', () => {
    for (const status of ['draft', 'scheduled', 'published']) {
      expect(saveButtonLabelKey(status, true), status).toBe('posts.form_button_saving');
    }
  });

  it('has the label in English and Vietnamese', () => {
    const english = en as Record<string, string>;
    const vietnamese = vi as Record<string, string>;

    expect(english['posts.form_button_save_schedule']).toBe('Save Schedule');
    expect(vietnamese['posts.form_button_save_schedule']).toBe('Lưu lịch đăng');
  });
});
