export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto transition-colors">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Copyright */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>© {currentYear} Wochenplaner</span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              Made with ❤️
            </span>
          </div>

          {/* Right: Description */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            🍴 Wochenplaner für die Essensplanung
          </div>
        </div>
      </div>
    </footer>
  );
}
