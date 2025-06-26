import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for cached user in localStorage first
    const cachedUser = localStorage.getItem('faculty_user');
    if (cachedUser) {
      try {
        const parsedUser = JSON.parse(cachedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing cached user:', error);
        localStorage.removeItem('faculty_user');
      }
    }

    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setUser(null);
          setLoading(false);
          return;
        }
        
        if (sessionData?.session?.user?.id) {
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
            // Cache user in localStorage
            localStorage.setItem('faculty_user', JSON.stringify(data));
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
        console.log('Auth state changed:', event);
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
            // Cache user in localStorage
            localStorage.setItem('faculty_user', JSON.stringify(data));
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          localStorage.removeItem('faculty_user');
        }
      }
    );

    checkSession();

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    if (!username || !password) {
      return { data: null, error: { message: 'Username and password are required' } };
    }

    try {
      setLoading(true);
      
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
        console.error('User lookup error:', userError);
        return { data: null, error: { message: 'Invalid username or password' } };
      }

      if (!userData || !userData.email) {
        return { data: null, error: { message: 'User not found' } };
      }

      // Use email from user record to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password,
      });

      if (error) {
        console.error('Supabase auth error:', error);
        return { data: null, error: { message: 'Invalid username or password' } };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error: { message: 'An error occurred during sign in' } };
    } finally {
      setLoading(false);
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
    if (!username || !password) {
      return { data: null, error: { message: 'Username and password are required' } };
    }

    try {
      setLoading(true);
      
      // Check if username already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();
        
      if (existingUser) {
        return { data: null, error: { message: 'Username already exists' } };
      }
      
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
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          username,
          email,
          full_name: userData.full_name,
          identity_number: userData.identity_number,
          phone_number: userData.phone_number,
          role: 'student', // Default role
          password: password // This will be encrypted by the database trigger
        })
        .select()
        .single();

      if (profileError) {
        // If profile creation fails, we should try to clean up the auth user
        try {
          await supabase.auth.admin.deleteUser(data.user.id);
        } catch (cleanupError) {
          console.error('Failed to clean up auth user after profile creation error:', cleanupError);
        }
        return { data: null, error: profileError };
      }

      return { data: { user: profileData }, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error: { message: 'An error occurred during sign up' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('faculty_user');
      
      // Clear the user context in the database (if this function exists)
      try {
        await supabase.rpc('set_current_user', { user_id: null });
      } catch (error) {
        console.error('Error clearing user context:', error);
      }
      
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error: { message: 'An error occurred during sign out' } };
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
}