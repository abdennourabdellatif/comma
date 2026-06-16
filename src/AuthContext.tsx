import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/utils';

interface UserProfile {
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'member';
  companyId: string;
  isOnline?: boolean;
  showOnlineStatus?: boolean;
  blockedUsers?: string[];
  restrictedUsers?: string[];
  language?: string;
  theme?: string;
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setProfile: (profile: UserProfile | null) => void;
  language: string;
  setLanguage: (lang: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  setProfile: () => {},
  language: 'ar',
  setLanguage: () => {},
  theme: 'system',
  setTheme: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguageState] = useState(() => localStorage.getItem('app-language') || 'ar');
  const [theme, setThemeState] = useState(() => localStorage.getItem('app-theme') || 'system');

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    if (user) {
      updateDoc(doc(db, 'users', user.uid), { language: lang }).catch(() => {});
    }
  };

  const setTheme = (t: string) => {
    setThemeState(t);
    if (user) {
      updateDoc(doc(db, 'users', user.uid), { theme: t }).catch(() => {});
    }
  };

  useEffect(() => {
    if (profile?.language && profile.language !== language) {
      setLanguageState(profile.language);
    }
    if (profile?.theme && profile.theme !== theme) {
      setThemeState(profile.theme);
    }
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('app-language', language);
    const root = window.document.documentElement;
    root.setAttribute('lang', language);
    root.setAttribute('dir', ['ar', 'fa', 'ur', 'he'].includes(language) ? 'rtl' : 'ltr');
  }, [language]);

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    const root = window.document.documentElement;
    
    const applyTheme = (t: string) => {
      if (t === 'dark') {
        root.classList.add('dark');
      } else if (t === 'light') {
        root.classList.remove('dark');
      } else {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        if (systemTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            setProfile(profileData);
            
            // Set online status only after we know the profile exists
            updateDoc(docRef, {
              isOnline: true
            }).catch(() => {}); // Ignore errors if doc is being created
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const handleVisibilityChange = () => {
      if (user) {
        updateDoc(doc(db, 'users', user.uid), {
          isOnline: document.visibilityState === 'visible'
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (user) {
        updateDoc(doc(db, 'users', user.uid), {
          isOnline: false
        }).catch(() => {});
      }
    };
  }, [user?.uid]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile, language, setLanguage, theme, setTheme }}>
      {children}
    </AuthContext.Provider>
  );
};
