import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useTranslation } from './translations';
import { db, storage } from './firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, serverTimestamp, documentId } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from './lib/utils';
import { format } from 'date-fns';
import { Send, User as UserIcon, Users, UserPlus, X, Trash2, ArrowLeft, ArrowRight, MoreVertical, Clock, BellOff, Ban, Flag, ShieldAlert, Image as ImageIcon, Mic, Paperclip, Smile, Reply, Edit2, Check, CheckCheck } from 'lucide-react';
import WaveformPlayer from './components/WaveformPlayer';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  reactions?: Record<string, string>;
  createdAt: any;
  replyToId?: string;
  replyToName?: string;
  replyToText?: string;
  isEdited?: boolean;
}

interface ChatAreaProps {
  channelId: string;
  onChannelDeleted?: () => void;
  onBack?: () => void;
}

export default function ChatArea({ channelId, onChannelDeleted, onBack }: ChatAreaProps) {
  const { user, profile, language } = useAuth();
  const { t } = useTranslation(language);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState('');
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [channelCreatedBy, setChannelCreatedBy] = useState('');
  const [channelStatus, setChannelStatus] = useState('accepted');
  const [channelReadBy, setChannelReadBy] = useState<string[]>([]);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [dmUsers, setDmUsers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ message: Message, x: number, y: number } | null>(null);
  const [defaultEmoji] = useState('❤️');
  const touchTimer = useRef<NodeJS.Timeout | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;
    
    setIsUploading(true);
    try {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64data = canvas.toDataURL('image/jpeg', 0.7);
        
        if (base64data.length > 900000) {
          alert("حجم الصورة كبير جداً حتى بعد الضغط. يرجى اختيار صورة أصغر.");
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        setSelectedImage(base64data);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      
      img.onerror = () => {
        alert("حدث خطأ أثناء قراءة الصورة.");
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      
      img.src = URL.createObjectURL(file);
    } catch (error: any) {
      console.error("Error processing image", error);
      alert(`فشل معالجة الصورة.\nالخطأ: ${error.message}`);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (!user || !profile) return;
        
        setIsUploading(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            
            if (base64data.length > 900000) {
              alert("الرسالة الصوتية طويلة جداً. يرجى تسجيل رسالة أقصر.");
              setIsUploading(false);
              return;
            }

            try {
              const messageRef = doc(collection(db, 'messages'));
              await setDoc(messageRef, {
                channelId,
                companyId: profile.companyId,
                senderId: user.uid,
                senderName: profile.displayName,
                senderPhotoURL: profile.photoURL || '',
                audioUrl: base64data,
                createdAt: serverTimestamp(),
              });

              await updateDoc(doc(db, 'channels', channelId), {
                lastMessageAt: serverTimestamp(),
                lastMessageSenderId: user.uid,
                lastMessageText: 'مقطع صوتي',
                readBy: [user.uid]
              });
            } catch (err) {
              console.error("Error saving audio message", err);
              alert("حدث خطأ أثناء إرسال الصوت.");
            } finally {
              setIsUploading(false);
            }
          };
          
          reader.onerror = () => {
            alert("حدث خطأ أثناء قراءة الصوت.");
            setIsUploading(false);
          };
        } catch (error: any) {
          console.error("Error processing audio", error);
          alert(`فشل معالجة الصوت.\nالخطأ: ${error.message}`);
          setIsUploading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error("Error starting recording", error);
      alert(`فشل الوصول للميكروفون. يرجى إعطاء الصلاحية للمتصفح.\nالخطأ: ${error.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    try {
      const messageRef = doc(db, 'messages', messageId);
      const message = messages.find(m => m.id === messageId);
      if (!message) return;
      
      const currentReactions = message.reactions || {};
      const newReactions = { ...currentReactions };
      
      if (newReactions[user.uid] === emoji) {
        delete newReactions[user.uid]; // toggle off
      } else {
        newReactions[user.uid] = emoji;
      }
      
      await updateDoc(messageRef, { reactions: newReactions });
    } catch (error) {
      console.error("Error adding reaction", error);
    }
  };

  const otherMemberUid = useMemo(() => {
    if (channelType !== 'dm') return null;
    return channelMembers.find(m => m !== user?.uid);
  }, [channelType, channelMembers, user?.uid]);

  const isOtherUserBlocked = useMemo(() => {
    if (!otherMemberUid || !profile?.blockedUsers) return false;
    return profile.blockedUsers.includes(otherMemberUid);
  }, [otherMemberUid, profile?.blockedUsers]);

  const isOtherUserRestricted = useMemo(() => {
    if (!otherMemberUid || !profile?.restrictedUsers) return false;
    return profile.restrictedUsers.includes(otherMemberUid);
  }, [otherMemberUid, profile?.restrictedUsers]);

  const handleBlockUser = async (targetUid: string) => {
    if (!user || !profile) return;
    try {
      const isBlocked = profile.blockedUsers?.includes(targetUid);
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUsers: isBlocked ? arrayRemove(targetUid) : arrayUnion(targetUid)
      });
    } catch (error) {
      console.error("Error blocking user", error);
    }
  };

  const handleRestrictUser = async (targetUid: string) => {
    if (!user || !profile) return;
    try {
      const isRestricted = profile.restrictedUsers?.includes(targetUid);
      await updateDoc(doc(db, 'users', user.uid), {
        restrictedUsers: isRestricted ? arrayRemove(targetUid) : arrayUnion(targetUid)
      });
    } catch (error) {
      console.error("Error restricting user", error);
    }
  };

  useEffect(() => {
    if (!profile?.companyId) return;
    const q = query(collection(db, 'users'), where('companyId', '==', profile.companyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: any[] = [];
      snapshot.forEach((doc) => {
        users.push({ uid: doc.id, ...doc.data() });
      });
      setCompanyUsers(users);
    }, (error) => {
      if (error.name !== 'AbortError') {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    });
    return () => unsubscribe();
  }, [profile?.companyId]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'channels'), where('type', '==', 'dm'), where('members', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const dmUserIds = new Set<string>();
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.members) {
          data.members.forEach((m: string) => {
            if (m !== user.uid) dmUserIds.add(m);
          });
        }
      });

      const ids = Array.from(dmUserIds);
      if (ids.length === 0) {
        setDmUsers([]);
        return;
      }

      const chunks = [];
      for (let i = 0; i < ids.length; i += 10) {
        chunks.push(ids.slice(i, i + 10));
      }

      const fetchedUsers: any[] = [];
      for (const chunk of chunks) {
        try {
          const usersQuery = query(collection(db, 'users'), where(documentId(), 'in', chunk));
          const usersSnap = await getDocs(usersQuery);
          usersSnap.forEach(userDoc => {
            fetchedUsers.push({ uid: userDoc.id, ...userDoc.data() });
          });
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.error("Error fetching DM users chunk", error);
          }
        }
      }
      setDmUsers(fetchedUsers);
    }, (error) => {
      if (error.name !== 'AbortError') {
        handleFirestoreError(error, OperationType.LIST, 'channels');
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const allAvailableUsers = useMemo(() => {
    const map = new Map();
    companyUsers.forEach(u => map.set(u.uid, u));
    dmUsers.forEach(u => map.set(u.uid, u));
    return Array.from(map.values());
  }, [companyUsers, dmUsers]);

  const otherUser = useMemo(() => {
    if (!otherMemberUid) return null;
    return allAvailableUsers.find(u => u.uid === otherMemberUid);
  }, [otherMemberUid, allAvailableUsers]);

  const isBlockedByOther = useMemo(() => {
    if (!otherMemberUid) return false;
    return otherUser?.blockedUsers?.includes(user?.uid);
  }, [otherMemberUid, otherUser, user?.uid]);

  useEffect(() => {
    if (!channelId) return;

    // Listen to channel details
    const unsubscribeChannel = onSnapshot(doc(db, 'channels', channelId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let displayName = data.name;
        if (data.type === 'dm' && data.memberNames && user) {
           const otherUid = data.members.find((m: string) => m !== user.uid);
           if (otherUid && data.memberNames[otherUid]) {
             displayName = data.memberNames[otherUid];
           }
        }
        setChannelName(displayName);
        setChannelType(data.type || 'public');
        setChannelMembers(data.members || []);
        setChannelCreatedBy(data.createdBy);
        setChannelStatus(data.status || 'accepted');
        setChannelReadBy(data.readBy || []);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `channels/${channelId}`);
    });

    // Listen to messages
    const q = query(
      collection(db, 'messages'),
      where('channelId', '==', channelId)
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMessages.push({
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderPhotoURL: data.senderPhotoURL,
          text: data.text,
          imageUrl: data.imageUrl,
          audioUrl: data.audioUrl,
          reactions: data.reactions,
          replyToId: data.replyToId,
          replyToName: data.replyToName,
          replyToText: data.replyToText,
          isEdited: data.isEdited,
          createdAt: data.createdAt,
        });
      });
      
      // Sort messages by createdAt in the client to avoid needing a composite index
      fetchedMessages.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeA - timeB;
      });

      setMessages(fetchedMessages);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => {
      unsubscribeChannel();
      unsubscribeMessages();
    };
  }, [channelId]);

  const handleTouchStart = (e: React.TouchEvent, message: Message) => {
    const touch = e.touches[0];
    touchTimer.current = setTimeout(() => {
      setContextMenu({ message, x: touch.clientX, y: touch.clientY });
    }, 500);
  };
  const handleTouchEnd = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };
  const handleTouchMove = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };
  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    setContextMenu({ message, x: e.clientX, y: e.clientY });
  };
  const handleDoubleClick = (messageId: string) => {
    handleReaction(messageId, defaultEmoji);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || !profile || !user) return;

    const text = newMessage.trim();
    const imgData = selectedImage;
    setNewMessage('');
    setSelectedImage(null);

    try {
      if (editingMessage) {
        await updateDoc(doc(db, 'messages', editingMessage.id), {
          text,
          isEdited: true
        });
        setEditingMessage(null);
      } else {
        const messageRef = doc(collection(db, 'messages'));
        const payload: any = {
          channelId,
          companyId: profile.companyId,
          senderId: user.uid,
          senderName: profile.displayName,
          senderPhotoURL: profile.photoURL || '',
          createdAt: serverTimestamp(),
        };

        if (text) payload.text = text;
        if (imgData) payload.imageUrl = imgData;

        if (replyingTo) {
          payload.replyToId = replyingTo.id;
          payload.replyToName = replyingTo.senderName;
          payload.replyToText = replyingTo.text || (replyingTo.imageUrl ? 'صورة' : replyingTo.audioUrl ? 'مقطع صوتي' : '');
        }

        await setDoc(messageRef, payload);
        setReplyingTo(null);

        await updateDoc(doc(db, 'channels', channelId), {
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: user.uid,
          lastMessageText: text || (imgData ? 'صورة' : 'رسالة'),
          readBy: [user.uid]
        });
      }
    } catch (error) {
      handleFirestoreError(error, editingMessage ? OperationType.UPDATE : OperationType.CREATE, 'messages');
    }
  };

  useEffect(() => {
    if (channelId && user) {
      updateDoc(doc(db, 'channels', channelId), {
        readBy: arrayUnion(user.uid)
      }).catch(e => console.error("Failed to mark as read", e));
    }
  }, [channelId, user]);

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return '';
    return format(timestamp.toDate(), 'h:mm a');
  };

  const renderMessageText = (text?: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">{part}</a>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const canManageMembers = profile?.role === 'admin' || channelCreatedBy === user?.uid || channelType === 'dm';
  const canDeleteChannel = profile?.role === 'admin' || channelCreatedBy === user?.uid || (channelType === 'dm' && channelMembers.includes(user?.uid || ''));

  const handleAddMember = async (targetUid: string) => {
    try {
      const channelRef = doc(db, 'channels', channelId);
      
      const updates: any = {
        members: arrayUnion(targetUid)
      };

      if (channelType === 'dm') {
        updates.type = 'private';
        updates.name = `${channelName}, Group`;
      }

      await updateDoc(channelRef, updates);
      setChannelMembers(prev => [...prev, targetUid]);
      
      if (channelType === 'dm') {
        setChannelType('private');
        setChannelName(`${channelName}, Group`);
      }
    } catch (error) {
      console.error("Failed to add member", error);
      // alert("Failed to add member. You might not have permission.");
    }
  };

  const handleDeleteChannel = async () => {
    try {
      await deleteDoc(doc(db, 'channels', channelId));
      if (onChannelDeleted) onChannelDeleted();
    } catch (error) {
      console.error("Failed to delete channel", error);
      // We shouldn't use alert() either, but for now we'll just log it.
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const handleAcceptDM = async () => {
    try {
      await updateDoc(doc(db, 'channels', channelId), { status: 'accepted' });
      setChannelStatus('accepted');
    } catch (error) {
      console.error("Failed to accept DM", error);
    }
  };

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'channels', channelId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsMuted(data.mutedBy?.includes(user?.uid) || false);
      }
    });
    return () => unsub();
  }, [channelId, user?.uid]);

  const toggleMute = async () => {
    if (!user) return;
    try {
      const channelRef = doc(db, 'channels', channelId);
      await updateDoc(channelRef, {
        mutedBy: isMuted ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error toggling mute", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, 'messages', messageId));
    } catch (error) {
      console.error("Failed to delete message", error);
    }
  };

  const displayedMembers = channelType === 'public' 
    ? companyUsers 
    : allAvailableUsers.filter(u => channelMembers.includes(u.uid));

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {showSettingsPage ? (
        <div className="flex-1 flex flex-col bg-gray-50 overflow-y-auto">
          {/* Settings Header */}
          <div className="h-16 flex items-center px-4 sm:px-6 border-b border-gray-200 shadow-sm bg-white z-10 flex-shrink-0 sticky top-0">
            <button
              onClick={() => setShowSettingsPage(false)}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors me-3"
              title={t('backToChat')}
            >
              {['ar', 'fa', 'ur', 'he'].includes(language) ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </button>
            <h2 className="text-lg font-bold text-gray-900">{t('chatSettings')}</h2>
          </div>

          {/* Settings Content */}
          <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-6">
            {/* Channel Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
              <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mb-4 overflow-hidden">
                {channelType === 'dm' && otherUser?.photoURL ? (
                  <img src={otherUser.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-full w-full bg-blue-100 flex items-center justify-center">
                    {channelType === 'dm' ? <UserIcon className="h-10 w-10 text-blue-600" /> : <Users className="h-10 w-10 text-blue-600" />}
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900">{channelName}</h3>
              <p className="text-sm text-gray-500 mt-1 capitalize">
                {channelType === 'dm' 
                  ? t('dm') 
                  : channelType === 'private' 
                    ? t('privateGroup') 
                    : t('publicGroup')}
              </p>
            </div>

            {/* Members Section (Only for Groups) */}
            {channelType !== 'dm' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center">
                    <Users className="h-4 w-4 me-2 text-gray-500" />
                    {t('members')} ({displayedMembers.length})
                  </h4>
                  {canManageMembers && (
                    <button
                      onClick={() => setShowAddMember(!showAddMember)}
                      className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${showAddMember ? 'bg-blue-100 text-blue-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      {showAddMember ? t('cancel') : t('addMember')}
                    </button>
                  )}
                </div>

                {showAddMember && canManageMembers && (
                  <div className="p-4 border-b border-gray-200 bg-blue-50/50 max-h-60 overflow-y-auto">
                    <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('addFromCompany')}</h5>
                    {allAvailableUsers.filter(u => !channelMembers.includes(u.uid)).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">{t('allUsersAdded')}</p>
                    ) : (
                      <div className="space-y-3">
                        {allAvailableUsers.filter(u => !channelMembers.includes(u.uid)).map(member => (
                          <div key={member.uid} className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                            <div className="flex items-center space-x-3 min-w-0">
                              {member.photoURL ? (
                                <img src={member.photoURL} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  <UserIcon className="h-4 w-4 text-gray-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{member.displayName}</p>
                                <p className="text-xs text-gray-500 truncate">@{member.username}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddMember(member.uid)}
                              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 font-medium flex-shrink-0 transition-colors"
                            >
                              {t('add')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {displayedMembers.map(member => (
                    <div key={member.uid} className="flex items-center p-4 hover:bg-gray-50 transition-colors">
                      <div className="relative">
                        {member.photoURL ? (
                          <img src={member.photoURL} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <UserIcon className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                        {member.isOnline && member.showOnlineStatus !== false && !member.restrictedUsers?.includes(user?.uid) && !member.blockedUsers?.includes(user?.uid) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="ms-3 flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.displayName}</p>
                        <p className="text-xs text-gray-500 truncate">@{member.username}</p>
                      </div>
                      <div className="ms-2 flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${member.uid === channelCreatedBy ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                          {member.uid === channelCreatedBy ? t('admin') : t('member')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                <button className="w-full text-start px-4 py-4 text-sm text-gray-700 hover:bg-gray-50 flex items-center transition-colors" onClick={() => alert(t('disappearingMessages') + ' coming soon!')}>
                  <Clock className="h-5 w-5 me-3 text-gray-400" />
                  {t('disappearingMessages')}
                </button>
                <button 
                  className={`w-full text-start px-4 py-4 text-sm hover:bg-gray-50 flex items-center transition-colors ${isMuted ? 'text-blue-600' : 'text-gray-700'}`} 
                  onClick={toggleMute}
                >
                  <BellOff className="h-5 w-5 me-3 text-gray-400" />
                  {isMuted ? t('unmuteNotifications') : t('muteNotifications')}
                </button>
                {channelType === 'dm' && otherMemberUid && (
                  <>
                    <button 
                      className={`w-full text-start px-4 py-4 text-sm hover:bg-gray-50 flex items-center transition-colors ${isOtherUserBlocked ? 'text-blue-600' : 'text-gray-700'}`} 
                      onClick={() => handleBlockUser(otherMemberUid)}
                    >
                      <Ban className="h-5 w-5 me-3 text-gray-400" />
                      {isOtherUserBlocked ? t('unblock') : t('block')}
                    </button>
                    <button 
                      className={`w-full text-start px-4 py-4 text-sm hover:bg-gray-50 flex items-center transition-colors ${isOtherUserRestricted ? 'text-blue-600' : 'text-gray-700'}`} 
                      onClick={() => handleRestrictUser(otherMemberUid)}
                    >
                      <ShieldAlert className="h-5 w-5 me-3 text-gray-400" />
                      {isOtherUserRestricted ? t('unrestrict') : t('restrict')}
                    </button>
                  </>
                )}
                <button className="w-full text-start px-4 py-4 text-sm text-gray-700 hover:bg-gray-50 flex items-center transition-colors" onClick={() => alert(t('report') + '!')}>
                  <Flag className="h-5 w-5 me-3 text-gray-400" />
                  {t('report')}
                </button>
                {canDeleteChannel && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full text-start px-4 py-4 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors font-medium"
                  >
                    <Trash2 className="h-5 w-5 me-3 text-red-500" />
                    {t('deleteChat')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="h-16 flex items-center px-4 sm:px-6 border-b border-gray-200 shadow-sm bg-white z-10 flex-shrink-0 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setShowSettingsPage(true)}>
            {onBack && (
              <button
                onClick={(e) => { e.stopPropagation(); onBack(); }}
                className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-200 transition-colors me-2"
                title={t('back')}
              >
                {['ar', 'fa', 'ur', 'he'].includes(language) ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
              </button>
            )}
            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center me-3 overflow-hidden flex-shrink-0">
              {channelType === 'dm' && otherUser?.photoURL ? (
                <img src={otherUser.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-full w-full bg-gray-100 flex items-center justify-center">
                  {channelType === 'dm' ? <UserIcon className="h-5 w-5 text-gray-400" /> : <Users className="h-5 w-5 text-gray-400" />}
                </div>
              )}
            </div>
            <div className="flex flex-col relative">
              <div className="flex items-center">
                <h2 className="text-lg font-bold text-gray-900 truncate">{channelName}</h2>
                {channelType === 'dm' && (() => {
                  const otherUid = channelMembers.find(m => m !== user?.uid);
                  const otherUser = allAvailableUsers.find(u => u.uid === otherUid);
                  const isRestricted = otherUser?.restrictedUsers?.includes(user?.uid);
                  const isBlocked = otherUser?.blockedUsers?.includes(user?.uid);
                  if (otherUser?.isOnline && otherUser?.showOnlineStatus !== false && !isRestricted && !isBlocked) {
                    return <div className="w-2 h-2 bg-green-500 rounded-full ms-2" title={t('online')}></div>;
                  }
                  return null;
                })()}
              </div>
              {channelType !== 'dm' && (
                <span className="text-xs text-gray-500">{displayedMembers.length} {t('members')}</span>
              )}
            </div>
            <div className="ms-auto">
              <button
                className="p-2 rounded-md text-gray-500 hover:bg-gray-200 transition-colors"
                title={t('chatSettings')}
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col">
        {messages.map((message, index) => {
          const isMe = message.senderId === user?.uid;
          const showHeader = index === 0 || messages[index - 1].senderId !== message.senderId || 
            (message.createdAt?.toMillis() - messages[index - 1].createdAt?.toMillis() > 5 * 60 * 1000);

          const nextMessage = messages[index + 1];
          const isNextSameSender = nextMessage && nextMessage.senderId === message.senderId;
          const timeDiffNext = nextMessage ? (nextMessage.createdAt?.toMillis() - message.createdAt?.toMillis()) : Infinity;
          const showTime = !isNextSameSender || timeDiffNext > 5 * 60 * 1000;
          
          const isRead = channelReadBy.some(id => id !== user?.uid);
          const isOnlyImage = message.imageUrl && !message.text && !message.audioUrl && !message.replyToId;

          const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

          return (
            <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group relative ${index === 0 ? 'mt-0' : showHeader ? 'mt-4' : 'mt-1'}`}>
              {!isMe && showHeader && (
                <div className="flex-shrink-0 ms-3 mt-1">
                  {message.senderPhotoURL ? (
                    <img className="h-8 w-8 rounded-full object-cover" src={message.senderPhotoURL} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                </div>
              )}
              {!isMe && !showHeader && <div className="w-8 ms-3 flex-shrink-0"></div>}
              
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                {!isMe && showHeader && (
                  <span className="text-xs text-gray-500 mb-1 ms-1">{message.senderName}</span>
                )}
                <div className="flex items-center relative">
                  {!isMe && (
                    <div className="w-8"></div>
                  )}
                  <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                    {message.imageUrl && (
                      <div 
                        className="relative select-none cursor-pointer"
                        onDoubleClick={() => handleDoubleClick(message.id)}
                        onContextMenu={(e) => handleContextMenu(e, message)}
                        onTouchStart={(e) => handleTouchStart(e, message)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchMove}
                      >
                        <img src={message.imageUrl} alt="Uploaded" className="max-w-full h-auto max-h-64 object-contain rounded-2xl" />
                        {isOnlyImage && message.reactions && Object.keys(message.reactions).length > 0 && (
                          <div className={`absolute -bottom-3 ${isMe ? 'end-2' : 'start-2'} flex space-x-1 bg-white shadow-sm border border-gray-200 rounded-full px-1.5 py-0.5 z-10`}>
                            {Object.entries(
                              Object.values(message.reactions).reduce((acc: Record<string, number>, emoji: string) => {
                                acc[emoji] = (acc[emoji] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([emoji, count]) => (
                              <span key={emoji} className="text-xs flex items-center">
                                {emoji} <span className="text-[10px] text-gray-500 ms-0.5">{count}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {(message.text || message.audioUrl || message.replyToId) && (
                      <div 
                        className={`px-4 py-2 rounded-2xl relative select-none cursor-pointer ${isMe ? 'bg-blue-600 text-white rounded-se-sm' : 'bg-gray-100 text-gray-900 rounded-ss-sm'}`}
                        onDoubleClick={() => handleDoubleClick(message.id)}
                        onContextMenu={(e) => handleContextMenu(e, message)}
                        onTouchStart={(e) => handleTouchStart(e, message)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchMove}
                      >
                        {message.replyToId && (
                          <div className={`mb-2 p-2 rounded text-sm opacity-90 border-e-2 ${isMe ? 'bg-blue-700 border-blue-300' : 'bg-gray-200 border-gray-400'}`}>
                            <div className="font-semibold text-xs mb-0.5">{message.replyToName}</div>
                            <div className="truncate">{message.replyToText}</div>
                          </div>
                        )}
                        {message.audioUrl && (
                          <WaveformPlayer audioUrl={message.audioUrl} isMe={isMe} />
                        )}
                        {message.text && (
                          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                            {renderMessageText(message.text)}
                          </p>
                        )}
                        
                        {/* Reactions Display */}
                        {!isOnlyImage && message.reactions && Object.keys(message.reactions).length > 0 && (
                          <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} flex space-x-1 bg-white shadow-sm border border-gray-200 rounded-full px-1.5 py-0.5 z-10`}>
                            {Object.entries(
                              Object.values(message.reactions).reduce((acc: Record<string, number>, emoji: string) => {
                                acc[emoji] = (acc[emoji] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([emoji, count]) => (
                              <span key={emoji} className="text-xs flex items-center">
                                {emoji} <span className="text-[10px] text-gray-500 ml-0.5">{count}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {showTime && (
                  <span className={`text-[11px] text-gray-400 mt-1 flex items-center ${isMe ? 'ml-1' : 'mr-1'}`}>
                    {formatMessageTime(message.createdAt)}
                    {message.isEdited && <span className="mr-1">(معدلة)</span>}
                    {isMe && (
                      <span className="ml-1">
                        {isRead ? <CheckCheck className="w-3.5 h-3.5 text-blue-500" /> : <Check className="w-3.5 h-3.5 text-gray-400" />}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {channelType === 'dm' && channelStatus === 'pending' && channelCreatedBy !== user?.uid ? (
        <div className="p-4 bg-white border-t border-gray-200 flex flex-col items-center justify-center space-y-3">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">{channelName}</span> يريد التحدث معك.
          </p>
          <div className="flex space-x-3">
            <button onClick={handleAcceptDM} className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              قبول
            </button>
            <button onClick={handleDeleteChannel} className="px-6 py-2 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              رفض
            </button>
          </div>
        </div>
      ) : channelType === 'dm' && channelStatus === 'pending' && channelCreatedBy === user?.uid ? (
        <div className="p-4 bg-white border-t border-gray-200 flex flex-col items-center justify-center">
          <p className="text-sm text-gray-500">في انتظار قبول {channelName} لطلبك...</p>
        </div>
      ) : isOtherUserRestricted ? (
        <div className="p-4 bg-white border-t border-gray-200 flex flex-col items-center justify-center space-y-3">
          <p className="text-sm text-gray-600">
            لقد قمت بتقييد <span className="font-semibold">{channelName}</span>. لن تظهر رسائله في صندوق الوارد الرئيسي.
          </p>
          <button 
            onClick={() => handleRestrictUser(otherMemberUid!)} 
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            إلغاء التقييد
          </button>
        </div>
      ) : isBlockedByOther ? (
        <div className="p-4 text-center text-gray-500 text-sm bg-gray-50 border-t border-gray-200">
          لا يمكنك إرسال رسائل لهذا المستخدم.
        </div>
      ) : (
        <div className="p-4 bg-white border-t border-gray-200 flex flex-col">
          {selectedImage && (
            <div className="relative self-start mb-3">
              <img src={selectedImage} alt="Preview" className="h-32 w-auto object-contain rounded-lg border border-gray-200 shadow-sm" />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-md text-gray-600 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {(replyingTo || editingMessage) && (
            <div className="bg-gray-50 px-4 py-2 text-sm flex justify-between items-center border border-gray-200 rounded-t-lg mb-[-1px] z-10">
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-blue-600 text-xs">
                  {editingMessage ? 'تعديل الرسالة' : `الرد على ${replyingTo?.senderName}`}
                </span>
                <span className="text-gray-500 truncate text-xs mt-0.5">
                  {editingMessage ? editingMessage.text : (replyingTo?.text || (replyingTo?.imageUrl ? 'صورة' : 'مقطع صوتي'))}
                </span>
              </div>
              <button type="button" onClick={() => { setReplyingTo(null); setEditingMessage(null); setNewMessage(''); }} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-end space-x-2 relative z-20">
            <div className={`flex-1 bg-gray-50 border border-gray-300 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden flex items-center pr-2 ${replyingTo || editingMessage ? 'rounded-b-lg rounded-tr-lg' : 'rounded-lg'}`}>
              {isRecording ? (
                <div className="flex-1 flex items-center px-4 py-3 text-red-500 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-sm font-medium">جاري تسجيل رسالة صوتية...</span>
                </div>
              ) : isUploading ? (
                <div className="flex-1 flex items-center px-4 py-3 text-blue-500 animate-pulse">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span className="text-sm font-medium">جاري الإرسال...</span>
                </div>
              ) : (
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder={channelType === 'dm' ? `Message @${channelName}` : `Message ${channelName}`}
                  className="block w-full py-3 px-4 resize-none bg-transparent border-0 focus:ring-0 sm:text-sm max-h-32"
                  rows={1}
                  style={{ minHeight: '44px' }}
                />
              )}
              
              <div className="flex items-center space-x-1 flex-shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                {!isRecording && !isUploading && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50"
                    title="Attach Image"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                )}
                
                {(!newMessage.trim() && !isUploading && !isRecording) && (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="p-2 rounded-full transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                    title="Record Audio"
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center justify-center p-3 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0"
                title="Send Audio"
              >
                <Send className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!newMessage.trim() && !selectedImage) || isUploading}
                className="inline-flex items-center justify-center p-3 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="h-5 w-5" />
              </button>
            )}
          </form>
        </div>
      )}
            </div>
          </div>
        </>
      )}
      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-2 w-48"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 200),
              left: Math.min(contextMenu.x, window.innerWidth - 200)
            }}
          >
            <div className="flex justify-between px-3 py-2 border-b border-gray-100">
              {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                <button key={emoji} onClick={() => { handleReaction(contextMenu.message.id, emoji); setContextMenu(null); }} className="hover:scale-125 transition-transform text-lg">
                  {emoji}
                </button>
              ))}
            </div>
            <button onClick={() => { setReplyingTo(contextMenu.message); setEditingMessage(null); setContextMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-end">
              رد علي الرسالة <Reply className="w-4 h-4 ml-2" />
            </button>
            {contextMenu.message.senderId === user?.uid && contextMenu.message.text && (
              <button onClick={() => { setEditingMessage(contextMenu.message); setReplyingTo(null); setNewMessage(contextMenu.message.text!); setContextMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-end">
                تعديلها <Edit2 className="w-4 h-4 ml-2" />
              </button>
            )}
            {contextMenu.message.senderId === user?.uid && (
              <button onClick={() => { handleDeleteMessage(contextMenu.message.id); setContextMenu(null); }} className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center justify-end">
                حذف الرسالة <Trash2 className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Group</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this group? This action cannot be undone and all messages will be lost.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChannel}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
