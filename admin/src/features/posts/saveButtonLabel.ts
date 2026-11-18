/** The locale key of the post form's save button: it says what saving will do with the chosen status. */
export function saveButtonLabelKey(status: string | undefined, isSubmitting: boolean): string {
  if (isSubmitting) return 'posts.form_button_saving';
  if (status === 'published') return 'posts.form_button_update_publish';
  if (status === 'scheduled') return 'posts.form_button_save_schedule';

  return 'posts.form_button_save_draft';
}
