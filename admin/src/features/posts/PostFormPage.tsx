import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { fetchJson } from '@/lib/api';
import { fetchCurrentUser } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EyeIcon, TrashIcon, PlusIcon } from '@/components/ui/icons';
import { MediaPicker } from '@/features/media/MediaPicker';
import { getPostFormSchema, PostFormValues } from './postSchema';
import {
  useAffiliateNetworks,
  useBreeds,
  useBlogTags,
  useCreateCategory,
  useCreateTag,
  useDeletePost,
  useSolutions,
  useUsers,
} from './postsApi';
import { ComparisonDetailsSection } from './ComparisonDetailsSection';
import { SeoSettingsSection } from './SeoSettingsSection';
import { TipTapToolbar } from './TipTapToolbar';

interface BlogCategory {
  id: number;
  name: string;
}

interface ComparisonItemApiItem {
  product_name: string;
  image_url: string | null;
  retailer: string | null;
  retailer_label: string | null;
  retailer_logo: string | null;
  highlight: string | null;
  in_stock: boolean;
  price_display: string | null;
  price_cents: number | null;
  rating: number | null;
  affiliate_url: string;
  redirect_url: string;
  pros: string[];
  cons: string[];
  in_house_match_url: string | null;
}

interface PostDetail {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published';
  blog_category: { id: string; name: string } | null;
  featured_image: string | null;
  featured_media_id: string | null;
  featured_image_alt: string | null;
  author: string | null;
  type: 'article' | 'guide' | 'comparison';
  published_at: string | null;
  breeds: { id: string; name: string }[];
  solutions: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  seo: {
    title: string | null;
    keyphrase: string | null;
    description: string | null;
    og_title: string | null;
    og_description: string | null;
    og_image: string | null;
  } | null;
  comparison: {
    intro: string | null;
    disclosure_shown: boolean;
    items: ComparisonItemApiItem[];
  } | null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function PostFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: async () => {
      const res = await fetchJson<BlogCategory[]>('/admin/blog/categories');
      return Array.isArray(res) ? res : [];
    },
  });

  const { data: mediaLibrary } = useQuery({
    queryKey: ['media'],
    queryFn: async () => {
      const res = await fetchJson<{ data: any[] }>('/admin/media');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: existingPost } = useQuery({
    queryKey: ['posts', id],
    queryFn: () => fetchJson<{ data: PostDetail }>(`/admin/posts/${id}`).then((res) => res.data),
    enabled: isEdit,
  });

  const { data: affiliateNetworksData } = useAffiliateNetworks();
  const affiliateNetworks = affiliateNetworksData ?? [];

  const { data: breedsData } = useBreeds();
  const breeds = breedsData ?? [];

  const { data: solutionsData } = useSolutions();
  const solutions = solutionsData ?? [];

  const { data: tagsData } = useBlogTags();
  const tags = tagsData ?? [];

  const { data: usersData } = useUsers();
  const users = usersData ?? [];

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(getPostFormSchema(t)),
    defaultValues: {
      title: '',
      slug: '',
      content: '',
      blog_category_id: '',
      status: 'draft',
      featured_media_id: null,
      featured_image_alt: '',
      author: '',
      type: 'article',
      published_at: '',
      breeds: [],
      solutions: [],
      tags: [],
      seo: {
        title: '',
        keyphrase: '',
        description: '',
        og_title: '',
        og_description: '',
        og_image: null,
      },
      comparison_intro: '',
      disclosure_shown: true,
      comparison_items: [],
    },
  });

  const selectedType = useWatch({ control, name: 'type' });
  const selectedStatus = useWatch({ control, name: 'status' });

  const [slugTouched, setSlugTouched] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceHtml, setSourceHtml] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Image.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setValue('content', editor.getHTML(), { shouldValidate: true });
    },
  });

  function handleToggleSource() {
    if (sourceMode) return;
    setSourceHtml(editor?.getHTML() ?? '');
    setSourceMode(true);
  }

  function handleApplySource() {
    if (editor) {
      editor.commands.setContent(sourceHtml);
      setValue('content', sourceHtml, { shouldValidate: true });
    }
    setSourceMode(false);
  }

  useEffect(() => {
    if (existingPost && editor) {
      reset({
        title: existingPost.title,
        slug: existingPost.slug,
        content: existingPost.content,
        blog_category_id: existingPost.blog_category?.id ?? '',
        status: existingPost.status,
        featured_media_id: existingPost.featured_media_id,
        featured_image_alt: existingPost.featured_image_alt ?? '',
        author: existingPost.author ?? '',
        type: existingPost.type ?? 'article',
        published_at: existingPost.published_at ? existingPost.published_at.slice(0, 16) : '',
        breeds: existingPost.breeds?.map((b) => b.id) ?? [],
        solutions: existingPost.solutions?.map((s) => s.id) ?? [],
        tags: existingPost.tags?.map((t) => t.id) ?? [],
        seo: {
          title: existingPost.seo?.title ?? '',
          keyphrase: existingPost.seo?.keyphrase ?? '',
          description: existingPost.seo?.description ?? '',
          og_title: existingPost.seo?.og_title ?? '',
          og_description: existingPost.seo?.og_description ?? '',
          og_image: existingPost.seo?.og_image ?? null,
        },
        comparison_intro: existingPost.comparison?.intro ?? '',
        disclosure_shown: existingPost.comparison?.disclosure_shown ?? true,
        comparison_items: (existingPost.comparison?.items ?? []).map((item) => ({
          product_name: item.product_name,
          image_url: item.image_url,
          retailer: item.retailer ?? '',
          // Legacy free-text values outside the enum are dropped (select shows
          // "None") rather than being sent back and failing validation.
          highlight: item.highlight && ['best_overall', 'best_value', 'budget_pick'].includes(item.highlight)
            ? (item.highlight as 'best_overall' | 'best_value' | 'budget_pick')
            : undefined,
          in_stock: item.in_stock,
          price_display: (item.price_display ?? '').replace(/[^0-9.]/g, ''),
          price_cents: item.price_cents ?? undefined,
          rating: item.rating ?? undefined,
          affiliate_url: item.affiliate_url,
          pros: item.pros ?? [],
          cons: item.cons ?? [],
          in_house_match_url: item.in_house_match_url ?? '',
        })),
      });
      editor.commands.setContent(existingPost.content);
    }
  }, [existingPost, editor, reset]);

  // Default the author to the logged-in user on create (legacy Filament
  // behavior: author is a Select of user names defaulting to the current user).
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    fetchCurrentUser()
      .then((user) => {
        if (!cancelled && !getValues('author')) {
          setValue('author', user.name, { shouldDirty: false, shouldValidate: false });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEdit, getValues, setValue]);

  const mutation = useMutation({
    mutationFn: (values: PostFormValues) => {
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/admin/posts/${id}` : '/admin/posts';
      return fetchJson(url, { method, body: values });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate('/posts');
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => fetchJson<{ url: string }>(`/admin/posts/${id}/preview-url`),
  });

  const deletePost = useDeletePost();
  const createCategory = useCreateCategory();
  const createTag = useCreateTag();

  function handlePreview() {
    // Popup blockers kill window.open calls made after an await, so instead
    // fetch the signed URL and then click a real anchor (target=_blank) — a
    // navigation, not a popup, so it is not blocked.
    previewMutation.mutate(undefined, {
      onSuccess: (data) => {
        const anchor = document.createElement('a');
        anchor.href = data.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      },
    });
  }

  function handleDeletePost() {
    if (!id) return;
    if (window.confirm(t('posts.confirm_delete', { title: existingPost?.title ?? '' }))) {
      deletePost.mutate(id, { onSuccess: () => navigate('/posts') });
    }
  }

  function handleTitleBlur() {
    if (isEdit || slugTouched) return;
    const title = getValues('title');
    if (title?.trim()) {
      setValue('slug', slugify(title), { shouldValidate: true });
    }
  }

  function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name || createCategory.isPending) return;
    createCategory.mutate(name, {
      onSuccess: (category) => {
        // The API returns numeric ids; the Zod schema expects a string.
        setValue('blog_category_id', String(category.id), { shouldValidate: true });
        setNewCategoryName('');
        setShowCreateCategory(false);
      },
    });
  }

  function handleCreateTag() {
    const name = newTagName.trim();
    if (!name || createTag.isPending) return;
    createTag.mutate(name, {
      onSuccess: (tag) => {
        const current = getValues('tags') ?? [];
        setValue('tags', [...current, String(tag.id)], { shouldValidate: true });
        setNewTagName('');
        setShowCreateTag(false);
      },
    });
  }

  const authorNames = users.map((u) => u.name);
  const currentAuthor = existingPost?.author ?? '';
  const authorOptions = currentAuthor && !authorNames.includes(currentAuthor) ? [...authorNames, currentAuthor] : authorNames;

  function onSubmit(values: PostFormValues) {
    mutation.mutate({
      ...values,
      content: editor?.getHTML() ?? values.content,
      // datetime-local sends an empty string when untouched; the backend's
      // `nullable|date` rule rejects "" — send null instead.
      published_at: values.published_at || null,
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-ink">{isEdit ? t('posts.form_title_edit') : t('posts.form_title_new')}</h1>
        <div className="flex items-center gap-2">
          {isEdit && (
            <Button
              type="button"
              variant="primary"
              disabled={previewMutation.isPending}
              onClick={handlePreview}
            >
              <EyeIcon className="h-4 w-4" />
              {previewMutation.isPending ? t('posts.form_button_preview_loading') : t('posts.form_button_preview')}
            </Button>
          )}
          {isEdit && (
            <Button type="button" variant="primary" onClick={handleDeletePost}>
              <TrashIcon className="h-4 w-4" />
              {t('posts.action_delete')}
            </Button>
          )}
          <Button type="submit" variant="secondary" disabled={isSubmitting}>
            {isSubmitting
              ? t('posts.form_button_saving')
              : selectedStatus === 'published'
                ? t('posts.form_button_update_publish')
                : t('posts.form_button_save_draft')}
          </Button>
        </div>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-600 mb-4">{(mutation.error as Error).message}</p>
      )}
      {previewMutation.isError && (
        <p className="text-xs text-red-600 mb-4">{t('posts.preview_error')}</p>
      )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-2/3 space-y-6">
          <Card className="space-y-4 p-5">
            <h3 className="text-lg font-semibold text-slate-800">{t('posts.section_content')}</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_title')}</label>
              <Input {...register('title')} onBlur={handleTitleBlur} />
              {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_slug')}</label>
              <Input
                {...register('slug')}
                onFocus={() => setSlugTouched(true)}
                placeholder="my-post-slug"
              />
              {errors.slug && <p className="text-xs text-red-600 mt-1">{errors.slug.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_content')}</label>
              {sourceMode ? (
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
                    <span className="text-xs font-semibold text-gray-500">{t('posts.source_title')}</span>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" onClick={handleApplySource}>
                        {t('posts.source_apply')}
                      </Button>
                      <Button type="button" variant="primary" onClick={() => setSourceMode(false)}>
                        {t('posts.source_cancel')}
                      </Button>
                    </div>
                  </div>
                  <textarea
                    value={sourceHtml}
                    onChange={(e) => setSourceHtml(e.target.value)}
                    className="h-64 w-full p-3 font-mono text-xs text-ink"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  {editor && <TipTapToolbar editor={editor} onToggleSource={handleToggleSource} />}
                  <div className="p-3 min-h-[220px]">
                    <EditorContent editor={editor} />
                  </div>
                </div>
              )}
              {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content.message}</p>}
            </div>
          </Card>

          {selectedType === 'comparison' && (
            <ComparisonDetailsSection control={control} register={register} affiliateNetworks={affiliateNetworks} />
          )}

          <SeoSettingsSection control={control} register={register} setValue={setValue} getValues={getValues} />
        </div>

        <div className="w-full lg:w-1/3 space-y-6">
          <Card className="space-y-4 p-5">
            <h3 className="text-lg font-semibold text-slate-800">{t('posts.section_settings')}</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_category')}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    {...register('blog_category_id')}
                    className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer shadow-sm"
                  >
                    <option value="">{t('posts.form_label_category_placeholder')}</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </div>
                </div>
                <button
                  type="button"
                  title={t('posts.create_category')}
                  onClick={() => setShowCreateCategory((v) => !v)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-2.5 text-gray-500 hover:bg-gray-50 hover:text-primary"
                >
                  <PlusIcon />
                </button>
              </div>
              {showCreateCategory && (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder={t('posts.create_category_name')}
                  />
                  <Button type="button" variant="secondary" disabled={createCategory.isPending} onClick={handleCreateCategory}>
                    {createCategory.isPending ? t('posts.form_button_saving') : t('posts.create_category_add')}
                  </Button>
                </div>
              )}
              {createCategory.isError && <p className="text-xs text-red-600 mt-1">{t('posts.create_category_error')}</p>}
              {errors.blog_category_id && <p className="text-xs text-red-600 mt-1">{errors.blog_category_id.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_type')}</label>
              <div className="relative">
                <select {...register('type')} className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer shadow-sm">
                  <option value="article">{t('posts.type.article')}</option>
                  <option value="guide">{t('posts.type.guide')}</option>
                  <option value="comparison">{t('posts.type.comparison')}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_author')}</label>
              <div className="relative">
                <select {...register('author')} className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer shadow-sm">
                  {authorOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_breeds')}</label>
              <Controller
                name="breeds"
                control={control}
                render={({ field }) => (
                  <select
                    multiple
                    value={field.value}
                    onChange={(e) => field.onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
                    size={Math.min(breeds.length + 1, 6)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    {breeds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_solutions')}</label>
              <Controller
                name="solutions"
                control={control}
                render={({ field }) => (
                  <select
                    multiple
                    value={field.value}
                    onChange={(e) => field.onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
                    size={Math.min(solutions.length + 1, 6)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                  >
                    {solutions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_tags')}</label>
              <div className="flex gap-2">
                <Controller
                  name="tags"
                  control={control}
                  render={({ field }) => (
                    <select
                      multiple
                      value={field.value}
                      onChange={(e) => field.onChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
                      size={Math.min(tags.length + 1, 6)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                    >
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <button
                  type="button"
                  title={t('posts.create_tag')}
                  onClick={() => setShowCreateTag((v) => !v)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-2.5 text-gray-500 hover:bg-gray-50 hover:text-primary"
                >
                  <PlusIcon />
                </button>
              </div>
              {showCreateTag && (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder={t('posts.create_tag_name')}
                  />
                  <Button type="button" variant="secondary" disabled={createTag.isPending} onClick={handleCreateTag}>
                    {createTag.isPending ? t('posts.form_button_saving') : t('posts.create_category_add')}
                  </Button>
                </div>
              )}
              {createTag.isError && <p className="text-xs text-red-600 mt-1">{t('posts.create_tag_error')}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('posts.form_label_featured_image')}</label>
              <Controller
                name="featured_media_id"
                control={control}
                render={({ field }) => {
                  const mediaUrl = field.value && mediaLibrary
                    ? mediaLibrary.find(m => m.id === field.value)?.url ?? existingPost?.featured_image
                    : existingPost?.featured_image;

                  return (
                    <MediaPicker
                      value={field.value ? { id: field.value, url: mediaUrl ?? '' } : null}
                      onChange={(media) => field.onChange(media?.id ?? null)}
                    />
                  );
                }}
              />
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_featured_image_alt')}</label>
                <Input {...register('featured_image_alt')} maxLength={255} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_status')}</label>
              <div className="relative">
                <select {...register('status')} className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer shadow-sm">
                  <option value="draft">{t('posts.status_draft')}</option>
                  <option value="published">{t('posts.status_published')}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('posts.form_label_published_at')}</label>
              <input
                type="datetime-local"
                {...register('published_at')}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
