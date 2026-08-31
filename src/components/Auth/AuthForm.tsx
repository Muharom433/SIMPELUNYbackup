import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building, Eye, EyeOff, User, Lock, LogIn, Shield,
  Globe, ArrowRight, Home,
  X, RefreshCw, Key, Info, Lightbulb, Zap
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSystemBranding } from '../../contexts/SystemSettingsContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const signInSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  captcha: z.string().min(4, 'Please enter the captcha code'),
});

type SignInForm = z.infer<typeof signInSchema>;

const AuthForm: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaCode, setCaptchaCode] = useState('');
  const [showLoginInfo, setShowLoginInfo] = useState(true);

  const { signIn } = useAuth();
  const { getText, currentLanguage, setLanguage } = useLanguage();
  const { system_name, system_logo, developer_name, system_version } = useSystemBranding();
  const navigate = useNavigate();

  const signInForm = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      username: '',
      password: '',
      captcha: ''
    }
  });

  // Generate captcha code
  const generateCaptcha = useCallback(() => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    setCaptchaCode(result);
    signInForm.setValue('captcha', '');
  }, [signInForm]);

  useEffect(() => {
    generateCaptcha();
  }, [generateCaptcha]);

  const verifyCaptcha = (inputCaptcha: string) => {
    return inputCaptcha.toUpperCase() === captchaCode.toUpperCase();
  };

  const handleSignIn = async (data: SignInForm) => {
    if (!verifyCaptcha(data.captcha)) {
      toast.error(getText('Invalid captcha code', 'Kode captcha tidak valid'));
      generateCaptcha();
      return;
    }

    setLoading(true);
    try {
      const result = await signIn(data.username, data.password);
      if (result.error) {
        toast.error(result.error.message || getText('Failed to sign in', 'Gagal masuk'));
        generateCaptcha();
      } else {
        toast.success(getText('Welcome back!', 'Selamat datang kembali!'));
        navigate('/');
      }
    } catch (error) {
      toast.error(getText('An unexpected error occurred during sign in', 'Terjadi kesalahan tak terduga saat masuk'));
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-300/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-indigo-300/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={() => setLanguage(currentLanguage === 'en' ? 'id' : 'en')}
          className="flex items-center space-x-2 px-4 py-2 bg-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-blue-200 hover:border-blue-400 hover:scale-105"
        >
          <Globe className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-800">
            {currentLanguage === 'en' ? '🇮🇩 ID' : '🇬🇧 EN'}
          </span>
        </button>
      </div>

      {/* Back to Home Button */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 px-4 py-2 bg-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-blue-200 hover:border-blue-400 hover:scale-105"
        >
          <Home className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-800">
            {getText('Home', 'Beranda')}
          </span>
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          {system_logo ? (
            <img src={system_logo} alt="Logo" className="h-20 w-20 mx-auto mb-6 object-contain" />
          ) : (
            <Building className="h-20 w-20 mx-auto mb-6 text-blue-600" />
          )}
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            {system_name || 'SIMPEL Kuliah'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
            {getText('Login to access more menu', 'Masuk untuk mengakses menu khusus')}
          </p>
        </div>

        {/* Login Information Card */}
        {showLoginInfo && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border-2 border-emerald-200 shadow-lg relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-300/20 to-teal-300/20 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-teal-300/20 to-emerald-300/20 rounded-full blur-xl"></div>

            <button
              onClick={() => setShowLoginInfo(false)}
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-white/50 transition-all duration-200"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-4">
                <div className="h-10 w-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Lightbulb className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-800 text-lg">
                    {getText('Attention', 'Pengumuman')}
                  </h3>
                </div>
              </div>

              {/* Important Notice - No Login Required */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-start space-x-3">
                  <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Info className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-blue-800 mb-2 text-base">
                      {getText('No Login Required for Borrowing!', 'Tidak Perlu Login untuk Meminjam!')}
                    </h4>
                    <p className="text-blue-700 text-sm leading-relaxed">
                      {getText(
                        'You can borrow rooms and equipment without logging in or registering. Simply fill out the available form. Login is only needed to access other menu features.',
                        'Anda dapat meminjam ruangan dan peralatan tanpa perlu login atau register. Cukup isi formulir yang tersedia. Login hanya diperlukan untuk mengakses fitur menu lainnya.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-white/80 backdrop-blur-sm py-8 px-6 shadow-2xl rounded-3xl border border-white/20 relative">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>

          {/* Sign In Form */}
          <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {getText('Username', 'Nama Pengguna')}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  {...signInForm.register('username')}
                  type="text"
                  placeholder={getText("Enter your username", "Masukkan nama pengguna Anda")}
                  className="w-full pl-10 pr-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm text-lg"
                />
              </div>
              {signInForm.formState.errors.username && (
                <p className="mt-2 text-sm text-red-600 font-medium">
                  {signInForm.formState.errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {getText('Password', 'Kata Sandi')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  {...signInForm.register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={getText("Enter your password", "Masukkan kata sandi Anda")}
                  className="w-full pl-10 pr-12 py-4 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm text-lg"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                  )}
                </button>
              </div>
              {signInForm.formState.errors.password && (
                <p className="mt-2 text-sm text-red-600 font-medium">
                  {signInForm.formState.errors.password.message}
                </p>
              )}
            </div>

            {/* Captcha Section for Sign In */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {getText('Enter Captcha Code', 'Masukkan Kode Captcha')}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="order-2 md:order-1">
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      {...signInForm.register('captcha')}
                      type="text"
                      placeholder={getText("Enter the code", "Masukkan kode")}
                      className="w-full pl-10 pr-4 py-4 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 backdrop-blur-sm uppercase tracking-widest text-lg"
                      maxLength={6}
                    />
                  </div>
                  {signInForm.formState.errors.captcha && (
                    <p className="mt-2 text-sm text-red-600 font-medium">
                      {signInForm.formState.errors.captcha.message}
                    </p>
                  )}
                </div>
                <div className="order-1 md:order-2">
                  <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl p-4 border-2 border-dashed border-gray-300 relative overflow-hidden h-full flex items-center">
                    <div className="absolute inset-0 bg-noise opacity-10"></div>
                    <div className="relative z-10 flex items-center justify-between w-full">
                      <span className="text-2xl font-bold text-gray-700 tracking-widest font-mono select-none">
                        {captchaCode}
                      </span>
                      <button
                        type="button"
                        onClick={generateCaptcha}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded-lg transition-all duration-200"
                        title={getText("Refresh Captcha", "Refresh Captcha")}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full group relative flex justify-center items-center space-x-3 py-4 px-6 border border-transparent rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
            >
              <LogIn className="h-5 w-5" />
              <span>{loading ? getText('Signing In...', 'Masuk...') : getText('Sign In', 'Masuk')}</span>
              {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 mb-2">{getText('Develop by', 'Dikembangkan oleh')}</p>
          <div className="flex items-center justify-center space-x-2">
            <Zap className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {developer_name || 'SIMPEL UNY'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{getText('Version', 'Versi')} {system_version || '1.0.0'}</p>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;