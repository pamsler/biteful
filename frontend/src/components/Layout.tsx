import { ReactNode } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { useSidebar } from '../context/SidebarContext';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
}

export function Layout({ children, title, showBackButton = false }: LayoutProps) {
  const { isOpen } = useSidebar();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area - verschiebt sich auf Desktop wenn Sidebar offen ist */}
      <div
        className={`min-h-screen flex flex-col transition-all duration-300 ${
          isOpen ? 'lg:ml-[280px]' : 'ml-0'
        }`}
      >
        {/* TopBar */}
        <TopBar title={title} showBackButton={showBackButton} />

        {/* Page Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
