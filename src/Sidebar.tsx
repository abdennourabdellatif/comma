import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useTranslation } from './translations';
import { db, logOut } from './firebase';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/utils';
import { Plus, LogOut, Settings, User as UserIcon, Users, MessageSquare, MoreVertical, SquarePen, X, BellOff } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private' | 'dm';
  lastMessageAt?: any;
  createdAt?: any;
  lastMessageSenderId?: string;
  readBy?: string[];
  status?: string;
  photoURL?: string;
  createdBy?: string;
}

interface SidebarProps {
  selectedChannelId: string | null;
  onSelectChannel: (id: string) => void;
  onOpenSettings?: () => void;
}

export default function Sidebar({ selectedChannelId, onSelectChannel, onOpenSettings }: SidebarProps) {
  const { user, profile, language } = useAuth();
  const { t } = useTranslation(language);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>('messages');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [showNewDM, setShowNewDM] = useState(false);
  const [newDMUsername, setNewDMUsername] = useState('');
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [selectedUsersForGroup, setSelectedUsersForGroup] = useState<string[]>([]);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const prevLastMessages = React.useRef<Record<string, number>>({});

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (allChannels.length > 0 && !isInitialized) {
      allChannels.forEach(c => {
        prevLastMessages.current[c.id] = c.lastMessageAt?.toMillis() || 0;
      });
      setIsInitialized(true);
    }
  }, [allChannels, isInitialized]);

  useEffect(() => {
    if (!user || !isInitialized) return;
    
    allChannels.forEach(channel => {
      const prevTime = prevLastMessages.current[channel.id] || 0;
      const currTime = channel.lastMessageAt?.toMillis() || 0;
      
      if (currTime > prevTime) {
        // Only notify if:
        // 1. Not sent by me
        // 2. Channel is not muted by me
        // 3. Either the tab is hidden OR it's not the currently selected channel
        const isMe = channel.lastMessageSenderId === user.uid;
        const isMuted = channel.mutedBy?.includes(user.uid);
        const isCurrentChannelVisible = channel.id === selectedChannelId && document.visibilityState === 'visible';

        if (!isMe && !isMuted && !isCurrentChannelVisible) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(channel.displayName || 'New Message', {
              body: channel.lastMessageText || 'New message received',
              icon: channel.photoURL || '/favicon.ico',
              tag: channel.id // Prevent duplicate notifications for same channel
            });
          }
        }
      }
      prevLastMessages.current[channel.id] = currTime;
    });
  }, [allChannels, user, selectedChannelId, isInitialized]);

  useEffect(() => {
    if (!profile?.companyId || !user) return;

    // Listen to company users
    const usersQ = query(collection(db, 'users'), where('companyId', '==', profile.companyId));
    const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
      const users: any[] = [];
      snapshot.forEach(doc => {
        if (doc.id !== user.uid) {
          users.push({ uid: doc.id, ...doc.data() });
        }
      });
      setCompanyUsers(users);
    }, (error) => {
      if (error.name !== 'AbortError') {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    });

    // Listen to all channels for this company
    const q = query(
      collection(db, 'channels'),
      where('companyId', '==', profile.companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChannels: Channel[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const isMember = data.members?.includes(user.uid);
        const isPublic = data.type === 'public';
        
        if (isPublic || isMember) {
          fetchedChannels.push({
            id: doc.id,
            name: data.name,
            type: data.type,
            lastMessageAt: data.lastMessageAt,
            createdAt: data.createdAt,
            lastMessageSenderId: data.lastMessageSenderId,
            readBy: data.readBy || [],
            status: data.status,
            createdBy: data.createdBy,
            ...data
          });
        }
      });
      setAllChannels(fetchedChannels);
      
      if (!selectedChannelId && fetchedChannels.length > 0) {
        // We'll auto-select later after sorting if needed, or just let it be.
        // Actually, let's not auto-select here to avoid jumping around.
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'channels');
    });

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, [profile, user, selectedChannelId, onSelectChannel]);

  const usersMap = React.useMemo(() => {
    const map = new Map();
    companyUsers.forEach(u => map.set(u.uid, u));
    return map;
  }, [companyUsers]);

  const { messagesList, requestsList, requestsCount, contacts } = React.useMemo(() => {
    if (!user) return { messagesList: [], requestsList: [], requestsCount: 0, contacts: [] };

    const processed = allChannels
      .filter(channel => {
        if (channel.type === 'dm') {
          const otherUid = channel.members?.find((m: string) => m !== user.uid);
          if (otherUid && profile?.blockedUsers?.includes(otherUid)) {
            return false;
          }
        }
        return true;
      })
      .map(channel => {
        let displayName = channel.name;
        let photoURL = null;

        if (channel.type === 'dm') {
          const otherUid = channel.members?.find((m: string) => m !== user.uid);
          if (otherUid) {
            const otherUser = usersMap.get(otherUid);
            displayName = otherUser?.displayName || (channel as any).memberNames?.[otherUid] || channel.name;
            photoURL = otherUser?.photoURL || null;
          }
        }

        return {
          ...channel,
          displayName,
          photoURL
        };
      });

    processed.sort((a, b) => {
      const timeA = a.lastMessageAt?.toMillis() || a.createdAt?.toMillis() || 0;
      const timeB = b.lastMessageAt?.toMillis() || b.createdAt?.toMillis() || 0;
      return timeB - timeA;
    });

    const msgs: any[] = [];
    const reqs: any[] = [];
    const dmUserIds = new Set<string>();

    processed.forEach(channel => {
      const otherUid = channel.members?.find((m: string) => m !== user.uid);
      const isRestricted = otherUid && profile?.restrictedUsers?.includes(otherUid);

      if (channel.type === 'dm' && otherUid) {
        dmUserIds.add(otherUid);
      }

      if ((channel.type === 'dm' && channel.status === 'pending' && channel.createdBy !== user.uid) || isRestricted) {
        reqs.push(channel);
      } else {
        msgs.push(channel);
      }
    });

    const contactsList = companyUsers.filter(u => dmUserIds.has(u.uid));

    return { messagesList: msgs, requestsList: reqs, requestsCount: reqs.length, contacts: contactsList };
  }, [allChannels, user, usersMap, companyUsers, profile]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !profile || !user) return;
    if (selectedUsersForGroup.length < 2) {
      alert('Please select at least 2 users to create a group.');
      return;
    }

    try {
      const channelRef = doc(collection(db, 'channels'));
      await setDoc(channelRef, {
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        companyId: profile.companyId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        type: 'private',
        members: [user.uid, ...selectedUsersForGroup]
      });
      setShowNewChannel(false);
      setNewChannelName('');
      setSelectedUsersForGroup([]);
      onSelectChannel(channelRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'channels');
    }
  };

  const toggleUserForGroup = (uid: string) => {
    setSelectedUsersForGroup(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateDM = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = newDMUsername.trim().toLowerCase();
    if (!username || !profile || !user) return;

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert('User not found. Please check the username.');
        return;
      }

      const targetUser = querySnapshot.docs[0];
      const targetUid = targetUser.id;
      const targetName = targetUser.data().displayName;

      if (targetUid === user.uid) {
        alert('You cannot start a DM with yourself.');
        return;
      }

      // Check if DM already exists
      const dmQuery = query(
        collection(db, 'channels'),
        where('type', '==', 'dm'),
        where('members', 'array-contains', user.uid)
      );
      const dmSnapshot = await getDocs(dmQuery);
      let existingChannelId = null;
      dmSnapshot.forEach(doc => {
        const members = doc.data().members;
        if (members.includes(targetUid) && members.length === 2) {
          existingChannelId = doc.id;
        }
      });

      if (existingChannelId) {
        onSelectChannel(existingChannelId);
        setShowNewDM(false);
        setNewDMUsername('');
        return;
      }

      const channelRef = doc(collection(db, 'channels'));
      await setDoc(channelRef, {
        name: `${profile.displayName} & ${targetName}`,
        memberNames: {
          [user.uid]: profile.displayName,
          [targetUid]: targetName
        },
        companyId: profile.companyId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        type: 'dm',
        members: [user.uid, targetUid],
        invitedEmails: [],
        status: 'pending'
      });

      setShowNewDM(false);
      setNewDMUsername('');
      onSelectChannel(channelRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'channels/dm');
    }
  };

  return (
    <div className="w-full md:w-64 bg-gray-900 text-gray-300 flex flex-col h-full flex-shrink-0">
      <div className="h-16 flex items-center px-4 font-bold text-white border-b border-gray-800 shadow-sm justify-between">
        <span className="truncate">Corporate Connect</span>
        <div className="relative">
          <button 
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            onBlur={() => setTimeout(() => setShowCreateMenu(false), 200)}
            className="text-gray-400 hover:text-white p-1.5 rounded-md hover:bg-gray-800 transition-colors"
            title="New Message"
          >
            <SquarePen className="h-5 w-5" />
          </button>
          {showCreateMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1" role="menu">
                <button
                  onClick={() => { setShowNewChannel(true); setShowNewDM(false); setShowCreateMenu(false); }}
                  className="w-full text-start px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  {t('newGroup')}
                </button>
                <button
                  onClick={() => { setShowNewDM(true); setShowNewChannel(false); setShowCreateMenu(false); }}
                  className="w-full text-start px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  {t('newDM')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3">
          <div className="flex w-full bg-gray-800 rounded-lg p-1">
            <button
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${activeTab === 'messages' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              onClick={() => setActiveTab('messages')}
            >
              {t('messages')}
            </button>
            <button
              className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors flex items-center justify-center ${activeTab === 'requests' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
              onClick={() => setActiveTab('requests')}
            >
              {t('requests')}
              {requestsCount > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                  {requestsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5 pb-4">
          {(activeTab === 'messages' ? messagesList : requestsList).map((channel) => {
            const isUnread = channel.lastMessageSenderId && channel.lastMessageSenderId !== user?.uid && !channel.readBy?.includes(user?.uid);
            
            return (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md mx-2 w-[calc(100%-1rem)] ${
                  selectedChannelId === channel.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <div className="flex-shrink-0 me-3 relative">
                  {channel.photoURL ? (
                    <img src={channel.photoURL} alt="" className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-6 w-6 rounded-md bg-gray-700 flex items-center justify-center">
                      {channel.type === 'dm' ? <UserIcon className="h-4 w-4 text-gray-400" /> : <Users className="h-4 w-4 text-gray-400" />}
                    </div>
                  )}
                  {channel.type === 'dm' && (() => {
                    const otherUid = channel.members?.find((m: string) => m !== user?.uid);
                    const otherUser = usersMap.get(otherUid);
                    const isRestricted = otherUser?.restrictedUsers?.includes(user?.uid);
                    const isBlocked = otherUser?.blockedUsers?.includes(user?.uid);
                    if (otherUser?.isOnline && otherUser?.showOnlineStatus !== false && !isRestricted && !isBlocked) {
                      return <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-gray-900 rounded-full"></div>;
                    }
                    return null;
                  })()}
                </div>
                <span className={`truncate flex-1 text-start ${isUnread ? 'font-bold text-white' : ''}`}>
                  {channel.displayName}
                </span>
                {channel.mutedBy?.includes(user?.uid) && (
                  <BellOff className="h-3 w-3 text-gray-500 ms-1 flex-shrink-0" />
                )}
                {isUnread && (
                  <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 ms-2"></div>
                )}
              </button>
            );
          })}
          
          {(activeTab === 'messages' ? messagesList : requestsList).length === 0 && (
            <div className="text-center px-4 py-6 text-gray-500 text-sm">
              {activeTab === 'messages' ? t('noMessages') : t('noRequests')}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {profile?.photoURL ? (
              <img className="h-8 w-8 rounded-full" src={profile.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
            )}
          </div>
          <div className="ms-3 min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{profile?.displayName}</p>
            <p className="text-xs text-gray-500 truncate">@{profile?.username}</p>
          </div>
          <div className="relative ms-2 flex-shrink-0">
            <button
              onClick={() => {
                if (onOpenSettings) onOpenSettings();
              }}
              className="text-gray-500 hover:text-gray-300 p-1 rounded-md hover:bg-gray-800 transition-colors"
              title={t('settings')}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showNewChannel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">{t('newGroup')}</h3>
              <button onClick={() => { setShowNewChannel(false); setSelectedUsersForGroup([]); setNewChannelName(''); }} className="text-gray-400 hover:text-white">
                 <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <form onSubmit={handleCreateChannel} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t('groupName')}</label>
                  <input
                    type="text"
                    autoFocus
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder={t('groupName')}
                    className="w-full bg-gray-900 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-2">{t('members')}</p>
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-900 p-2 rounded-md border border-gray-700">
                    {contacts.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">No contacts found. Start a DM first.</p>
                    ) : (
                      contacts.map(u => (
                        <label key={u.uid} className="flex items-center space-x-3 text-sm text-gray-300 cursor-pointer hover:bg-gray-800 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedUsersForGroup.includes(u.uid)}
                            onChange={() => toggleUserForGroup(u.uid)}
                            className="rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-800 h-4 w-4"
                          />
                          <span className="truncate">{u.displayName} (@{u.username})</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button type="button" onClick={() => { setShowNewChannel(false); setSelectedUsersForGroup([]); setNewChannelName(''); }} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">{t('cancel')}</button>
                  <button type="submit" disabled={!newChannelName.trim() || selectedUsersForGroup.length < 2} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors">{t('createGroup')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showNewDM && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">{t('newDM')}</h3>
              <button onClick={() => { setShowNewDM(false); setNewDMUsername(''); }} className="text-gray-400 hover:text-white">
                 <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <form onSubmit={handleCreateDM} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t('username')}</label>
                  <input
                    type="text"
                    autoFocus
                    value={newDMUsername}
                    onChange={(e) => setNewDMUsername(e.target.value)}
                    placeholder={t('username')}
                    className="w-full bg-gray-900 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button type="button" onClick={() => { setShowNewDM(false); setNewDMUsername(''); }} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">{t('cancel')}</button>
                  <button type="submit" disabled={!newDMUsername.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors">{t('startChat')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
