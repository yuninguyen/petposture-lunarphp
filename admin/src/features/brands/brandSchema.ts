import { z } from 'zod';

export interface BrandFormValues {
  name: string;
}

export const brandFormSchema = z.object({
  name: z.string().trim().min(1, 'brands.validation.name_required'),
});

export function buildBrandPayload(values: BrandFormValues) {
  return {
    name: values.name.trim(),
  };
}
