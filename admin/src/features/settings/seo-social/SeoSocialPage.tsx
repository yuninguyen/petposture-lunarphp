import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSeoSocialSettings, useUpdateSeoSocialSettings, SeoSocialSettings } from './api';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Save, Loader2, MapPin, Phone } from 'lucide-react';

// Custom wrapper cho Input có Icon
function IconInput({ icon: Icon, id, label, placeholder, register, ...props }: any) {
  return (
    <div className="space-y-1.5 group">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 block transition-colors group-focus-within:text-primary">
        {label}
      </label>
      <div className="relative flex items-center">
        <div className="absolute left-3 text-slate-400 group-focus-within:text-primary transition-colors">
          <Icon size={18} />
        </div>
        <Input
          id={id}
          placeholder={placeholder}
          className="pl-10 h-10 w-full transition-all focus:ring-2 focus:ring-primary/20 bg-slate-50 focus:bg-white"
          {...register(id)}
          {...props}
        />
      </div>
    </div>
  );
}

// Custom TikTok/Pinterest icon vi lucide-react chua the co du het cac icon mang xa hoi
function SvgIcon({ path, path2 }: { path: string; path2?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
      <path d={path} />
      {path2 && <path d={path2} />}
    </svg>
  );
}

export function SeoSocialPage() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useSeoSocialSettings();
  const { mutate: updateSettings, isPending } = useUpdateSeoSocialSettings();

  const { register, handleSubmit, reset } = useForm<SeoSocialSettings>({
    defaultValues: {
      social_facebook: '',
      social_instagram: '',
      social_twitter: '',
      social_tiktok: '',
      social_pinterest: '',
      social_youtube: '',
      business_phone: '',
      business_address: '',
    },
  });

  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  const onSubmit = (data: SeoSocialSettings) => {
    updateSettings(data, {
      onSuccess: () => toast.success(t('seo_social.save_success')),
      onError: (error) => toast.error(error.message || t('common.error_occurred')),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="min-h-full pb-20 relative">
      {/* Sticky Header with Save Action */}
      <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/60 pb-4 mb-8 pt-4 px-1 -mx-4 sm:-mx-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{t('seo_social.title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('seo_social.description')}</p>
          </div>
          <Button 
            type="submit" 
            disabled={isPending}
            className="shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-95"
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {t('common.save')}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Social Profiles Card */}
        <Card className="p-0 overflow-hidden border-slate-200/60 shadow-sm transition-all hover:shadow-md">
          <div className="bg-slate-100/50 px-6 py-4 border-b border-slate-200/60">
            <h3 className="text-lg font-semibold text-slate-800">{t('seo_social.social_profiles')}</h3>
            <p className="text-sm text-slate-500">{t('seo_social.social_profiles_desc')}</p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
            <IconInput 
              id="social_facebook" 
              label={t('seo_social.facebook')} 
              icon={() => <SvgIcon path="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />}
              placeholder="https://facebook.com/..." 
              register={register} 
              type="url" 
            />
            <IconInput 
              id="social_instagram" 
              label={t('seo_social.instagram')} 
              icon={() => <SvgIcon path="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" path2="M2 6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" />}
              placeholder="https://instagram.com/..." 
              register={register} 
              type="url" 
            />
            <IconInput 
              id="social_twitter" 
              label={t('seo_social.twitter')} 
              icon={() => <SvgIcon path="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />}
              placeholder="https://twitter.com/..." 
              register={register} 
              type="url" 
            />
            <IconInput 
              id="social_youtube" 
              label={t('seo_social.youtube')} 
              icon={() => <SvgIcon path="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" path2="M9.75 15.02l5.75-3.27-5.75-3.27v6.54z" />}
              placeholder="https://youtube.com/..." 
              register={register} 
              type="url" 
            />
            
            {/* Custom SVG for TikTok */}
            <IconInput 
              id="social_tiktok" 
              label={t('seo_social.tiktok')} 
              icon={() => <SvgIcon path="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />}
              placeholder="https://tiktok.com/@..." 
              register={register} 
              type="url" 
            />
            {/* Custom SVG for Pinterest */}
            <IconInput 
              id="social_pinterest" 
              label={t('seo_social.pinterest')} 
              icon={() => <SvgIcon path="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM11 16c-.5-1-1-3-1-4a4 4 0 0 1 4-4 4 4 0 0 1 4 4c0 3-2 5-4 5a3 3 0 0 1-2-1c0 1-.5 3-1 4a10 10 0 0 1-2 2 10 10 0 0 0 2-6z" />}
              placeholder="https://pinterest.com/..." 
              register={register} 
              type="url" 
            />
          </div>
        </Card>

        {/* Business Info Card */}
        <Card className="p-0 overflow-hidden border-slate-200/60 shadow-sm transition-all hover:shadow-md">
          <div className="bg-slate-100/50 px-6 py-4 border-b border-slate-200/60">
            <h3 className="text-lg font-semibold text-slate-800">{t('seo_social.business_info')}</h3>
            <p className="text-sm text-slate-500">{t('seo_social.business_info_desc')}</p>
          </div>
          <div className="p-6 space-y-6 bg-white">
            <IconInput 
              id="business_phone" 
              label={t('seo_social.business_phone')} 
              icon={Phone} 
              placeholder="+1 (555) 000-0000" 
              register={register} 
              type="tel" 
            />
            <div>
              <IconInput 
                id="business_address" 
                label={t('seo_social.business_address')} 
                icon={MapPin} 
                placeholder="123 Main St, Springfield, IL 62701" 
                register={register} 
                type="text" 
              />
              <p className="text-xs text-slate-500 mt-2 ml-1">
                {t('seo_social.business_address_helper')}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </form>
  );
}
