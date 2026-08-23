import { z } from 'zod';

export interface CollectionGroupFormValues {
  name: string;
  handle: string;
}

export const collectionGroupFormSchema = z.object({
  name: z.string().trim().min(1, 'collection_groups.validation.name_required').max(255, 'collection_groups.validation.name_max'),
  handle: z
    .string()
    .trim()
    .min(1, 'collection_groups.validation.handle_required')
    .max(255, 'collection_groups.validation.handle_max'),
});

export function generateCollectionGroupHandle(value: string): string {
  return value
    .replace(/[đĐ]/g, 'd')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function applyCollectionGroupNameChange(
  values: CollectionGroupFormValues,
  name: string,
  isEditing: boolean,
  handleEdited: boolean,
): CollectionGroupFormValues {
  return {
    ...values,
    name,
    ...(!isEditing && !handleEdited ? { handle: generateCollectionGroupHandle(name) } : {}),
  };
}

export function buildCollectionGroupPayload(values: CollectionGroupFormValues) {
  return {
    name: values.name.trim(),
    handle: values.handle.trim(),
  };
}
