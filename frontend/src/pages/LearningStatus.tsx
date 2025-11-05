import { useEffect, useState, useRef } from 'react';
import { Brain, TrendingUp, FileCheck, Zap, Upload, X, BookOpen, Database, ChevronRight } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface ReadinessData {
  percentage: number;
  level: 'training' | 'basic' | 'good' | 'excellent';
  count: number;
  toBasic: number;
  toGood: number;
  toExcellent: number;
  milestones: {
    basic: number;
    good: number;
    excellent: number;
  };
}

interface LearningStats {
  id: number;
  total_pdfs_trained: number;
  ai_assisted_count: number;
  autonomous_count: number;
  average_confidence: number;
  learning_phase: 'training' | 'hybrid' | 'autonomous';
  last_pattern_update: string | null;
  created_at: string;
  updated_at: string;
  progress: number;
  next_phase_at: number | null;
  pdf_count: number;
  epub_count: number;
  readiness?: ReadinessData;
}

interface FailedFile {
  filename: string;
  reason: string;
  message: string;
}

interface TrainingSession {
  id: number;
  total_files: number;
  processed_files: number;
  failed_files: number;
  status: 'running' | 'completed' | 'failed';
  recipesFound?: number;
  error_details?: FailedFile[];
}

interface TrainingDataItem {
  id: number;
  filename: string;
  source: string;
  confidence: number;
  createdAt: string;
  fileSize: number;
  fileType: string;
}

