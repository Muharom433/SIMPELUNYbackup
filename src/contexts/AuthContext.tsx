import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface AuthContextType {
    user: User | null;
    profile: User | null;
    loading: boolean;
    signIn: (username: string, password: string) => Promise<{ data: { user: User } | null; error: { message: string } | null }>;
    signUp: (username: string, password: string, userData: { full_name: string; identity_number: string; phone_number: string; }) => Promise<{ data: { user: User } | null; error: { message: string } | null }>;
    signOut: () => Promise<{ error: { message: string } | null }>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Function to refresh user data from DB
    const refreshUser = async () => {
        if (!user?.id) return;

        try {
            if (supabase) {
                const { data: freshUser, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (!error && freshUser) {
                    const updatedUser: User = {
                        id: freshUser.id,
                        email: freshUser.email,
                        full_name: freshUser.full_name,
                        identity_number: freshUser.identity_number,
                        role: freshUser.role,
                        department_id: freshUser.department_id,
                        study_program_id: freshUser.study_program_id,
                        phone_number: freshUser.phone_number,
                        username: freshUser.username,
                        created_at: freshUser.created_at,
                        updated_at: freshUser.updated_at,
                        attachments: freshUser.attachments,
                        address: freshUser.address
                    };
                    setUser(updatedUser);
                    setProfile(updatedUser);
                    localStorage.setItem('faculty_user', JSON.stringify(updatedUser)); // Update cache
                }
            }
        } catch (error) {
        }
    };

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Check for cached user in localStorage first
                const cachedUser = localStorage.getItem('faculty_user');
                if (cachedUser) {
                    try {
                        const parsedUser = JSON.parse(cachedUser);
                        // Optimistically set user from cache
                        setUser(parsedUser);
                        setProfile(parsedUser);

                        // Re-fetch fresh user data from database to ensure everything (like attachments) is up to date
                        if (supabase) {
                            const { data: freshUser, error } = await supabase
                                .from('users')
                                .select('*')
                                .eq('id', parsedUser.id)
                                .single();

                            if (!error && freshUser) {
                                const updatedUser: User = {
                                    id: freshUser.id,
                                    email: freshUser.email,
                                    full_name: freshUser.full_name,
                                    identity_number: freshUser.identity_number,
                                    role: freshUser.role,
                                    department_id: freshUser.department_id,
                                    study_program_id: freshUser.study_program_id,
                                    phone_number: freshUser.phone_number,
                                    username: freshUser.username,
                                    created_at: freshUser.created_at,
                                    updated_at: freshUser.updated_at,
                                    attachments: freshUser.attachments,
                                    address: freshUser.address
                                };
                                setUser(updatedUser);
                                setProfile(updatedUser);
                                localStorage.setItem('faculty_user', JSON.stringify(updatedUser));
                            }
                        }
                    } catch (error) {
                    }
                }
            } catch (error) {
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

        if (!supabase) {
            return { data: null, error: { message: 'Database connection failed' } };
        }

        try {
            setLoading(true);

            // Use the authenticate_user function from your database
            const { data, error } = await supabase.rpc('authenticate_user', {
                input_username: username,
                input_password: password
            });

            if (error) {
                return { data: null, error: { message: 'Authentication failed' } };
            }

            if (!data || data.length === 0 || !data[0].success) {
                return {
                    data: null,
                    error: { message: data?.[0]?.message || 'Invalid username or password' }
                };
            }

            // Extract user data from the response
            const authResponse = data[0];

            // Fetch full user details to ensure we have all fields including attachments
            const { data: fullUserProfile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authResponse.user_id)
                .single();

            if (profileError || !fullUserProfile) {
                return { data: null, error: { message: 'Failed to fetch user profile' } };
            }

            const authenticatedUser: User = {
                id: fullUserProfile.id,
                email: fullUserProfile.email,
                full_name: fullUserProfile.full_name,
                identity_number: fullUserProfile.identity_number,
                role: fullUserProfile.role,
                department_id: fullUserProfile.department_id,
                study_program_id: fullUserProfile.study_program_id,
                phone_number: fullUserProfile.phone_number,
                username: fullUserProfile.username,
                created_at: fullUserProfile.created_at,
                updated_at: fullUserProfile.updated_at,
                attachments: fullUserProfile.attachments,
                address: fullUserProfile.address
            };

            setUser(authenticatedUser);
            setProfile(authenticatedUser);

            // Cache user in localStorage
            localStorage.setItem('faculty_user', JSON.stringify(authenticatedUser));

            return { data: { user: authenticatedUser }, error: null };
        } catch (error) {
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

        if (!supabase) {
            return { data: null, error: { message: 'Database connection failed' } };
        }

        try {
            setLoading(true);

            // Check if username already exists
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (existingUser) {
                return { data: null, error: { message: 'Username already exists' } };
            }

            // Check if identity_number already exists
            const { data: existingIdentity } = await supabase
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
                    role: 'student',
                    password: password
                })
                .select()
                .single();

            if (profileError) {

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
            return { data: null, error: { message: 'An error occurred during sign up' } };
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            setUser(null);
            setProfile(null);
            localStorage.removeItem('faculty_user');

            if (supabase) {
                try {
                    await supabase.rpc('set_current_user', { user_id: null });
                } catch (error) {
                }
            }

            return { error: null };
        } catch (error) {
            return { error: { message: 'An error occurred during sign out' } };
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshUser }
        }>
            {children}
        </AuthContext.Provider>
    );
}

// Export the context hook for internal usage or if needed directly
export function useAuthContext() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
}