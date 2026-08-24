import { z } from 'zod';

export interface CollectionFormValues {
  name: string;
}

export interface BuildCollectionFormDataOptions {
  collectionGroupId: number;
  parentId?: number | null;
  includePlacement?: boolean;
  isUpdate?: boolean;
}

export const emptyCollectionFormValues: CollectionFormValues = {
  name: '',
};

export const collectionFormSchema = z.object({
  name: z.string().trim().min(1, 'collections.validation.name_required').max(255, 'collections.validation.name_max'),
});

export function buildCollectionFormData(
  values: CollectionFormValues,
  options: BuildCollectionFormDataOptions,
): FormData {
  const data = new FormData();
  const name = values.name.trim();
  data.append('name[en]', name);
  data.append('name[vi]', name);

  if (options.includePlacement !== false) {
    data.append('collection_group_id', String(options.collectionGroupId));
    if (options.parentId !== null && options.parentId !== undefined) {
      data.append('parent_id', String(options.parentId));
    }
  }

  if (options.isUpdate) data.append('_method', 'PUT');

  return data;
}
