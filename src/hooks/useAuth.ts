import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData.session?.user?.id) {
          // Session exists, fetch user profile
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', sessionData.session.user.id)
            .single();

          if (error) {
            console.error('Error fetching user data:', error);
            setUser(null);
          } else {
            setUser(data);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Fetch user profile on sign in
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error) {
            console.error('Error fetching user data:', error);
            setUser(null);
          } else {
            setUser(data);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    checkSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      // First try direct email sign in if username is an email
      if (username.includes('@')) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: username,
          password: password,
        });

        if (!error) {
          return { data, error: null };
        }
      }

      // If the above fails or username is not an email, try to find user by username
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('username', username)
        .single();

      if (userError) {
        return { data: null, error: { message: 'Invalid username or password' } };
      }

      // Use email from user record to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password,
      });

      if (error) {
        return { data: null, error: { message: 'Invalid username or password' } };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error: { message: 'An error occurred during sign in' } };
    }
  };

  const signUp = async (
    username: string, 
    password: string, 
    userData: {
      full_name: string;
      identity_number: string;
      phone_number: string;
    }
  ) => {
    try {
      // Generate a default email if needed
      const email = `${username}@faculty.edu`;

      // Create auth user first
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { data: null, error };
      }

      if (!data.user) {
        return { data: null, error: { message: 'User creation failed' } };
      }

      // Create user profile in users table
      const { error: profileError } = await supabase.from('users').insert({
        id: data.user.id,
        username,
        email,
        full_name: userData.full_name,
        identity_number: userData.identity_number,
        phone_number: userData.phone_number,
        role: 'student', // Default role
        password: 'password_hash_placeholder', // This is just a placeholder, actual auth is handled by Supabase Auth
      });

      if (profileError) {
        // If profile creation fails, we should try to clean up the auth user
        await supabase.auth.admin.deleteUser(data.user.id);
        return { data: null, error: profileError };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error: { message: 'An error occurred during sign up' } };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
}