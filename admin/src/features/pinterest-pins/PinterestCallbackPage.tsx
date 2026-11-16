import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { completePinterestCallback, pinterestConnectionKey } from './api';

/**
 * Where Pinterest sends the owner back to after the connection page. The code in the address is good for one use,
 * so it is handed to the server once (the ref keeps React's double effect run in development from using it twice).
 */
export function PinterestCallbackPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = params.get('code');
    const state = params.get('state');

    function leave() {
      queryClient.invalidateQueries({ queryKey: pinterestConnectionKey });
      navigate('/pinterest-pins', { replace: true });
    }

    if (params.get('error')) {
      toast.error(t('pinterest_connect.callback_denied'));
      leave();
      return;
    }

    if (!code || !state) {
      toast.error(t('pinterest_connect.callback_missing'));
      leave();
      return;
    }

    completePinterestCallback(code, state)
      .then(({ username }) => toast.success(t('pinterest_connect.callback_done', { username: username ?? '' })))
      .catch((error: Error) => toast.error(error.message || t('pinterest_connect.callback_failed')))
      .finally(leave);
  }, [params, navigate, queryClient, t]);

  return <p className="p-8 text-center text-sm text-slate-500">{t('pinterest_connect.callback_working')}</p>;
}
