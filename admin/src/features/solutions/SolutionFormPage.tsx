import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { fetchJson } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SearchableMultiSelect } from '@/components/ui/SearchableMultiSelect';
import { MediaPicker } from '@/features/media/MediaPicker';
import toast from 'react-hot-toast';
import { useCreateSolution, useUpdateSolution, useSolution, Solution } from './solutionsApi';
import { SeoSettingsSection } from '../posts/SeoSettingsSection';

interface SolutionFormValues {
  name: string;
  slug: string;
  description: string;
  featured_image: string | null;
  featured_image_alt: string | null;
  featured_media_id: number | null;
  seo: {
    title?: string;
    keyphrase?: string;
    description?: string;
    og_title?: string;
    og_description?: string;
    og_image?: string | null;
  };
  product_ids: number[];
  post_ids: number[];
}

export function SolutionFormPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: solutionData, isLoading: isLoadingSolution } = useSolution(id ? Number(id) : undefined);
  const solution = solutionData?.data;

  // Temporary basic fetchers for select options
  const { data: postsData } = useQuery({
    queryKey: ['admin-posts-all'],
    queryFn: () => fetchJson<any>('/admin/posts?per_page=100'),
  });
  const posts = postsData?.data || [];

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => fetchJson<any>('/products?per_page=100'),
  });
  const products = productsData?.data || [];

  const createMutation = useCreateSolution();
  const updateMutation = useUpdateSolution();

  const { register, handleSubmit, control, reset, watch, setValue, getValues, formState: { errors, isSubmitting } } = useForm<SolutionFormValues>({
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      featured_image: null,
      featured_image_alt: '',
      featured_media_id: null,
      seo: {
        title: '',
        keyphrase: '',
        description: '',
        og_title: '',
        og_description: '',
        og_image: null,
      },
      product_ids: [],
      post_ids: [],
    }
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm text-sm max-w-none focus:outline-none min-h-[120px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      setValue('description', editor.getHTML(), { shouldDirty: true });
    },
  });

  useEffect(() => {
    if (solution && isEditing) {
      reset({
        name: solution.name || '',
        slug: solution.slug || '',
        description: solution.description || '',
        featured_image: solution.featured_image || null,
        featured_image_alt: solution.featured_image_alt || '',
        featured_media_id: solution.featured_media_id || null,
        seo: {
          title: solution.seo?.title ?? '',
          keyphrase: solution.seo?.keyphrase ?? '',
          description: solution.seo?.description ?? '',
          og_title: solution.seo?.og_title ?? '',
          og_description: solution.seo?.og_description ?? '',
          og_image: solution.seo?.og_image ?? null,
        },
        product_ids: solution.products?.map((p: any) => p.id) || [],
        post_ids: solution.posts?.map((p: any) => p.id) || [],
      });
      if (editor && solution.description !== editor.getHTML()) {
        editor.commands.setContent(solution.description || '');
      }
    }
  }, [solution, isEditing, reset, editor]);

  const onSubmit = async (data: SolutionFormValues) => {
    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({ id: Number(id), data });
        toast.success(t('solutions.update_success', 'Solution updated successfully'));
      } else {
        await createMutation.mutateAsync(data);
        toast.success(t('solutions.create_success', 'Solution created successfully'));
      }
      navigate('/solutions');
    } catch (error: any) {
      toast.error(error.message || t('common.error_occurred', 'An error occurred'));
    }
  };

  const nameValue = watch('name');
  const previewSlug = watch('slug') ?? '';
  const previewImage = watch('featured_image');
  useEffect(() => {
    if (!isEditing && nameValue) {
      const slug = nameValue
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setValue('slug', slug, { shouldValidate: true });
    }
  }, [nameValue, isEditing, setValue]);

  if (isEditing && isLoadingSolution) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={() => navigate('/solutions')} className="text-slate-500 hover:text-slate-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            {t('common.back')}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEditing ? t('common.edit', 'Edit') : t('solutions.new_solution', 'New Solution')}
          </h1>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate('/solutions')}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
          >
            {(isSubmitting || createMutation.isPending || updateMutation.isPending) && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            )}
            {t('common.save', 'Save')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Information (6 columns) */}
          <Card className="lg:col-span-6 p-6 border-slate-200 shadow-sm h-full flex flex-col">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Main Information</h3>
            <div className="flex flex-col sm:flex-row gap-6 mb-6">
              {/* Left side: Image */}
              <div className="w-full sm:w-1/3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Featured Image</label>
                <Controller
                  control={control}
                  name="featured_image"
                  render={({ field: { value, onChange } }) => (
                    <div className="space-y-4">
                      <MediaPicker
                        context="solution"
                        value={value ? { id: String(control._formValues.featured_media_id), url: value } : null}
                        onChange={(media) => {
                          onChange(media ? media.url : null);
                          setValue('featured_media_id', media ? Number(media.id) : null);
                        }}
                      />
                    </div>
                  )}
                />
              </div>

              {/* Right side: Main Information Fields */}
              <div className="flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t('solutions.name', 'Name')} <span className="text-red-500">*</span>
                    </label>
                    <Input
                      {...register('name', { required: t('validation.required', 'This field is required') })}
                      placeholder="e.g. Ergonomic Office"
                      className={errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {t('solutions.slug', 'Slug')} <span className="text-red-500">*</span>
                    </label>
                    <Input
                      {...register('slug', { required: t('validation.required', 'This field is required') })}
                      placeholder="e.g. ergonomic-office"
                      className={`font-mono text-sm ${errors.slug ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    />
                    {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>}
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Image Alt Text
                    </label>
                    <Input {...register('featured_image_alt')} placeholder="Leave blank to use solution name" className="text-sm h-10" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('solutions.description', 'Description')}
              </label>
              <div className="border border-slate-200 rounded-md overflow-hidden bg-white focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <EditorContent editor={editor} />
              </div>
            </div>
          </Card>

          {/* SEO & Social (6 columns) */}
          <div className="lg:col-span-6 flex flex-col h-full">
            <SeoSettingsSection 
              control={control as any} 
              register={register as any} 
              setValue={setValue as any} 
              getValues={getValues as any} 
              titleKey="name"
              contentKey="description"
              googlePreviewImage={previewImage}
              googlePreviewPath={`shop/solutions/${previewSlug.trim() || 'solution'}`}
            />
          </div>
        </div>

        {/* Related Content Row */}
        <Card className="p-6 border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Related Content</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Products ({products.length})
              </label>
              <Controller
                control={control}
                name="product_ids"
                render={({ field: { value, onChange } }) => (
                  <SearchableMultiSelect
                    options={products.map((p: any) => ({ id: p.id, label: p.name || p.title }))}
                    value={value}
                    onChange={onChange}
                    placeholder="Search products..."
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Posts ({posts.length})
              </label>
              <Controller
                control={control}
                name="post_ids"
                render={({ field: { value, onChange } }) => (
                  <SearchableMultiSelect
                    options={posts.map((p: any) => ({ id: p.id, label: p.title }))}
                    value={value}
                    onChange={onChange}
                    placeholder="Search posts..."
                  />
                )}
              />
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
