import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  needsNickname: boolean;
  signInWithGoogle: () => Promise<void>;  
  signOut: () => Promise<void>;
  saveNickname: (nickname: string) => Promise<void>;
  skipNickname: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsNickname, setNeedsNickname] = useState(false);

  async function checkProfile(currentSession: Session | null) {
    if (!currentSession) {
      setNeedsNickname(false);
      return;
    }

    const { data, error } = await supabase
      .from('perfiles')
      .select('user_id')
      .eq('user_id', currentSession.user.id)
      .maybeSingle();

    if (error) {
      console.error('Error chequeando perfil:', error.message);
      return;
    }

    setNeedsNickname(!data);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await checkProfile(session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      await checkProfile(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    const redirectTo = AuthSession.makeRedirectUri();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type === 'success') {
      const { url } = result;
      const params = new URLSearchParams(url.split('#')[1]);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function saveNickname(nickname: string) {
    if (!session) return;

    const { error } = await supabase
      .from('perfiles')
      .upsert({ user_id: session.user.id, nickname });

    if (error) throw error;

    setNeedsNickname(false);
  }

  async function skipNickname() {
    if (!session) return;

    const { error } = await supabase
      .from('perfiles')
      .upsert({ user_id: session.user.id, nickname: null });

    if (error) throw error;

    setNeedsNickname(false);
  }

  return (
    <AuthContext.Provider
      value={{ session, loading, needsNickname, signInWithGoogle, signOut, saveNickname, skipNickname }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}