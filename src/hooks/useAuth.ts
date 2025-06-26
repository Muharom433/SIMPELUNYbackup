import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<User | null>(null); // Add profile state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for cached user in localStorage first
        const cachedUser = localStorage.getItem('faculty_user');
        if (cachedUser) {
          try {
            const parsedUser = JSON.parse(cachedUser);
            setUser(parsedUser);
            setProfile(parsedUser); // Set both user and profile
          } catch (error) {
            console.error('Error parsing cached user:', error);
            localStorage.removeItem('faculty_user');
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (username: string, password: string) => {
    if (!username || !password) {
      return { data: null, error: { message: 'Username and password are required' } };
    }

    try {
      setLoading(true);
      
      // Use the authenticate_user function from your database
      const { data, error } = await supabase.rpc('authenticate_user', {
        input_username: username,
        input_password: password
      });

      if (error) {
        console.error('Database authentication error:', error);
        return { data: null, error: { message: 'Authentication failed' } };
      }

      if (!data || data.length === 0 || !data[0].success) {
        return { 
          data: null, 
          error: { message: data?.[0]?.message || 'Invalid username or password' } 
        };
      }

      // Extract user data from the response
      const userData = data[0];
      const authenticatedUser = {
        id: userData.user_id,
        email: userData.email,
        full_name: userData.full_name,
        identity_number: userData.identity_number,
        role: userData.role,
        department_id: userData.department_id,
        username: username,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setUser(authenticatedUser);
      setProfile(authenticatedUser); // Set both user and profile
      
      // Cache user in localStorage
      localStorage.setItem('faculty_user', JSON.stringify(authenticatedUser));

      return { data: { user: authenticatedUser }, error: null };
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

      // Check if identity_number already exists
      const { data: existingIdentity, error: identityError } = await supabase
        .from('users')
        .select('id')
        .eq('identity_number', userData.identity_number)
        .single();
        
      if (existingIdentity) {
        return { data: null, error: { message: 'Identity number already exists' } };
      }
      
      // Generate email if not provided
      const email = `${username}@faculty.edu`;

      // Create user profile directly in users table
      // The database trigger will automatically encrypt the password
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          username,
          email,
          full_name: userData.full_name,
          identity_number: userData.identity_number,
          phone_number: userData.phone_number,
          role: 'student', // Default role
          password: password // Raw password - will be encrypted by trigger
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        
        // Handle specific error cases
        if (profileError.code === '23505') {
          if (profileError.message.includes('username')) {
            return { data: null, error: { message: 'Username already exists' } };
          }
          if (profileError.message.includes('identity_number')) {
            return { data: null, error: { message: 'Identity number already exists' } };
          }
          if (profileError.message.includes('email')) {
            return { data: null, error: { message: 'Email already exists' } };
          }
        }
        
        return { data: null, error: { message: profileError.message || 'Failed to create account' } };
      }

      // Don't return the password in the response
      const { password: _, ...userWithoutPassword } = profileData;

      return { data: { user: userWithoutPassword }, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error: { message: 'An error occurred during sign up' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      setProfile(null); // Clear both user and profile
      localStorage.removeItem('faculty_user');
      
      // Clear the user context in the database
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
    profile, // Now properly exported
    loading,
    signIn,
    signUp,
    signOut,
  };
}
      localStorage.setItem('faculty_user', JSON.stringify(authenticatedUser));

      return { data: { user: authenticatedUser }, error: null };
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

      // Check if identity_number already exists
      const { data: existingIdentity, error: identityError } = await supabase
        .from('users')
        .select('id')
        .eq('identity_number', userData.identity_number)
        .single();
        
      if (existingIdentity) {
        return { data: null, error: { message: 'Identity number already exists' } };
      }
      
      // Generate email if not provided
      const email = `${username}@faculty.edu`;

      // Create user profile directly in users table
      // The database trigger will automatically encrypt the password
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          username,
          email,
          full_name: userData.full_name,
          identity_number: userData.identity_number,
          phone_number: userData.phone_number,
          role: 'student', // Default role
          password: password // Raw password - will be encrypted by trigger
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        
        // Handle specific error cases
        if (profileError.code === '23505') {
          if (profileError.message.includes('username')) {
            return { data: null, error: { message: 'Username already exists' } };
          }
          if (profileError.message.includes('identity_number')) {
            return { data: null, error: { message: 'Identity number already exists' } };
          }
          if (profileError.message.includes('email')) {
            return { data: null, error: { message: 'Email already exists' } };
          }
        }
        
        return { data: null, error: { message: profileError.message || 'Failed to create account' } };
      }

      // Don't return the password in the response
      const { password: _, ...userWithoutPassword } = profileData;

      return { data: { user: userWithoutPassword }, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error: { message: 'An error occurred during sign up' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      setProfile(null); // Clear both user and profile
      localStorage.removeItem('faculty_user');
      
      // Clear the user context in the database
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
    profile, // Now properly exported
    loading,
    signIn,
    signUp,
    signOut,
  };
}