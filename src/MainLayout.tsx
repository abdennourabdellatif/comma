import React, { useState } from 'react';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import SettingsPage from './SettingsPage';
import { useAuth } from './AuthContext';
import { useTranslation } from './translations';

export default function MainLayout() {
  const { language } = useAuth();
  const { t } = useTranslation(language);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  if (showSettings) {
    return (
      <div className="app-shell flex h-mobile-screen overflow-hidden">
        <SettingsPage onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  return (
    <div className="app-shell flex h-mobile-screen overflow-hidden">
      <div className={`${selectedChannelId ? 'hidden md:flex' : 'flex'} w-full md:w-64 flex-shrink-0`}>
        <Sidebar 
          selectedChannelId={selectedChannelId} 
          onSelectChannel={setSelectedChannelId} 
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>
      <div className={`${selectedChannelId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {selectedChannelId ? (
          <ChatArea channelId={selectedChannelId} onChannelDeleted={() => setSelectedChannelId(null)} onBack={() => setSelectedChannelId(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noChatSelected')}</h3>
              <p className="mt-1 text-sm text-gray-500">{t('selectChatToStart')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
