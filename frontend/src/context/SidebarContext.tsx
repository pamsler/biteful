import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  isPinned: boolean;
  toggleSidebar: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  togglePin: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // State aus localStorage laden oder Defaults verwenden
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar-open');
    return saved ? JSON.parse(saved) : false;
  });

  const [isPinned, setIsPinned] = useState(() => {
    const saved = localStorage.getItem('sidebar-pinned');
    // Auf Desktop standardmäßig gepinnt, auf Mobile nicht
    const defaultPinned = window.innerWidth >= 1024;
    return saved ? JSON.parse(saved) : defaultPinned;
  });

  // State in localStorage speichern
  useEffect(() => {
    localStorage.setItem('sidebar-open', JSON.stringify(isOpen));
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('sidebar-pinned', JSON.stringify(isPinned));
  }, [isPinned]);

  // Wenn Sidebar gepinnt ist, automatisch öffnen
  useEffect(() => {
    if (isPinned) {
      setIsOpen(true);
    }
  }, [isPinned]);

  const toggleSidebar = () => {
    setIsOpen((prev: boolean) => !prev);
  };

  const openSidebar = () => {
    setIsOpen(true);
  };

  const closeSidebar = () => {
    if (!isPinned) {
      setIsOpen(false);
    }
  };

  const togglePin = () => {
    setIsPinned((prev: boolean) => !prev);
  };

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isPinned,
        toggleSidebar,
        openSidebar,
        closeSidebar,
        togglePin,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
