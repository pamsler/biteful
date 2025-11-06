import { useState } from 'react';
import { Users, Shield, Mail, Bot, Brain } from 'lucide-react';
import { Layout } from '../components/Layout';
import { UserManagement } from './UserManagement';
import { SSOSettings } from './SSOSettings';
import { SMTPSettings } from './SMTPSettings';
import { AISettings } from './AISettings';
import { LearningStatus } from './LearningStatus';
import { useTranslation } from 'react-i18next';

type Tab = 'users' | 'sso' | 'smtp' | 'ai' | 'learning';

export const Settings = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const tabs = [
    { id: 'users' as Tab, label: t('settings.users'), icon: Users },
    { id: 'sso' as Tab, label: t('settings.sso'), icon: Shield },
    { id: 'smtp' as Tab, label: t('settings.smtp'), icon: Mail },
    { id: 'ai' as Tab, label: t('settings.ai'), icon: Bot },
    { id: 'learning' as Tab, label: 'PDF Learning', icon: Brain },
  ];

  return (
    <Layout title={t('settings.title')}>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1">
        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-t-2xl shadow-lg border-b-2 border-gray-200 dark:border-gray-700 transition-colors overflow-hidden">
          <nav className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-2 py-3 sm:py-4 px-4 sm:px-6 border-b-4 font-semibold text-sm sm:text-base transition whitespace-nowrap flex-1 sm:flex-initial ${
                    activeTab === tab.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <Icon size={20} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-b-xl sm:rounded-b-2xl shadow-lg p-4 sm:p-6 transition-colors mb-6 border border-gray-100 dark:border-gray-700">
          <div className="animate-fadeIn">
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'sso' && <SSOSettings />}
            {activeTab === 'smtp' && <SMTPSettings />}
            {activeTab === 'ai' && <AISettings />}
            {activeTab === 'learning' && <LearningStatus />}
          </div>
        </div>
      </main>
    </Layout>
  );
};
