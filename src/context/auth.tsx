import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database.types';
import { WidgetService } from '@/services/widget';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ error: Error | null; user: User | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  signInWithPassword: async () => ({ error: null }),
  signUpWithPassword: async () => ({ error: null, user: null }),
  signOut: async () => {},
  updateProfile: async () => ({ error: null }),
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isEnsuringProfileRef = useRef(false);

  // Helper to ensure profile exists and has local timezone (runs asynchronously in background)
  const ensureProfile = async (currentUser: User, displayName?: string) => {
    if (isEnsuringProfileRef.current) return;
    isEnsuringProfileRef.current = true;

    try {
      let deviceTimezone = 'America/New_York';
      try {
        deviceTimezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
      } catch {
        // Fallback for environments where Intl is limited
      }

      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.warn('Error fetching profile:', fetchError.message);
      }

      if (existingProfile) {
        setProfile(existingProfile as Profile);
      } else {
        // Create initial profile
        const newProfile: Partial<Profile> = {
          id: currentUser.id,
          display_name: displayName || currentUser.email?.split('@')[0] || 'Wishlist Owner',
          timezone: deviceTimezone,
        };

        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (insertError) {
          console.warn('Error inserting initial profile:', insertError.message);
        } else if (created) {
          setProfile(created as Profile);
        }
      }
    } catch (e) {
      console.warn('Failed in ensureProfile:', e);
    } finally {
      isEnsuringProfileRef.current = false;
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Failed to fetch profile:', error.message);
      } else if (data) {
        setProfile(data as Profile);
      }
    } catch (e) {
      console.warn('Error fetching profile:', e);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Failsafe timeout: Never let the app hang on the loading spinner for more than 2 seconds
    const safetyTimer = setTimeout(() => {
      if (isMounted && isLoading) {
        console.warn('Auth loading timed out after 2000ms. Forcing isLoading = false.');
        setIsLoading(false);
      }
    }, 2000);

    // Initial session check
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!isMounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);

        if (currentSession?.user) {
          ensureProfile(currentSession.user);
        }
      })
      .catch((err) => {
        console.warn('Get session error:', err);
        if (isMounted) setIsLoading(false);
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setIsLoading(false);

      if (newSession?.user) {
        ensureProfile(newSession.user);
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    return { error: error ? new Error(error.message) : null };
  };

  const signUpWithPassword = async (
    email: string,
    password: string,
    displayName?: string
  ) => {
    setIsLoading(true);
    let deviceTimezone = 'America/New_York';
    try {
      deviceTimezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch {
      // ignore
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
          timezone: deviceTimezone,
        },
      },
    });

    if (!error && data.user) {
      await ensureProfile(data.user, displayName);
    }

    setIsLoading(false);
    return {
      error: error ? new Error(error.message) : null,
      user: data.user,
    };
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    await WidgetService.clearWidgetSnapshot();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsLoading(false);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return { error: new Error(error.message) };
    }

    if (data) {
      setProfile(data as Profile);
    }
    return { error: null };
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        signInWithPassword,
        signUpWithPassword,
        signOut,
        updateProfile,
        refreshProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
