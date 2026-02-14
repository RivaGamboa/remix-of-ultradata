import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BlingStatus {
  connected: boolean;
  expired?: boolean;
  expires_at?: string;
  scope?: string;
}

export function useBlingAuth() {
  const { user, session } = useAuth();
  const [status, setStatus] = useState<BlingStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  const callBlingOAuth = useCallback(
    async (action: string, options?: { method?: string; body?: Record<string, string>; params?: Record<string, string> }) => {
      const params = new URLSearchParams({ action, ...options?.params });
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bling-oauth?${params}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch(url, {
        method: options?.method || 'GET',
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    },
    [session]
  );

  const checkStatus = useCallback(async () => {
    if (!user) {
      setStatus({ connected: false });
      setLoading(false);
      return;
    }
    try {
      const data = await callBlingOAuth('status');
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [user, callBlingOAuth]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const startAuth = useCallback(async () => {
    const redirectUri = `${window.location.origin}/bling/callback`;
    const state = crypto.randomUUID();
    sessionStorage.setItem('bling_oauth_state', state);

    const data = await callBlingOAuth('authorize', {
      params: { redirect_uri: redirectUri, state },
    });

    window.location.href = data.url;
  }, [callBlingOAuth]);

  const handleCallback = useCallback(
    async (code: string, state: string) => {
      const savedState = sessionStorage.getItem('bling_oauth_state');
      if (state !== savedState) throw new Error('State mismatch');
      sessionStorage.removeItem('bling_oauth_state');

      const redirectUri = `${window.location.origin}/bling/callback`;
      await callBlingOAuth('callback', {
        method: 'POST',
        body: { code, redirect_uri: redirectUri },
      });

      await checkStatus();
    },
    [callBlingOAuth, checkStatus]
  );

  const refreshToken = useCallback(async () => {
    await callBlingOAuth('refresh');
    await checkStatus();
  }, [callBlingOAuth, checkStatus]);

  const disconnect = useCallback(async () => {
    await callBlingOAuth('disconnect');
    setStatus({ connected: false });
  }, [callBlingOAuth]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    const data = await callBlingOAuth('get-token');
    return data.access_token;
  }, [callBlingOAuth]);

  return {
    status,
    loading,
    startAuth,
    handleCallback,
    refreshToken,
    disconnect,
    getAccessToken,
    checkStatus,
  };
}
