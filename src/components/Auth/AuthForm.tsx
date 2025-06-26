import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building, Eye, EyeOff, User, Lock, UserPlus, LogIn, Shield, Phone } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const signInSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignInForm = z.infer<typeof signInSchema>;
type SignUpForm = z.infer<typeof signUpSchema>;

const AuthForm: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const signInForm = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      username: '',
      password: ''
    }
  });

  const signUpForm = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      identity_number: '',
      phone_number: ''
    }
  });

  const handleSignIn = async (data: SignInForm) => {
    setLoading(true);
    try {
      const result = await signIn(data.username, data.password);
      if (result.error) {
        toast.error(result.error.message || 'Failed to sign in');
      } else {
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (error) {
      console.error('Sign in handler error:', error);
      toast.error('An unexpected error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (data: SignUpForm) => {
    setLoading(true);
    try {
      const result = await signUp(data.username, data.password, {
        full_name: data.full_name,
        identity_number: data.identity_number,
        phone_number: data.phone_number,
      });
      
      if (result.error) {
        toast.error(result.error.message || 'Failed to create account');
      } else {
        toast.success('Account created successfully! You can now sign in.');
        setIsSignUp(false);
        
        // Reset the sign in form with the new username
        signInForm.reset({
          username: data.username,
          password: ''
        });
      }
    } catch (error) {
      console.error('Sign up handler error:', error);
      toast.error('An unexpected error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-lg">
              <Building className="h-12 w-12 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            SIMPEL Kuliah
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isSignUp ? 'Create your account to get started' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-gray-100">
          {/* Tab Switcher */}
          <div className="flex mb-8 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                !isSignUp
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                isSignUp
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Sign Up</span>
            </button>
          </div>

          {isSignUp ? (
            <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-6">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...signUpForm.register('full_name')}
                    id="full_name"
                    type="text"
                    placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
                {signUpForm.formState.errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">
                    {signUpForm.formState.errors.full_name.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="identity_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Identity Number (NIM/NIP)
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...signUpForm.register('identity_number')}
                    id="identity_number"
                    type="text"
                    placeholder="Enter your student/staff ID"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
                {signUpForm.formState.errors.identity_number && (
                  <p className="mt-1 text-sm text-red-600">
                    {signUpForm.formState.errors.identity_number.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...signUpForm.register('phone_number')}
                    id="phone_number"
                    type="tel"
                    placeholder="Enter your phone number"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
                {signUpForm.formState.errors.phone_number && (
                  <p className="mt-1 text-sm text-red-600">
                    {signUpForm.formState.errors.phone_number.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="signup_username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...signUpForm.register('username')}
                    id="signup_username"
                    type="text"
                    placeholder="Choose a username"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
                {signUpForm.formState.errors.username && (
                  <p className="mt-1 text-sm text-red-600">
                    {signUpForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="signup_password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...signUpForm.register('password')}
                    id="signup_password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
                {signUpForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-600">
                    {signUpForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...signUpForm.register('confirmPassword')}
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
                {signUpForm.formState.errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    {signUpForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !signUpForm.formState.isValid}
                className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <UserPlus className="h-5 w-5" />
                <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-6">
              <div>
                <label htmlFor="signin_username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...signInForm.register('username')}
                    id="signin_username"
                    type="text"
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                </div>
                {signInForm.formState.errors.username && (
                  <p className="mt-1 text-sm text-red-600">
                    {signInForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="signin_password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    {...signInForm.register('password')}
                    id="signin_password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
                {signInForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-600">
                    {signInForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                    Forgot your password?
                  </a>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !signInForm.formState.isValid}
                className="w-full flex justify-center items-center space-x-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <LogIn className="h-5 w-5" />
                <span>{loading ? 'Signing In...' : 'Sign In'}</span>
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            By signing in, you agree to our{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;