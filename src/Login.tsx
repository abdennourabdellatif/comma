import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useTranslation } from './translations';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { Building2, LogIn, Loader2, UserPlus, Image as ImageIcon, Globe } from 'lucide-react';

export default function Login() {
  const { setProfile, language, setLanguage } = useAuth();
  const { t } = useTranslation(language);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [signupPrefix, setSignupPrefix] = useState(() => `${Math.floor(100 + Math.random() * 900)}-`);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 300 * 1024) {
        setErrorMsg('Image must be less than 300KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const baseUsername = username.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!baseUsername || !password) return;

    setLoading(true);
    const finalUsername = isLogin ? baseUsername : `${signupPrefix}${baseUsername}`;
    const fakeEmail = `${finalUsername}@app.local`;

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
        const user = userCredential.user;

        const userProfile = {
          uid: user.uid,
          email: fakeEmail,
          username: finalUsername,
          displayName: finalUsername,
          photoURL: photoBase64,
          role: 'member' as const,
          companyId: 'global',
          createdAt: serverTimestamp(),
          language: language,
        };

        await setDoc(doc(db, 'users', user.uid), userProfile);
        setProfile(userProfile);
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setErrorMsg(t('usernameTaken'));
      } else if (error.code === 'auth/operation-not-allowed') {
        setErrorMsg('Email/Password sign-in is not enabled. Please enable it in Firebase Console > Authentication > Sign-in method.');
      } else if (error.code === 'auth/invalid-credential') {
        setErrorMsg(t('invalidCredentials'));
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMsg('Network error: Unable to reach authentication server. Please check your internet connection, disable ad-blockers/VPNs, and refresh the page.');
      } else {
        console.error("Authentication error:", error);
        setErrorMsg(error.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="absolute top-4 right-4">
        <div className="relative group">
          <button className="p-2 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors">
            <Globe className="w-5 h-5 text-gray-600" />
          </button>
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 hidden group-hover:block z-50 max-h-64 overflow-y-auto">
            {[
              { code: 'ar', name: 'العربية' },
              { code: 'en', name: 'English' },
              { code: 'fr', name: 'Français' },
              { code: 'es', name: 'Español' },
              { code: 'de', name: 'Deutsch' },
              { code: 'it', name: 'Italiano' },
              { code: 'pt', name: 'Português' },
              { code: 'ru', name: 'Русский' },
              { code: 'zh', name: '中文' },
              { code: 'ja', name: '日本語' },
              { code: 'tr', name: 'Türkçe' },
              { code: 'hi', name: 'हिन्दी' },
              { code: 'fa', name: 'فارسی' },
              { code: 'ur', name: 'اردو' }
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${language === lang.code ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-700'}`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img src="/logo.png" alt="comma" className="h-16 w-auto" onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }} />
          <Building2 className="h-12 w-12 text-blue-600 hidden" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          comma
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isLogin ? t('signInToAccount') : t('createNewAccount')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {errorMsg}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                {t('username')}
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                {!isLogin && (
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                    {signupPrefix}
                  </span>
                )}
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`flex-1 min-w-0 block w-full px-4 py-3 border border-gray-300 ${!isLogin ? 'rounded-none rounded-r-md' : 'rounded-md'} focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm`}
                  placeholder={isLogin ? "e.g. 123-name" : "name"}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('password')}
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('profilePhoto')} ({t('optional')})
                </label>
                <div className="mt-1 flex items-center space-x-4">
                  {photoBase64 ? (
                    <img src={photoBase64} alt="Preview" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <span>{t('upload')}</span>
                    <input type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : isLogin ? (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    {t('login')}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-5 w-5 mr-2" />
                    {t('createAccount')}
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  {isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount')}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => {
                  if (isLogin) {
                    setSignupPrefix(`${Math.floor(100 + Math.random() * 900)}-`);
                  }
                  setIsLogin(!isLogin);
                  setErrorMsg('');
                  setUsername('');
                }}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {isLogin ? t('signup') : t('login')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
