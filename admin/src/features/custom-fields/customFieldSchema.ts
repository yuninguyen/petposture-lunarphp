import { z } from 'zod';

export const customFieldFormSchema = z.object({
  name: z.object({
    en: z.string().trim().min(1, 'custom_fields.validation.name_en_required'),
    vi: z.string().trim().optional(),
  }),
  handle: z.string().trim(),
  target: z.enum(['product', 'variant']),
  field_type: z.literal('text'),
  required: z.boolean(),
  product_type_ids: z.array(z.number().int().positive()).min(1, 'custom_fields.validation.product_type_required'),
});

export type CustomFieldFormValues = z.infer<typeof customFieldFormSchema>;

export function generateHandle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildCreatePayload(values: CustomFieldFormValues) {
  return {
    name: {
      en: values.name.en.trim(),
      ...(values.name.vi?.trim() ? { vi: values.name.vi.trim() } : {}),
    },
    ...(values.handle.trim() ? { handle: values.handle.trim() } : {}),
    target: values.target,
    field_type: 'text' as const,
    required: values.required,
    product_type_ids: values.product_type_ids,
  };
}

export function buildUpdatePayload(values: CustomFieldFormValues) {
  return {
    name: {
      en: values.name.en.trim(),
      ...(values.name.vi?.trim() ? { vi: values.name.vi.trim() } : {}),
    },
    required: values.required,
    product_type_ids: values.product_type_ids,
  };
}
