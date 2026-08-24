import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
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
import toast from 'react-hot-toast';
import { prettifyHtml } from '@/lib/htmlFormat';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrashIcon } from '@/components/ui/icons';
import { TipTapToolbar } from '@/features/posts/TipTapToolbar';
import { getPageFormSchema, PageFormValues } from './pageSchema';
import { usePage, useCreatePage, useUpdatePage, useDeletePage } from './api';
import { useQueryClient } from '@tanstack/react-query';

const LinkWithStyle = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('class'),
      },
      style: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('style'),
      },
    };
  },
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function PageFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: existingPage } = usePage(id || '');
  const createMutation = useCreatePage();
  const updateMutation = useUpdatePage();
  const deleteMutation = useDeletePage();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PageFormValues>({
    resolver: zodResolver(getPageFormSchema(t)),
    defaultValues: {
      title: '',
      slug: '',
      content: '',
      status: 'published',
      meta_title: '',
      meta_description: '',
    },
  });


  const [slugTouched, setSlugTouched] = useState(false);
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
      LinkWithStyle.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
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
    setSourceHtml(prettifyHtml(editor?.getHTML() ?? ''));
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
    if (existingPage && editor) {
      reset({
        title: existingPage.title,
        slug: existingPage.slug,
        content: existingPage.content,
        status: existingPage.status,
        meta_title: existingPage.meta_title ?? '',
        meta_description: existingPage.meta_description ?? '',
      });
      editor.commands.setContent(existingPage.content);
    }
  }, [existingPage, editor, reset]);

  function handleDeletePage() {
    if (!id || !existingPage) return;
    if (existingPage.is_core) {
      toast.error(t('pages.core_warning', { defaultValue: 'This is a required legal page and cannot be deleted.' }));
      return;
    }
    if (window.confirm(t('pages.confirm_delete', { title: existingPage.title }))) {
      deleteMutation.mutate(parseInt(id), { 
        onSuccess: () => {
          toast.success(t('pages.delete_success', { defaultValue: 'Page deleted successfully' }));
          queryClient.invalidateQueries({ queryKey: ['pages'] });
          navigate('/legal-policies');
        },
        onError: (err: any) => {
          toast.error(err.message || t('common.error_occurred'));
        }
      });
    }
  }

  function handleTitleBlur() {
    if (isEdit || slugTouched) return;
    const title = getValues('title');
    if (title?.trim() && !existingPage?.is_core) {
      setValue('slug', slugify(title), { shouldValidate: true });
    }
  }

  function onSubmit(values: PageFormValues) {
    const finalValues = {
      ...values,
      content: editor?.getHTML() ?? values.content,
    };

    const action = isEdit 
      ? updateMutation.mutateAsync({ id: parseInt(id!), ...finalValues })
      : createMutation.mutateAsync(finalValues);

    action.then(() => {
      toast.success(isEdit ? t('pages.update_success', { defaultValue: 'Page updated successfully' }) : t('pages.create_success', { defaultValue: 'Page created successfully' }));
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      navigate('/legal-policies');
    }).catch((err: any) => {
      toast.error(err.message || t('common.error_occurred'));
    });
  }

  const isCore = existingPage?.is_core;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-ink">{isEdit ? t('pages.form_title_edit') : t('pages.form_title_new')}</h1>
          <div className="flex items-center gap-2">
            {isEdit && !isCore && (
              <Button type="button" variant="danger" onClick={handleDeletePage}>
                <TrashIcon className="h-4 w-4" />
                {t('pages.action_delete')}
              </Button>
            )}
            <Button type="submit" variant="secondary" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {(isSubmitting || createMutation.isPending || updateMutation.isPending)
                ? t('pages.form_button_saving')
                : t('pages.form_button_save')}
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-2/3 space-y-6">
            <Card className="space-y-4 p-5">
              <h3 className="text-lg font-semibold text-slate-800">{t('pages.section_content')}</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('pages.form_label_title')}</label>
                <Input {...register('title')} onBlur={handleTitleBlur} />
                {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('pages.form_label_slug')}</label>
                <Input
                  {...register('slug')}
                  onFocus={() => setSlugTouched(true)}
                  disabled={isCore}
                  placeholder="my-page-slug"
                />
                {isCore && <p className="text-xs text-blue-600 mt-1">{t('pages.core_warning')}</p>}
                {!isCore && <p className="text-xs text-slate-500 mt-1">{t('pages.slug_warning')}</p>}
                {errors.slug && <p className="text-xs text-red-600 mt-1">{errors.slug.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('pages.form_label_content')}</label>
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
                    {editor && <TipTapToolbar editor={editor} onToggleSource={handleToggleSource} mediaContext="blog" />}
                    <div className="p-3 min-h-[220px]">
                      <EditorContent editor={editor} />
                    </div>
                  </div>
                )}
                {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content.message}</p>}
              </div>
            </Card>
          </div>

          <div className="w-full lg:w-1/3 space-y-6">
            <Card className="space-y-4 p-5">
              <h3 className="text-lg font-semibold text-slate-800">{t('pages.section_seo')}</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('pages.form_label_meta_title')}</label>
                <Input {...register('meta_title')} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('pages.form_label_meta_description')}</label>
                <textarea
                  {...register('meta_description')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm h-24"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('pages.form_label_status', 'Status')}</label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary focus:ring-primary"
                >
                  <option value="draft">{t('pages.status_draft', 'Draft')}</option>
                  <option value="invisible">{t('pages.status_invisible', 'Invisible')}</option>
                  <option value="published">{t('pages.status_published', 'Published')}</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {t('pages.form_label_status_hint', 'Draft is hidden. Invisible is accessible via direct link only. Published is fully public.')}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