export const LearningStatus = () => {
  const { showToast } = useToast();
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [trainingSession, setTrainingSession] = useState<TrainingSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kochbuch Upload
  const [cookbookFile, setCookbookFile] = useState<File | null>(null);
  const [uploadingCookbook, setUploadingCookbook] = useState(false);
  const [cookbookSession, setCookbookSession] = useState<TrainingSession & { recipesFound?: number } | null>(null);
  const cookbookInputRef = useRef<HTMLInputElement>(null);

  // Trainingsdaten
  const [trainingData, setTrainingData] = useState<TrainingDataItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [showTrainingData, setShowTrainingData] = useState(false);

  useEffect(() => {
    fetchLearningStats();
  }, []);

  const fetchLearningStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pdf-recipes/learning-stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Lernstatistiken');
      }

      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching learning stats:', err);
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
      setSelectedFiles(prev => [...prev, ...pdfFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('pdfs', file);
      });

      const response = await fetch('/api/pdf-recipes/bulk-train', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Upload fehlgeschlagen');
      }

      const data = await response.json();
      setTrainingSession({
        id: data.sessionId,
        total_files: data.totalFiles,
        processed_files: 0,
        failed_files: 0,
        status: 'running',
      });

      // Starte Polling für Session-Status
      pollSessionStatus(data.sessionId);

      setSelectedFiles([]);
    } catch (err) {
      console.error('Bulk upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  const pollSessionStatus = async (sessionId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/pdf-recipes/training-session/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          const session = await response.json();
          setTrainingSession(session);

          if (session.status === 'completed' || session.status === 'failed') {
            clearInterval(interval);
            // Aktualisiere Stats nach Abschluss
            fetchLearningStats();
          }
        }
      } catch (err) {
        console.error('Error polling session:', err);
      }
    }, 2000); // Alle 2 Sekunden prüfen
  };

  const handleCookbookSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'application/epub+zip', 'application/epub', 'application/x-epub+zip'];
      const allowedExtensions = ['.pdf', '.epub'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      if (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)) {
        setCookbookFile(file);
      } else {
        setError('Nur PDF- und EPUB-Dateien sind erlaubt');
      }
    }
  };

  const handleCookbookUpload = async () => {
    if (!cookbookFile) return;

    try {
      setUploadingCookbook(true);
      setError(null);

      const formData = new FormData();
      formData.append('pdf', cookbookFile);

      const response = await fetch('/api/pdf-recipes/parse-cookbook', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Upload fehlgeschlagen');
      }

      const data = await response.json();
      setCookbookSession({
        id: data.sessionId,
        total_files: data.recipesFound,
        processed_files: 0,
        failed_files: 0,
        status: 'running',
        recipesFound: data.recipesFound,
      });

      // Starte Polling für Session-Status
      pollCookbookStatus(data.sessionId);

      setCookbookFile(null);
    } catch (err) {
      console.error('Cookbook upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploadingCookbook(false);
    }
  };

  const pollCookbookStatus = async (sessionId: number) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/pdf-recipes/training-session/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          const session = await response.json();
          setCookbookSession(prev => ({ ...prev!, ...session }));

          if (session.status === 'completed' || session.status === 'failed') {
            clearInterval(interval);
            fetchLearningStats();
          }
        }
      } catch (err) {
        console.error('Error polling cookbook session:', err);
      }
    }, 2000);
  };

  const fetchTrainingData = async () => {
    try {
      setLoadingData(true);
      const response = await fetch('/api/pdf-recipes/training-data?limit=100', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setTrainingData(result.data);
      }
    } catch (err) {
      console.error('Error fetching training data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const toggleTrainingData = () => {
    if (!showTrainingData && trainingData.length === 0) {
      fetchTrainingData();
    }
    setShowTrainingData(!showTrainingData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Rezept Learning System
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Je mehr Rezepte das System verarbeitet, desto intelligenter wird die Erkennung
          </p>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* PDFs */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <FileCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              📄 PDFs
            </h4>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.pdf_count || 0}
          </p>
        </div>

        {/* EPUBs */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              📚 EPUBs
            </h4>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.epub_count || 0}
          </p>
        </div>

        {/* AI Assisted */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              AI-Unterstützt
            </h4>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.ai_assisted_count}
          </p>
        </div>

        {/* Autonomous */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Autonom
            </h4>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.autonomous_count}
          </p>
        </div>

        {/* Average Confidence */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Ø Konfidenz
            </h4>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.average_confidence.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Autonomy Readiness */}
      {stats.readiness && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-7 h-7 text-purple-600 dark:text-purple-400" />
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Autonomie-Readiness
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Fortschritt zum vollständig autonomen System
              </p>
            </div>
          </div>

          {/* Overall Readiness */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Gesamt-Readiness
              </span>
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.readiness.percentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500 ease-out"
                style={{ width: `${stats.readiness.percentage}%` }}
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  stats.readiness.level === 'excellent'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : stats.readiness.level === 'good'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : stats.readiness.level === 'basic'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {stats.readiness.level === 'excellent' && '🎉 Excellent'}
                {stats.readiness.level === 'good' && '✨ Good'}
                {stats.readiness.level === 'basic' && '🚀 Basic'}
                {stats.readiness.level === 'training' && '📚 Training'}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {stats.total_pdfs_trained} / 3000 Rezepte
              </span>
            </div>
          </div>

          {/* Milestone Progress Bars */}
          <div className="space-y-4">
            {/* Basic */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    🚀 Basic Autonomy
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    (500 Rezepte)
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    stats.readiness.toBasic >= 100
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {stats.readiness.toBasic}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    stats.readiness.toBasic >= 100 ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                  style={{ width: `${Math.min(stats.readiness.toBasic, 100)}%` }}
                />
              </div>
              {stats.readiness.toBasic < 100 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Noch {stats.readiness.milestones.basic - stats.total_pdfs_trained} Rezepte
                </p>
              )}
            </div>

            {/* Good */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ✨ Good Autonomy
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    (1500 Rezepte)
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    stats.readiness.toGood >= 100
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {stats.readiness.toGood}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    stats.readiness.toGood >= 100 ? 'bg-blue-500' : 'bg-blue-300'
                  }`}
                  style={{ width: `${Math.min(stats.readiness.toGood, 100)}%` }}
                />
              </div>
              {stats.readiness.toGood < 100 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Noch {stats.readiness.milestones.good - stats.total_pdfs_trained} Rezepte
                </p>
              )}
            </div>

            {/* Excellent */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    🎉 Excellent Autonomy
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    (3000 Rezepte)
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    stats.readiness.toExcellent >= 100
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {stats.readiness.toExcellent}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    stats.readiness.toExcellent >= 100 ? 'bg-purple-500' : 'bg-purple-300'
                  }`}
                  style={{ width: `${Math.min(stats.readiness.toExcellent, 100)}%` }}
                />
              </div>
              {stats.readiness.toExcellent < 100 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Noch {stats.readiness.milestones.excellent - stats.total_pdfs_trained} Rezepte
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Smart Hybrid System Erklärung */}
      <div className="bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Smart Hybrid System - Wie funktioniert's?
        </h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
              1
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Simple Parser zuerst
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                System versucht mit einfachem Regex-Parser die Rezeptstruktur zu erkennen.
                Schnell und kostenlos!
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center text-yellow-600 dark:text-yellow-400 font-bold text-sm">
              2
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Confidence-Check (Schwelle: 60%)
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                System bewertet wie sicher die Erkennung ist. Bei Confidence {'<'} 60% wird AI-Hilfe benötigt.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-sm">
              3
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                AI-Fallback bei Bedarf
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bei niedriger Confidence nutzt das System Claude/OpenAI zur Verbesserung.
                Das Ergebnis wird als Trainingsbeispiel gespeichert.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-sm">
              ∞
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Kontinuierliches Lernen
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Je mehr Rezepte trainiert werden (500 → 1500 → 3000), desto intelligenter wird der
                Simple Parser und desto seltener wird AI benötigt. Ziel: Vollständige Autonomie!
              </p>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="mt-6 pt-6 border-t border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            Autonomie-Milestones
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
              <div className="text-2xl mb-1">🚀</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-white">
                Basic (500 Rezepte)
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Grundlegende autonome Erkennung
              </div>
            </div>
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
              <div className="text-2xl mb-1">✨</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-white">
                Good (1500 Rezepte)
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Sehr gute Erkennung, wenig AI
              </div>
            </div>
            <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3">
              <div className="text-2xl mb-1">🎉</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-white">
                Excellent (3000 Rezepte)
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Nahezu perfekte Autonomie
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Training Upload */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Bulk Training
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Lade mehrere Rezepte gleichzeitig hoch (PDF oder EPUB), um dem System zu helfen, Muster zu erkennen
            </p>
          </div>
        </div>

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload Button */}
        {selectedFiles.length === 0 && !trainingSession && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5" />
            PDFs auswählen
          </button>
        )}

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="max-h-60 overflow-y-auto space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileCheck className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                    <span className="text-sm text-gray-900 dark:text-white truncate">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                Weitere hinzufügen
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={uploading}
                className="flex-1 py-2 px-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Wird hochgeladen...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {selectedFiles.length} PDF(s) hochladen
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Training Progress */}
        {trainingSession && (
          <div className="mt-4 space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Training läuft...
                </span>
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  {trainingSession.processed_files} / {trainingSession.total_files}
                </span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-full transition-all duration-300"
                  style={{
                    width: `${(trainingSession.processed_files / trainingSession.total_files) * 100}%`
                  }}
                />
              </div>
              {trainingSession.failed_files > 0 && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
                    ⚠️ {trainingSession.failed_files} Datei(en) fehlgeschlagen
                  </p>
                  {trainingSession.error_details && trainingSession.error_details.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {trainingSession.error_details.map((error, idx) => (
                        <div key={idx} className="bg-white/50 dark:bg-gray-800/50 rounded p-2">
                          <p className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <FileCheck className="w-3 h-3 flex-shrink-0" />
                            {error.filename}
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-1 ml-5">
                            {error.reason === 'duplicate' && '🔄 '}
                            {error.reason === 'error' && '❌ '}
                            {error.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {trainingSession.status === 'completed' && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-semibold">
                  ✓ Training abgeschlossen!
                </p>
              )}
            </div>
            {trainingSession.status === 'completed' && (
              <button
                onClick={() => setTrainingSession(null)}
                className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
              >
                Neues Training starten
              </button>
            )}
          </div>
        )}

        <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Hinweis:</strong> Bulk-Training benötigt aktivierte AI-Einstellungen (Claude oder OpenAI).
            Max. 50 PDFs pro Upload, max. 10MB pro Datei.
          </p>
        </div>
      </div>

      {/* Kochbuch Upload */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Kochbuch parsen (PDF / EPUB)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Lade ein komplettes Kochbuch hoch - System erkennt automatisch alle Rezepte
            </p>
          </div>
        </div>

        {/* File Input */}
        <input
          ref={cookbookInputRef}
          type="file"
          accept="application/pdf,.pdf,application/epub+zip,.epub"
          onChange={handleCookbookSelect}
          className="hidden"
        />

        {/* Upload Area */}
        {!cookbookFile && !cookbookSession && (
          <div
            onClick={() => cookbookInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-purple-500 dark:hover:border-purple-400 transition-colors cursor-pointer"
          >
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
            <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
              Kochbuch auswählen (PDF oder EPUB)
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              System erkennt automatisch alle Rezepte im Buch
            </p>
          </div>
        )}

        {/* Selected Cookbook */}
        {cookbookFile && !cookbookSession && (
          <div className="space-y-3">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {cookbookFile.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(cookbookFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCookbookFile(null)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <button
              onClick={handleCookbookUpload}
              disabled={uploadingCookbook}
              className="w-full py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploadingCookbook ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Analysiere Kochbuch...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Kochbuch hochladen & parsen
                </>
              )}
            </button>
          </div>
        )}

        {/* Cookbook Parsing Progress */}
        {cookbookSession && (
          <div className="space-y-3">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                    {cookbookSession.recipesFound} Rezepte erkannt
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Verarbeite Rezepte...
                  </p>
                </div>
                <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                  {cookbookSession.processed_files} / {cookbookSession.total_files}
                </span>
              </div>
              <div className="w-full bg-purple-200 dark:bg-purple-900 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 dark:bg-purple-400 h-full transition-all duration-300"
                  style={{
                    width: `${(cookbookSession.processed_files / cookbookSession.total_files) * 100}%`
                  }}
                />
              </div>
              {cookbookSession.failed_files > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  {cookbookSession.failed_files} Rezept(e) fehlgeschlagen
                </p>
              )}
              {cookbookSession.status === 'completed' && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-semibold">
                  ✓ Kochbuch verarbeitet!
                </p>
              )}
            </div>
            {cookbookSession.status === 'completed' && (
              <button
                onClick={() => setCookbookSession(null)}
                className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
              >
                Neues Kochbuch hochladen
              </button>
            )}
          </div>
        )}

        <div className="mt-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <p className="text-xs text-purple-800 dark:text-purple-200">
            <strong>Wie funktioniert's:</strong> System erkennt automatisch Rezept-Grenzen (Überschriften, Kapitel)
            und parst jedes Rezept einzeln. Unterstützt PDF und EPUB! Perfekt für komplette Kochbücher mit 10-100+ Rezepten!
          </p>
        </div>
      </div>

      {/* Pattern Training */}
      {stats && stats.total_pdfs_trained >= 10 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Brain className="w-8 h-8 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                🧠 Intelligentes Pattern-Learning
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Das System analysiert deine {stats.total_pdfs_trained} verarbeiteten Rezepte und lernt automatisch Erkennungsmuster.
                Dadurch wird die Rezepterkennung intelligenter - auch ohne AI!
              </p>
              <button
                onClick={async () => {
                  try {
                    setLoading(true);
                    const response = await fetch('/api/pdf-recipes/train-patterns', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                      },
                    });

                    if (response.ok) {
                      const data = await response.json();
                      showToast(data.message, 'success');

                      // Lade Stats neu um neue Phase anzuzeigen
                      await fetchLearningStats();
                    } else {
                      throw new Error('Training fehlgeschlagen');
                    }
                  } catch (error) {
                    showToast('Fehler beim Pattern-Training', 'error');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Brain className="w-5 h-5" />
                {loading ? 'Lerne Patterns...' : 'Patterns jetzt lernen'}
              </button>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
                💡 Tipp: Je mehr Rezepte du trainiert hast, desto besser funktioniert das Pattern-Learning!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trainingsdaten Übersicht */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={toggleTrainingData}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <div className="text-left">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Verarbeitete Trainingsdaten
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {stats?.total_pdfs_trained || 0} Rezepte in der Datenbank
              </p>
            </div>
          </div>
          <ChevronRight
            className={`w-5 h-5 text-gray-400 transition-transform ${
              showTrainingData ? 'rotate-90' : ''
            }`}
          />
        </button>

        {showTrainingData && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            {loadingData ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
              </div>
            ) : trainingData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Noch keine Trainingsdaten vorhanden. Lade dein erstes Rezept hoch!
              </div>
            ) : (
              <div className="space-y-4">
                {/* Statistiken */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3">
                    <p className="text-xs text-teal-700 dark:text-teal-300 mb-1">Claude AI</p>
                    <p className="text-2xl font-bold text-teal-900 dark:text-teal-100">
                      {trainingData.filter(d => d.source === 'ai-claude').length}
                    </p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">OpenAI</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {trainingData.filter(d => d.source === 'ai-openai').length}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <p className="text-xs text-green-700 dark:text-green-300 mb-1">Ø Konfidenz</p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {trainingData.length > 0
                        ? Math.round(
                            trainingData.reduce((sum, d) => sum + d.confidence, 0) / trainingData.length
                          )
                        : 0}%
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-1">📄 PDF</p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {trainingData.filter(d => d.fileType === 'pdf').length}
                    </p>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
                    <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-1">📚 EPUB</p>
                    <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                      {trainingData.filter(d => d.fileType === 'epub').length}
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                    <p className="text-xs text-orange-700 dark:text-orange-300 mb-1">Gesamt</p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {trainingData.length}
                    </p>
                  </div>
                </div>

                {/* Tabelle */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Dateiname
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Typ
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Quelle
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Konfidenz
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          Datum
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {trainingData.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="px-4 py-3 text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <FileCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                              <span className="truncate max-w-xs">{item.filename}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                item.fileType === 'epub'
                                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              }`}
                            >
                              {item.fileType === 'epub' ? '📚 EPUB' : '📄 PDF'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                item.source === 'ai-claude'
                                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                                  : item.source === 'ai-openai'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {item.source}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className={`h-full rounded-full ${
                                    item.confidence >= 80
                                      ? 'bg-green-500'
                                      : item.confidence >= 60
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${item.confidence}%` }}
                                />
                              </div>
                              <span className="text-gray-700 dark:text-gray-300 font-medium text-xs">
                                {Math.round(item.confidence)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                            {new Date(item.createdAt).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {trainingData.length >= 100 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
                    Zeige die letzten 100 Einträge
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
