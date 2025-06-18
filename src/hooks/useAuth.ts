import { useState, useEffect } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('faculty_user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setProfile(userData);
        setUser({ id: userData.id, email: userData.email } as SupabaseUser);
        // Set the user context in the database
        supabase.rpc('set_current_user', { user_id: userData.id });
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('faculty_user');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      setLoading(true);
      
      // Use our custom authentication function
      const { data, error } = await supabase.rpc('authenticate_user', {
        input_username: username,
        input_password: password
      });

      if (error) {
        console.error('Authentication error:', error);
        return { error: { message: 'Authentication failed' } };
      }

      if (!data || data.length === 0 || !data[0].success) {
        return { error: { message: data?.[0]?.message || 'Invalid username or password' } };
      }

      const userData = data[0];
      const userProfile: User = {
        id: userData.user_id,
        email: userData.email,
        full_name: userData.full_name,
        identity_number: userData.identity_number,
        role: userData.role as 'student' | 'department_admin' | 'super_admin',
        department_id: userData.department_id,
        phone_number: userData.phone_number,
        username: username, // We know the username from input
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Save user data
      setProfile(userProfile);
      setUser({ id: userData.user_id, email: userData.email } as SupabaseUser);
      
      // Save to localStorage for persistence
      localStorage.setItem('faculty_user', JSON.stringify(userProfile));

      return { data: { user: userProfile }, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: { message: 'An error occurred during sign in' } };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (username: string, password: string, userData: {
    full_name: string;
    identity_number: string;
    phone_number?: string;
    department_id?: string;
  }) => {
    try {
      setLoading(true);

      // Check if username already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (existingUser) {
        return { error: { message: 'Username already exists' } };
      }

      // Check if identity number already exists
      const { data: existingIdentity } = await supabase
        .from('users')
        .select('identity_number')
        .eq('identity_number', userData.identity_number)
        .maybeSingle();

      if (existingIdentity) {
        return { error: { message: 'Identity number already exists' } };
      }

      // Create new user with encrypted password
      const newUserId = crypto.randomUUID();
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: newUserId,
          username: username,
          email: `${username}@faculty.edu`, // Generate email from username
          full_name: userData.full_name,
          identity_number: userData.identity_number,
          phone_number: userData.phone_number || null,
          department_id: userData.department_id || null,
          role: 'student',
          password: password // This will be encrypted by the database trigger
        })
        .select()
        .single();

      if (error) {
        console.error('Sign up error:', error);
        return { error: { message: error.message } };
      }

      return { data: { user: data }, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error: { message: 'An error occurred during sign up' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem('faculty_user');
    
    // Clear the user context in the database
    try {
      await supabase.rpc('set_current_user', { user_id: null });
    } catch (error) {
      console.error('Error clearing user context:', error);
    }
    
    return { error: null };
  };

  return {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  };
}