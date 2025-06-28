import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
    Building, Eye, EyeOff, User, Lock, UserPlus, LogIn, Shield, Phone, 
    Mail, Hash, GraduationCap, ChevronDown, Globe, Sparkles, ArrowRight,
    Users, BookOpen, X, Search, RefreshCw, Key, AlertTriangle, Info,
    CheckCircle2, Lightbulb, Zap, Star
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const signInSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  captcha: z.string().min(4, 'Please enter the captcha code'),
});

const signUpSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
  phone_number: z.string().min(10, 'Phone number must be at least 10 characters'),
  email: z.string().email('Please enter a valid email address'),
  department_id: z.string().min(1, 'Please select a department'),
  study_program_id: z.string().min(1, 'Please select a study program'),
  captcha: z.string().min(4, 'Please enter the captcha code'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignInForm = z.infer<typeof signInSchema>;
type SignUpForm = z.infer<typeof signUpSchema>;

interface Department {
  id: string;
  name: string;
  code: string;
}

interface StudyProgram {
  id: string;
  name: string;
  code: string;
  department_id: string;
}

const AuthForm: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);
  const [filteredStudyPrograms, setFilteredStudyPrograms] = useState<StudyProgram[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showStudyProgramDropdown, setShowStudyProgramDropdown] = useState(false);
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [studyProgramSearchTerm, setStudyProgramSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedStudyProgram, setSelectedStudyProgram] = useState<StudyProgram | null>(null);
  
  // Captcha states
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [showLoginInfo, setShowLoginInfo] = useState(true);
  
  const { signIn, signUp } = useAuth();
  const { getText, currentLanguage, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const signInForm = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      username: '',
      password: '',
      captcha: ''
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
      phone_number: '',
      email: '',
      department_id: '',
      study_program_id: '',
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
    setCaptchaInput('');
    // Reset captcha fields in forms
    signInForm.setValue('captcha', '');
    signUpForm.setValue('captcha', '');
  }, [signInForm, signUpForm]);

  useEffect(() => {
    fetchDepartments();
    fetchStudyPrograms();
    generateCaptcha();
  }, [generateCaptcha]);

  useEffect(() => {
    if (selectedDepartment) {
      const filtered = studyPrograms.filter(sp => sp.department_id === selectedDepartment.id);
      setFilteredStudyPrograms(filtered);
      setSelectedStudyProgram(null);
      setStudyProgramSearchTerm('');
      signUpForm.setValue('study_program_id', '');
    }
  }, [selectedDepartment, studyPrograms, signUpForm]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchStudyPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('study_programs')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setStudyPrograms(data || []);
    } catch (error) {
      console.error('Error fetching study programs:', error);
    }
  };

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
        generateCaptcha(); // Regenerate captcha on failed login
      } else {
        toast.success(getText('Welcome back!', 'Selamat datang kembali!'));
        navigate('/');
      }
    } catch (error) {
      console.error('Sign in handler error:', error);
      toast.error(getText('An unexpected error occurred during sign in', 'Terjadi kesalahan tak terduga saat masuk'));
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (data: SignUpForm) => {
    if (!verifyCaptcha(data.captcha)) {
      toast.error(getText('Invalid captcha code', 'Kode captcha tidak valid'));
      generateCaptcha();
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(data.username, data.password, {
        full_name: data.full_name,
        identity_number: data.identity_number,
        phone_number: data.phone_number,
        email: data.email,
        department_id: data.department_id,
        study_program_id: data.study_program_id,
      });
      
      if (result.error) {
        toast.error(result.error.message || getText('Failed to create account', 'Gagal membuat akun'));
        generateCaptcha();
      } else {
        toast.success(getText('Account created successfully! You can now sign in.', 'Akun berhasil dibuat! Anda sekarang dapat masuk.'));
        setIsSignUp(false);
        generateCaptcha();
        
        signInForm.reset({
          username: data.username,
          password: '',
          captcha: ''
        });
      }
    } catch (error) {
      console.error('Sign up handler error:', error);
      toast.error(getText('An unexpected error occurred during sign up', 'Terjadi kesalahan tak terduga saat mendaftar'));
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const filteredDepartments = departments.filter(dept => 
    dept.name.toLowerCase().includes(departmentSearchTerm.toLowerCase()) ||
    dept.code.toLowerCase().includes(departmentSearchTerm.toLowerCase())
  );

  const filteredStudyProgramsForSearch = filteredStudyPrograms.filter(sp =>
    sp.name.toLowerCase().includes(studyProgramSearchTerm.toLowerCase()) ||
    sp.code.toLowerCase().includes(studyProgramSearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-300/10 to-purple-300/10 rounded-full blur-3xl"></div>
      </div>

      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-lg border border-white/20">
          <Globe className="h-4 w-4 text-gray-600" />
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentLanguage === 'en' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('id')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentLanguage === 'id' 
                ? 'bg-blue-500 text-white shadow-md' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            ID
          </button>
        </div>
      </div>

      <div className="max-w-lg w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-xl relative">
                <Building className="h-12 w-12 text-white" />
                <div className="absolute -top-1 -right-1 h-6 w-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-yellow-800" />
                </div>
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            SIMPEL Kuliah
          </h2>
          <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
            {isSignUp 
              ? getText('Create your account to get started with smart campus management', 'Buat akun Anda untuk memulai manajemen kampus yang cerdas')
              : getText('Sign in to access your smart campus dashboard', 'Masuk untuk mengakses dasbor kampus cerdas Anda')
            }
          </p>
        </div>

        {/* Login Information Card - Only show on Sign In */}
        {!isSignUp && showLoginInfo && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-6 border-2 border-emerald-200 shadow-lg relative overflow-hidden">
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
                    {getText('Quick Login Tips', 'Tips Login Cepat')}
                  </h3>
                </div>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 mb-4 border border-emerald-200/50">
                <div className="flex items-start space-x-3">
                  <div className="h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Key className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-emerald-800 mb-2">
                      {getText('Try Login With Your NIM:', 'Coba Login Dengan NIM Anda:')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg p-3 text-white">
                        <p className="text-xs font-medium opacity-90 mb-1">USERNAME</p>
                        <p className="font-bold text-lg">NIM</p>
                      </div>
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg p-3 text-white">
                        <p className="text-xs font-medium opacity-90 mb-1">PASSWORD</p>
                        <p className="font-bold text-lg">NIM</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-white/80 backdrop-blur-sm py-8 px-6 shadow-2xl rounded-3xl border border-white/20 relative">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
          
          {/* Tab Switcher */}
          <div className="flex mb-8 bg-gray-100/80 rounded-2xl p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                generateCaptcha();
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
                !isSignUp
                  ? 'bg-white text-blue-600 shadow-lg transform scale-[1.02]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <LogIn className="h-4 w-4" />
              <span>{getText('Sign In', 'Masuk')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                generateCaptcha();
                setShowLoginInfo(false);
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-300 ${
                isSignUp
                  ? 'bg-white text-blue-600 shadow-lg transform scale-[1.02]'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>{getText('Sign Up', 'Daftar')}</span>
            </button>
          </div>

          {isSignUp ? (
            <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-6">
              {/* Personal Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-gray-200/50">
                  <User className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    {getText('Personal Information', 'Informasi Pribadi')}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Full Name', 'Nama Lengkap')} *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...signUpForm.register('full_name')}
                        type="text"
                        placeholder={getText("Enter your full name", "Masukkan nama lengkap Anda")}
                        className="w-full pl-10 pr-4 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                    </div>
                    {signUpForm.formState.errors.full_name && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {signUpForm.formState.errors.full_name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...signUpForm.register('identity_number')}
                        type="text"
                        placeholder={getText("Enter your student/staff ID", "Masukkan ID mahasiswa/staff")}
                        className="w-full pl-10 pr-4 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                    </div>
                    {signUpForm.formState.errors.identity_number && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {signUpForm.formState.errors.identity_number.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Email Address', 'Alamat Email')} *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...signUpForm.register('email')}
                        type="email"
                        placeholder={getText("Enter your email address", "Masukkan alamat email Anda")}
                        className="w-full pl-10 pr-4 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                    </div>
                    {signUpForm.formState.errors.email && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {signUpForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Phone Number', 'Nomor Telepon')} *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...signUpForm.register('phone_number')}
                        type="tel"
                        placeholder="08xxxxxxxxxx"
                        className="w-full pl-10 pr-4 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                    </div>
                    {signUpForm.formState.errors.phone_number && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {signUpForm.formState.errors.phone_number.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-gray-200/50">
                  <GraduationCap className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    {getText('Academic Information', 'Informasi Akademik')}
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Department', 'Departemen')} *
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      placeholder={getText("Search and select department", "Cari dan pilih departemen")}
                      value={selectedDepartment ? `${selectedDepartment.name} (${selectedDepartment.code})` : departmentSearchTerm}
                      onChange={(e) => {
                        setDepartmentSearchTerm(e.target.value);
                        setShowDepartmentDropdown(true);
                        if (!e.target.value) {
                          setSelectedDepartment(null);
                          signUpForm.setValue('department_id', '');
                        }
                      }}
                      onFocus={() => setShowDepartmentDropdown(true)}
                      className="w-full pl-10 pr-10 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    
                    {showDepartmentDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        {filteredDepartments.length > 0 ? (
                          <div className="p-1">
                            {filteredDepartments.map((dept) => (
                              <div
                                key={dept.id}
                                onClick={() => {
                                  setSelectedDepartment(dept);
                                  setDepartmentSearchTerm(`${dept.name} (${dept.code})`);
                                  signUpForm.setValue('department_id', dept.id);
                                  setShowDepartmentDropdown(false);
                                }}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150 rounded-lg"
                              >
                                <div className="font-semibold text-gray-800">{dept.name}</div>
                                <div className="text-sm text-gray-600">{dept.code}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            {getText('No departments found', 'Tidak ada departemen ditemukan')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {signUpForm.formState.errors.department_id && (
                    <p className="mt-1 text-sm text-red-600 font-medium">
                      {signUpForm.formState.errors.department_id.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Study Program', 'Program Studi')} *
                  </label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                    <input
                      type="text"
                      placeholder={getText("Search and select study program", "Cari dan pilih program studi")}value={selectedStudyProgram ? `${selectedStudyProgram.name} (${selectedStudyProgram.code})` : studyProgramSearchTerm}
                      onChange={(e) => {
                        setStudyProgramSearchTerm(e.target.value);
                        setShowStudyProgramDropdown(true);
                        if (!e.target.value) {
                          setSelectedStudyProgram(null);
                          signUpForm.setValue('study_program_id', '');
                        }
                      }}
                      onFocus={() => setShowStudyProgramDropdown(true)}
                      disabled={!selectedDepartment}
                      className="w-full pl-10 pr-10 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    
                    {showStudyProgramDropdown && selectedDepartment && (
                      <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        {filteredStudyProgramsForSearch.length > 0 ? (
                          <div className="p-1">
                            {filteredStudyProgramsForSearch.map((sp) => (
                              <div
                                key={sp.id}
                                onClick={() => {
                                  setSelectedStudyProgram(sp);
                                  setStudyProgramSearchTerm(`${sp.name} (${sp.code})`);
                                  signUpForm.setValue('study_program_id', sp.id);
                                  setShowStudyProgramDropdown(false);
                                }}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150 rounded-lg"
                              >
                                <div className="font-semibold text-gray-800">{sp.name}</div>
                                <div className="text-sm text-gray-600">{sp.code}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-gray-500">
                            {getText('No study programs found', 'Tidak ada program studi ditemukan')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {!selectedDepartment && (
                    <p className="mt-1 text-xs text-gray-500">
                      {getText('Please select a department first', 'Silakan pilih departemen terlebih dahulu')}
                    </p>
                  )}
                  {signUpForm.formState.errors.study_program_id && (
                    <p className="mt-1 text-sm text-red-600 font-medium">
                      {signUpForm.formState.errors.study_program_id.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Account Information Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-gray-200/50">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    {getText('Account Security', 'Keamanan Akun')}
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Username', 'Nama Pengguna')} *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      {...signUpForm.register('username')}
                      type="text"
                      placeholder={getText("Choose a unique username", "Pilih nama pengguna yang unik")}
                      className="w-full pl-10 pr-4 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                    />
                  </div>
                  {signUpForm.formState.errors.username && (
                    <p className="mt-1 text-sm text-red-600 font-medium">
                      {signUpForm.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Password', 'Kata Sandi')} *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...signUpForm.register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder={getText("Create a strong password", "Buat kata sandi yang kuat")}
                        className="w-full pl-10 pr-12 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
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
                    {signUpForm.formState.errors.password && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {signUpForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {getText('Confirm Password', 'Konfirmasi Kata Sandi')} *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...signUpForm.register('confirmPassword')}
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder={getText("Confirm your password", "Konfirmasi kata sandi Anda")}
                        className="w-full pl-10 pr-12 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 backdrop-blur-sm"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                        )}
                      </button>
                    </div>
                    {signUpForm.formState.errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {signUpForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Captcha Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-gray-200/50">
                  <Shield className="h-5 w-5 text-orange-500" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    {getText('Security Verification', 'Verifikasi Keamanan')}
                  </h3>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {getText('Enter Captcha Code', 'Masukkan Kode Captcha')} *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="order-2 md:order-1">
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          {...signUpForm.register('captcha')}
                          type="text"
                          placeholder={getText("Enter the code", "Masukkan kode")}
                          className="w-full pl-10 pr-4 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 backdrop-blur-sm uppercase tracking-widest"
                          maxLength={6}
                        />
                      </div>
                      {signUpForm.formState.errors.captcha && (
                        <p className="mt-1 text-sm text-red-600 font-medium">
                          {signUpForm.formState.errors.captcha.message}
                        </p>
                      )}
                    </div>
                    <div className="order-1 md:order-2">
                      <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl p-4 border-2 border-dashed border-gray-300 relative overflow-hidden">
                        <div className="absolute inset-0 bg-noise opacity-10"></div>
                        <div className="relative z-10 flex items-center justify-between">
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
              </div>

              <button
                type="submit"
                disabled={loading || !signUpForm.formState.isValid}
                className="w-full group relative flex justify-center items-center space-x-3 py-4 px-6 border border-transparent rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
              >
                <UserPlus className="h-5 w-5" />
                <span>{loading ? getText('Creating Account...', 'Membuat Akun...') : getText('Create Account', 'Buat Akun')}</span>
                {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
              </button>
            </form>
          ) : (
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
                  {getText('Security Verification', 'Verifikasi Keamanan')} *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="order-2 md:order-1">
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...signInForm.register('captcha')}
                        type="text"
                        placeholder={getText("Enter the code", "Masukkan kode")}
                        className="w-full pl-10 pr-4 py-3 bg-white/70 border border-gray-200/50 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all duration-200 backdrop-blur-sm uppercase tracking-widest"
                        maxLength={6}
                      />
                    </div>
                    {signInForm.formState.errors.captcha && (
                      <p className="mt-1 text-sm text-red-600 font-medium">
                        {signInForm.formState.errors.captcha.message}
                      </p>
                    )}
                  </div>
                  <div className="order-1 md:order-2">
                    <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl p-4 border-2 border-dashed border-gray-300 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-purple-50/50"></div>
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="text-2xl font-bold text-gray-700 tracking-widest font-mono select-none transform rotate-1">
                          {captchaCode}
                        </span>
                        <button
                          type="button"
                          onClick={generateCaptcha}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/70 rounded-lg transition-all duration-200 transform hover:scale-110"
                          title={getText("Refresh Captcha", "Refresh Captcha")}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-gray-700">
                    {getText('Remember me', 'Ingat saya')}
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                    {getText('Forgot your password?', 'Lupa kata sandi?')}
                  </a>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !signInForm.formState.isValid}
                className="w-full group relative flex justify-center items-center space-x-3 py-4 px-6 border border-transparent rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:hover:scale-100"
              >
                <LogIn className="h-5 w-5" />
                <span>{loading ? getText('Signing In...', 'Masuk...') : getText('Sign In', 'Masuk')}</span>
                {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
              </button>
            </form>
          )}

          {/* Dropdown click outside handler */}
          {(showDepartmentDropdown || showStudyProgramDropdown) && (
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => {
                setShowDepartmentDropdown(false);
                setShowStudyProgramDropdown(false);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            {getText(
              'By signing in, you agree to our Terms of Service and Privacy Policy. Your data is protected with industry-standard security.',
              'Dengan masuk, Anda menyetujui Syarat Layanan dan Kebijakan Privasi kami. Data Anda dilindungi dengan keamanan standar industri.'
            )}
          </p>
          <div className="flex justify-center space-x-4 mt-4">
            <a href="#" className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors">
              {getText('Terms of Service', 'Syarat Layanan')}
            </a>
            <span className="text-gray-300">•</span>
            <a href="#" className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors">
              {getText('Privacy Policy', 'Kebijakan Privasi')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;