import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { fetchJson } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MediaPicker } from '@/features/media/MediaPicker';
import { getPostFormSchema, PostFormValues } from './postSchema';

interface BlogCategory {
  id: number;
  name: string;
}

interface PostDetail {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  blog_category: { id: string; name: string } | null;
  featured_image: string | null;
  featured_media_id: string | null;
  author: string | null;
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

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(getPostFormSchema(t)),
    defaultValues: { title: '', content: '', blog_category_id: '', status: 'draft', featured_media_id: null, author: '' },
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate: ({ editor }) => {
      setValue('content', editor.getHTML(), { shouldValidate: true });
    },
  });

  useEffect(() => {
    if (existingPost && editor) {
      reset({
        title: existingPost.title,
        content: existingPost.content,
        blog_category_id: existingPost.blog_category?.id ?? '',
        status: existingPost.status,
        featured_media_id: existingPost.featured_media_id,
        author: existingPost.author ?? '',
      });
      editor.commands.setContent(existingPost.content);
    }
  }, [existingPost, editor, reset]);

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

  function onSubmit(values: PostFormValues) {
    mutation.mutate({ ...values, content: editor?.getHTML() ?? values.content });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">{isEdit ? t('posts.form_title_edit') : t('posts.form_title_new')}</h1>
        <Button type="submit" variant="secondary" disabled={isSubmitting}>
          {isSubmitting ? t('posts.form_button_saving') : t('posts.form_button_save')}
        </Button>
      </div>

      <div className="flex gap-5">
        <div className="flex-[2]">
          <Card>
            <h2 className="text-sm font-bold text-ink mb-3">{t('posts.section_content')}</h2>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_title')}</label>
              <Input {...register('title')} />
              {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_content')}</label>
              <div className="border border-gray-300 rounded-lg p-3 min-h-[200px]">
                <EditorContent editor={editor} />
              </div>
              {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content.message}</p>}
            </div>
          </Card>
        </div>

        <div className="flex-1">
          <Card>
            <h2 className="text-sm font-bold text-ink mb-3">{t('posts.section_settings')}</h2>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_category')}</label>
              <select {...register('blog_category_id')} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
                <option value="">{t('posts.form_label_category_placeholder')}</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.blog_category_id && <p className="text-xs text-red-600 mt-1">{errors.blog_category_id.message}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_status')}</label>
              <select {...register('status')} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
                <option value="draft">{t('posts.status_draft')}</option>
                <option value="published">{t('posts.status_published')}</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_author')}</label>
              <Input {...register('author')} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary-light mb-2">{t('posts.form_label_featured_image')}</label>
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
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
