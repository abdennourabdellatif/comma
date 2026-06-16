import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useTranslation } from './translations';
import { db, logOut } from './firebase';
import { doc, setDoc, deleteDoc, query, collection, where, getDocs, getDoc } from 'firebase/firestore';
import { User as UserIcon, Shield, Users, Ban, Lock, Palette, Globe, LogOut, Trash2, ArrowRight, Camera, Check, UserX, RefreshCw, ChevronLeft, MessageSquare, ArrowLeft } from 'lucide-react';

interface SettingsPageProps {
  onClose: () => void;
}

type SettingsTab = 'menu' | 'account' | 'privacy' | 'contacts' | 'blocked' | 'restricted' | 'appearance' | 'language';

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const { user, profile, language, setLanguage, theme, setTheme } = useAuth();
  const { t } = useTranslation(language);
  const [activeTab, setActiveTab] = useState<SettingsTab>('menu');
  
  // Account Settings State
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Privacy State
  const [lastSeen, setLastSeen] = useState('everyone');
  const [profilePhotoVisibility, setProfilePhotoVisibility] = useState('everyone');
  const [readReceipts, setReadReceipts] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  // Communications State
  const [communications, setCommunications] = useState<any[]>([]);
  const [isLoadingComms, setIsLoadingComms] = useState(false);

  // Blocked/Restricted State
  const [blockedUsersList, setBlockedUsersList] = useState<any[]>([]);
  const [restrictedUsersList, setRestrictedUsersList] = useState<any[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [isLoadingRestricted, setIsLoadingRestricted] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setUsername(profile.username || '');
      setPhotoURL(profile.photoURL || '');
      setShowOnlineStatus(profile.showOnlineStatus !== false);
    }
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'contacts' && user) {
      fetchCommunications();
    }
    if (activeTab === 'blocked' && user) {
      fetchBlockedUsers();
    }
    if (activeTab === 'restricted' && user) {
      fetchRestrictedUsers();
    }
  }, [activeTab, user]);

  const fetchBlockedUsers = async () => {
    if (!user || !profile?.blockedUsers?.length) {
      setBlockedUsersList([]);
      return;
    }
    setIsLoadingBlocked(true);
    try {
      const users: any[] = [];
      for (const uid of profile.blockedUsers) {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          users.push({ uid: userDoc.id, ...userDoc.data() });
        }
      }
      setBlockedUsersList(users);
    } catch (error) {
      console.error("Error fetching blocked users", error);
    } finally {
      setIsLoadingBlocked(false);
    }
  };

  const fetchRestrictedUsers = async () => {
    if (!user || !profile?.restrictedUsers?.length) {
      setRestrictedUsersList([]);
      return;
    }
    setIsLoadingRestricted(true);
    try {
      const users: any[] = [];
      for (const uid of profile.restrictedUsers) {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          users.push({ uid: userDoc.id, ...userDoc.data() });
        }
      }
      setRestrictedUsersList(users);
    } catch (error) {
      console.error("Error fetching restricted users", error);
    } finally {
      setIsLoadingRestricted(false);
    }
  };

  const handleUnblock = async (uid: string) => {
    if (!user || !profile) return;
    try {
      const newBlocked = (profile.blockedUsers || []).filter(id => id !== uid);
      await setDoc(doc(db, 'users', user.uid), { blockedUsers: newBlocked }, { merge: true });
      setBlockedUsersList(prev => prev.filter(u => u.uid !== uid));
    } catch (error) {
      console.error("Error unblocking user", error);
    }
  };

  const handleUnrestrict = async (uid: string) => {
    if (!user || !profile) return;
    try {
      const newRestricted = (profile.restrictedUsers || []).filter(id => id !== uid);
      await setDoc(doc(db, 'users', user.uid), { restrictedUsers: newRestricted }, { merge: true });
      setRestrictedUsersList(prev => prev.filter(u => u.uid !== uid));
    } catch (error) {
      console.error("Error unrestricting user", error);
    }
  };

  const fetchCommunications = async () => {
    if (!user) return;
    setIsLoadingComms(true);
    try {
      const q = query(
        collection(db, 'channels'),
        where('type', '==', 'dm'),
        where('members', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(q);
      const otherUserIds = new Set<string>();
      snapshot.forEach(doc => {
        const members = doc.data().members;
        const otherId = members.find((m: string) => m !== user.uid);
        if (otherId) otherUserIds.add(otherId);
      });

      const comms: any[] = [];
      for (const otherId of Array.from(otherUserIds)) {
        const userDoc = await getDoc(doc(db, 'users', otherId));
        if (userDoc.exists()) {
          comms.push({ uid: userDoc.id, ...userDoc.data() });
        }
      }
      setCommunications(comms);
    } catch (error) {
      console.error("Error fetching communications", error);
    } finally {
      setIsLoadingComms(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingPhoto(true);
    try {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_SIZE = 400;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64data = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoURL(base64data);
        setIsUploadingPhoto(false);
      };
      
      img.onerror = () => {
        alert("حدث خطأ أثناء قراءة الصورة.");
        setIsUploadingPhoto(false);
      };
      
      img.src = URL.createObjectURL(file);
    } catch (error) {
      console.error("Error processing image", error);
      alert("فشل معالجة الصورة.");
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName,
        username,
        photoURL
      }, { merge: true });
      alert("تم حفظ التغييرات بنجاح");
    } catch (error) {
      console.error("Error updating settings", error);
      alert("حدث خطأ أثناء تحديث الإعدادات");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("هل أنت متأكد أنك تريد حذف حسابك؟ لا يمكن التراجع عن هذا الإجراء.")) {
      try {
        // In a real app, you'd need to re-authenticate the user before deleting their auth record
        // and also clean up their data in Firestore.
        alert("يرجى التواصل مع الدعم الفني لحذف الحساب نهائياً.");
      } catch (error) {
        console.error("Error deleting account", error);
      }
    }
  };

  const handleSavePrivacy = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        showOnlineStatus
      }, { merge: true });
    } catch (error) {
      console.error("Error saving privacy settings", error);
    }
  };

  const tabs = [
    { id: 'account', label: t('profile'), icon: UserIcon },
    { id: 'privacy', label: t('privacy'), icon: Shield },
    { id: 'contacts', label: t('contacts'), icon: Users },
    { id: 'blocked', label: t('blockedUsers'), icon: Ban },
    { id: 'restricted', label: t('restrictedUsers'), icon: Lock },
    { id: 'appearance', label: t('appearance'), icon: Palette },
    { id: 'language', label: t('language'), icon: Globe },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 w-full">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-white shadow-sm z-10">
        <button 
          onClick={activeTab === 'menu' ? onClose : () => setActiveTab('menu')} 
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
        >
          {['ar', 'fa', 'ur', 'he'].includes(language) ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
        <h2 className="text-lg font-semibold text-gray-800">
          {activeTab === 'menu' ? t('settings') : tabs.find(t => t.id === activeTab)?.label}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'menu' ? (
          <div className="max-w-2xl mx-auto py-6 px-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {tabs.map((tab, index) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={`w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
                      index !== tabs.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center ml-3">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-gray-800 font-medium">{tab.label}</span>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-gray-400" />
                  </button>
                );
              })}
            </div>

            <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <button
                onClick={logOut}
                className="w-full flex items-center px-4 py-4 border-b border-gray-100 hover:bg-red-50 transition-colors text-red-600"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center ml-3">
                  <LogOut className="w-4 h-4 text-red-600" />
                </div>
                <span className="font-medium">{t('logout')}</span>
              </button>
              <button
                onClick={handleDeleteAccount}
                className="w-full flex items-center px-4 py-4 hover:bg-red-50 transition-colors text-red-600"
              >
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center ml-3">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                <span className="font-medium">{t('deleteAccount')}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-white min-h-full">
            {activeTab === 'account' && (
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">{t('profile')}</h3>
              <form onSubmit={handleSaveAccount} className="space-y-6">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative">
                    {photoURL ? (
                      <img src={photoURL} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-4 border-white shadow-md">
                        <UserIcon className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                      <Camera className="w-4 h-4 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
                    </label>
                  </div>
                  {isUploadingPhoto && <span className="text-xs text-blue-500 mt-2">{t('saving')}</span>}
                  <div className="mt-3 text-center">
                    <p className="text-xs text-gray-400 font-medium">{t('loginUsername')}:</p>
                    <p className="text-sm text-gray-600 font-mono mt-1 bg-gray-100 px-2 py-1 rounded select-all" dir="ltr">
                      {profile?.email?.split('@')[0]}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('displayName')}</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('username')}</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200"
                    dir="ltr"
                  />
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                    {t('usernameHint')}
                  </p>
                </div>
                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={!displayName.trim() || !username.trim() || isUploadingPhoto || isSaving} 
                    className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isSaving ? t('saving') : t('saveChanges')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">{t('privacy')}</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('lastSeen')}</label>
                  <select 
                    value={lastSeen}
                    onChange={(e) => setLastSeen(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200"
                  >
                    <option value="everyone">{t('everyone')}</option>
                    <option value="contacts">{t('contacts')}</option>
                    <option value="nobody">{t('nobody')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('profilePhoto')}</label>
                  <select 
                    value={profilePhotoVisibility}
                    onChange={(e) => setProfilePhotoVisibility(e.target.value)}
                    className="w-full bg-gray-50 text-gray-900 text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200"
                  >
                    <option value="everyone">{t('everyone')}</option>
                    <option value="contacts">{t('contacts')}</option>
                    <option value="nobody">{t('nobody')}</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t('lastSeen')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('onlineStatusHint')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={showOnlineStatus} 
                      onChange={() => {
                        const newVal = !showOnlineStatus;
                        setShowOnlineStatus(newVal);
                        setDoc(doc(db, 'users', user!.uid), { showOnlineStatus: newVal }, { merge: true });
                      }} 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t('readReceipts')}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('readReceiptsHint')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={readReceipts} onChange={() => setReadReceipts(!readReceipts)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">{t('contacts')}</h3>
              
              {isLoadingComms ? (
                <div className="flex justify-center py-10">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : communications.length > 0 ? (
                <div className="space-y-4">
                  {communications.map(contact => (
                    <div key={contact.uid} className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                      {contact.photoURL ? (
                        <img src={contact.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="mr-3 flex-1">
                        <p className="font-semibold text-gray-900">{contact.displayName}</p>
                        <p className="text-xs text-gray-500">@{contact.username}</p>
                      </div>
                      <button 
                        onClick={() => {
                          onClose();
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">{t('noMessages')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'blocked' && (
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">{t('blockedUsers')}</h3>
              
              {isLoadingBlocked ? (
                <div className="flex justify-center py-10">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : blockedUsersList.length > 0 ? (
                <div className="space-y-4">
                  {blockedUsersList.map(blockedUser => (
                    <div key={blockedUser.uid} className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                      {blockedUser.photoURL ? (
                        <img src={blockedUser.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="mr-3 flex-1">
                        <p className="font-semibold text-gray-900">{blockedUser.displayName}</p>
                        <p className="text-xs text-gray-500">@{blockedUser.username}</p>
                      </div>
                      <button 
                        onClick={() => handleUnblock(blockedUser.uid)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        {t('unblock')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
                  <UserX className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">{t('noBlockedUsers')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'restricted' && (
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">{t('restrictedUsers')}</h3>
              
              {isLoadingRestricted ? (
                <div className="flex justify-center py-10">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : restrictedUsersList.length > 0 ? (
                <div className="space-y-4">
                  {restrictedUsersList.map(restrictedUser => (
                    <div key={restrictedUser.uid} className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                      {restrictedUser.photoURL ? (
                        <img src={restrictedUser.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="mr-3 flex-1">
                        <p className="font-semibold text-gray-900">{restrictedUser.displayName}</p>
                        <p className="text-xs text-gray-500">@{restrictedUser.username}</p>
                      </div>
                      <button 
                        onClick={() => handleUnrestrict(restrictedUser.uid)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        {t('unrestrict')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
                  <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">{t('noRestrictedUsers')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">{t('appearance')}</h3>
              <div className="space-y-4">
                <label className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${theme === 'light' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center">
                    <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center ml-3">
                      {theme === 'light' && <div className="w-3 h-3 rounded-full bg-blue-600"></div>}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{t('themeLight')}</span>
                  </div>
                  <input type="radio" name="theme" value="light" checked={theme === 'light'} onChange={() => setTheme('light')} className="hidden" />
                </label>

                <label className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${theme === 'dark' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center">
                    <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center ml-3">
                      {theme === 'dark' && <div className="w-3 h-3 rounded-full bg-blue-600"></div>}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{t('themeDark')}</span>
                  </div>
                  <input type="radio" name="theme" value="dark" checked={theme === 'dark'} onChange={() => setTheme('dark')} className="hidden" />
                </label>

                <label className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${theme === 'system' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <div className="flex items-center">
                    <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center ml-3">
                      {theme === 'system' && <div className="w-3 h-3 rounded-full bg-blue-600"></div>}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{t('themeSystem')}</span>
                  </div>
                  <input type="radio" name="theme" value="system" checked={theme === 'system'} onChange={() => setTheme('system')} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'language' && (
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-6 text-gray-800">{t('language')}</h3>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                {[
                  { code: 'ar', name: 'العربية (Arabic)' },
                  { code: 'en', name: 'English (الإنجليزية)' },
                  { code: 'fr', name: 'Français (الفرنسية)' },
                  { code: 'es', name: 'Español (الإسبانية)' },
                  { code: 'de', name: 'Deutsch (الألمانية)' },
                  { code: 'it', name: 'Italiano (الإيطالية)' },
                  { code: 'pt', name: 'Português (البرتغالية)' },
                  { code: 'ru', name: 'Русский (الروسية)' },
                  { code: 'zh', name: '中文 (الصينية)' },
                  { code: 'ja', name: '日本語 (اليابانية)' },
                  { code: 'tr', name: 'Türkçe (التركية)' },
                  { code: 'hi', name: 'हिन्दी (الهندية)' },
                  { code: 'fa', name: 'فارسی (الفارسية)' },
                  { code: 'ur', name: 'اردو (الأردية)' }
                ].map((lang) => (
                  <button 
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-800">{lang.name}</span>
                    {language === lang.code && <Check className="w-5 h-5 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
