import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Edit,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  Phone,
  Mail,
  CreditCard,
  Building2,
  GraduationCap,
  Shield,
  CheckCircle,
  AlertCircle,
  Calendar,
  MapPin,
  Camera
} from 'lucide-react';
import { User as UserType } from '../types';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import Cropper from 'react-easy-crop';

// Crop Helpers
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)

  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<string | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  const rotRad = getRadianAngle(rotation)

  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  )

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  )

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.putImageData(data, 0, 0)

  return canvas.toDataURL('image/jpeg');
}

const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth(); // Get user and refreshUser from auth hook
  const { getText } = useLanguage();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile form state
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone_number || '',
    identity_number: user?.identity_number || '',
    address: user?.address || ''
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Additional user data state
  const [userDetails, setUserDetails] = useState({
    department_name: '',
    study_program_name: '',
    created_at: '',
    last_login: '',
    attachments: '' as string | null
  });



  // Crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const showCroppedImage = async () => {
    try {
      if (!imageSrc || !croppedAreaPixels) return;
      setLoading(true);
      const croppedImage = await getCroppedImg(
        imageSrc,
        croppedAreaPixels
      );

      if (!croppedImage) return;

      if (!supabase) return;

      const { error } = await supabase
        .from('users')
        .update({
          attachments: croppedImage,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: getText('Profile photo updated', 'Foto profil diperbarui')
      });

      await refreshUser();
      await fetchUserDetails();
      setIsCropModalOpen(false);
      setImageSrc(null);
    } catch (e) {
      setMessage({
        type: 'error',
        text: getText('Failed to save cropped image', 'Gagal menyimpan foto')
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Limit file size to 5MB
      if (file.size > 5 * 1024 * 1024) {
        setMessage({
          type: 'error',
          text: getText('File size too large (max 5MB)', 'Ukuran file terlalu besar (maks 5MB)')
        });
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || '');
        setIsCropModalOpen(true);
      });
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserDetails();
    }
  }, [user]);

  const fetchUserDetails = async () => {
    if (!user || !supabase) return;

    try {
      let query = supabase
        .from('users')
        .select(`
          *,
          department:departments(name),
          study_program:study_programs(name)
        `)
        .eq('id', user.id)
        .single();

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setUserDetails({
          department_name: data.department?.name || '',
          study_program_name: data.study_program?.name || '',
          created_at: data.created_at || '',
          last_login: data.last_login || '',
          attachments: data.attachments || null
        });

        setProfileData({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone_number || '',
          identity_number: data.identity_number || '',
          address: data.address || ''
        });
      }
    } catch (error) {
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    if (!supabase) {
      setMessage({
        type: 'error',
        text: getText('Database connection error', 'Koneksi database error')
      });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: profileData.full_name,
          phone_number: profileData.phone,
          address: profileData.address,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: getText('Profile updated successfully', 'Profil berhasil diperbarui')
      });
      setIsEditingProfile(false);

      // Refresh user details to update global context
      await refreshUser();
      await fetchUserDetails();
    } catch (error) {
      setMessage({
        type: 'error',
        text: getText('Failed to update profile', 'Gagal memperbarui profil')
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    if (!supabase) {
      setMessage({
        type: 'error',
        text: getText('Database connection error', 'Koneksi database error')
      });
      setLoading(false);
      return;
    }

    // Validate password match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({
        type: 'error',
        text: getText('New passwords do not match', 'Password baru tidak cocok')
      });
      setLoading(false);
      return;
    }

    // Validate password strength
    if (passwordData.newPassword.length < 6) {
      setMessage({
        type: 'error',
        text: getText('Password must be at least 6 characters', 'Password harus minimal 6 karakter')
      });
      setLoading(false);
      return;
    }

    try {
      // Update password using Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: getText('Password updated successfully', 'Password berhasil diperbarui')
      });
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: getText('Failed to update password', 'Gagal memperbarui password')
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'super_admin':
        return getText('Super Admin', 'Super Admin');
      case 'department_admin':
        return getText('Department Admin', 'Admin Departemen');
      case 'student':
        return getText('Student', 'Mahasiswa');
      case 'lecturer':
        return getText('Lecturer', 'Dosen');
      case 'laboratory':
        return getText('Laboratory', 'Laboratorium');
      case 'staffing':
        return getText('Staffing', 'Kepegawaian');
      case 'purchasing':
        return getText('Purchasing', 'Pengadaan');
      case 'technician':
        return getText('Technician', 'Teknisi');
      case 'frontdesk':
        return getText('Front Desk', 'Front Desk');
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="h-5 w-5 text-purple-600" />;
      case 'department_admin':
        return <Building2 className="h-5 w-5 text-blue-600" />;
      case 'student':
        return <GraduationCap className="h-5 w-5 text-green-600" />;
      case 'lecturer':
        return <UserIcon className="h-5 w-5 text-orange-600" />;
      case 'laboratory':
        return <Building2 className="h-5 w-5 text-orange-500" />;
      case 'staffing':
        return <UserIcon className="h-5 w-5 text-teal-600" />;
      case 'purchasing':
        return <CreditCard className="h-5 w-5 text-cyan-600" />;
      case 'technician':
        return <GraduationCap className="h-5 w-5 text-yellow-600" />;
      case 'frontdesk':
        return <Calendar className="h-5 w-5 text-pink-600" />;
      default:
        return <UserIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">{getText('Please sign in to view profile', 'Silakan masuk untuk melihat profil')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Crop Modal */}
      {isCropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                {getText('Crop Photo', 'Potong Foto')}
              </h3>
              <button
                onClick={() => setIsCropModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="relative h-[600px] w-full bg-gray-100">
              {imageSrc && (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              )}
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-600">Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsCropModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  {getText('Cancel', 'Batal')}
                </button>
                <button
                  onClick={showCroppedImage}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {loading ? getText('Saving...', 'Menyimpan...') : getText('Save Photo', 'Simpan Foto')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {getText('Profile', 'Profil')}
              </h1>
              <p className="text-gray-600">
                {getText('Manage your personal information and account settings', 'Kelola informasi pribadi dan pengaturan akun Anda')}
              </p>
            </div>
          </div>
        </div>

        {/* Message Alert */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${message.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
            }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
              {message.text}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Overview Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="text-center">
                <div className="relative mx-auto h-24 w-24 mb-4">
                  <div className={`h-24 w-24 rounded-xl flex items-center justify-center overflow-hidden ${userDetails.attachments ? 'bg-white' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                    }`}>
                    {userDetails.attachments ? (
                      <img
                        src={userDetails.attachments}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-12 w-12 text-white" />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="absolute -bottom-2 -right-2 p-2 bg-white rounded-full shadow-lg border border-gray-100 text-gray-600 hover:text-blue-600 transition-colors"
                    title={getText('Change Photo', 'Ubah Foto')}
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                  />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{user.full_name}</h3>
                <div className="flex items-center justify-center space-x-2 mb-4">
                  {getRoleIcon(user.role)}
                  <span className="text-sm font-medium text-gray-600">
                    {getRoleDisplay(user.role)}
                  </span>
                </div>

                {/* Quick Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{getText('Identity Number', 'Nomor Identitas')}</span>
                    <span className="font-medium text-gray-900">{user.identity_number || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{getText('Email', 'Email')}</span>
                    <span className="font-medium text-gray-900">{user.email}</span>
                  </div>
                  {userDetails.department_name && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{getText('Department', 'Departemen')}</span>
                      <span className="font-medium text-gray-900">{userDetails.department_name}</span>
                    </div>
                  )}
                  {userDetails.study_program_name && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{getText('Study Program', 'Program Studi')}</span>
                      <span className="font-medium text-gray-900">{userDetails.study_program_name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
              <h4 className="font-bold text-gray-900 mb-4 flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-600" />
                <span>{getText('Account Information', 'Informasi Akun')}</span>
              </h4>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">{getText('Member Since', 'Bergabung Sejak')}</span>
                  <p className="text-sm font-medium text-gray-900">{formatDate(userDetails.created_at)}</p>
                </div>
                {userDetails.last_login && (
                  <div>
                    <span className="text-sm text-gray-500">{getText('Last Login', 'Login Terakhir')}</span>
                    <p className="text-sm font-medium text-gray-900">{formatDate(userDetails.last_login)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">
                    {getText('Personal Information', 'Informasi Pribadi')}
                  </h3>
                  {!isEditingProfile && (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                      <span>{getText('Edit', 'Edit')}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {isEditingProfile ? (
                  <form onSubmit={handleProfileSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Full Name', 'Nama Lengkap')}
                        </label>
                        <input
                          type="text"
                          value={profileData.full_name}
                          onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Phone Number', 'Nomor Telepon')}
                        </label>
                        <input
                          type="tel"
                          value={profileData.phone}
                          onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Address', 'Alamat')}
                      </label>
                      <textarea
                        value={profileData.address}
                        onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={getText('Enter your address', 'Masukkan alamat Anda')}
                      />
                    </div>

                    <div className="flex items-center space-x-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Save className="h-4 w-4" />
                        <span>{loading ? getText('Saving...', 'Menyimpan...') : getText('Save Changes', 'Simpan Perubahan')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingProfile(false);
                          setProfileData({
                            full_name: user?.full_name || '',
                            email: user?.email || '',
                            phone: user?.phone_number || '',
                            identity_number: user?.identity_number || '',
                            address: user?.address || ''
                          });
                        }}
                        className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                      >
                        <X className="h-4 w-4" />
                        <span>{getText('Cancel', 'Batal')}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3">
                      <UserIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <span className="text-sm text-gray-500">{getText('Full Name', 'Nama Lengkap')}</span>
                        <p className="font-medium text-gray-900">{profileData.full_name || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <span className="text-sm text-gray-500">{getText('Email', 'Email')}</span>
                        <p className="font-medium text-gray-900">{profileData.email || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <div>
                        <span className="text-sm text-gray-500">{getText('Phone Number', 'Nomor Telepon')}</span>
                        <p className="font-medium text-gray-900">{profileData.phone || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CreditCard className="h-5 w-5 text-gray-400" />
                      <div>
                        <span className="text-sm text-gray-500">{getText('Identity Number', 'Nomor Identitas')}</span>
                        <p className="font-medium text-gray-900">{profileData.identity_number || '-'}</p>
                      </div>
                    </div>
                    <div className="sm:col-span-2 flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-gray-400 mt-1" />
                      <div className="flex-1">
                        <span className="text-sm text-gray-500">{getText('Address', 'Alamat')}</span>
                        <p className="font-medium text-gray-900">{profileData.address || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Password Change */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">
                    {getText('Password & Security', 'Password & Keamanan')}
                  </h3>
                  {!isChangingPassword && (
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Lock className="h-4 w-4" />
                      <span>{getText('Change Password', 'Ubah Password')}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {isChangingPassword ? (
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Current Password', 'Password Saat Ini')}
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('New Password', 'Password Baru')}
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {getText('Confirm New Password', 'Konfirmasi Password Baru')}
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Lock className="h-4 w-4" />
                        <span>{loading ? getText('Updating...', 'Memperbarui...') : getText('Update Password', 'Perbarui Password')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordData({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: ''
                          });
                        }}
                        className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                      >
                        <X className="h-4 w-4" />
                        <span>{getText('Cancel', 'Batal')}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Lock className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{getText('Password', 'Password')}</p>
                        <p className="text-sm text-gray-500">{getText('Last updated', 'Terakhir diperbarui')}: {getText('Unknown', 'Tidak diketahui')}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">••••••••</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;