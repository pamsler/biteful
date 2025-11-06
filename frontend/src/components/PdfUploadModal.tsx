import { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react';
import { pdfRecipesApi, ParsePDFResponse } from '../api/pdf-recipes';

interface PdfUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (parsedRecipe: ParsePDFResponse) => void;
}

export function PdfUploadModal({ isOpen, onClose, onSuccess }: PdfUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        setError('Nur PDF-Dateien sind erlaubt');
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('Datei zu groß (max. 10MB)');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const result = await pdfRecipesApi.parsePDF(selectedFile);
      onSuccess(result);
      handleClose();
    } catch (err: any) {
      console.error('PDF Upload Error:', err);

      // Prüfe ob es ein Duplikat ist
      const errorData = err.response?.data;
      if (errorData?.error === 'PDF bereits verarbeitet') {
        setError(`🔄 PDF bereits hochgeladen!\n\n${errorData.details || 'Diese Datei wurde bereits verarbeitet.'}`);
      } else {
        setError(
          errorData?.details ||
          errorData?.error ||
          err.message ||
          'Fehler beim Verarbeiten der PDF'
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setError(null);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      if (file.size > 10 * 1024 * 1024) {
        setError('Datei zu groß (max. 10MB)');
        return;
      }
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Nur PDF-Dateien sind erlaubt');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  PDF Rezept hochladen
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Lade ein Rezept als PDF hoch
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              disabled={uploading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                selectedFile
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400'
              }`}
            >
              {selectedFile ? (
                <div className="space-y-3">
                  <FileText className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                    disabled={uploading}
                  >
                    Andere Datei wählen
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-gray-700 dark:text-gray-300 font-medium">
                      PDF hier ablegen oder
                    </p>
                    <label className="inline-block mt-2">
                      <span className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer inline-flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Datei auswählen
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Max. 10MB • PDF-Format
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    Fehler
                  </p>
                  <div className="text-sm text-red-700 dark:text-red-400 mt-1 whitespace-pre-line">
                    {error}
                  </div>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Hinweis:</strong> Das Rezept wird automatisch ausgelesen.
                Du kannst die Daten vor dem Speichern noch überprüfen und anpassen.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
              disabled={uploading}
            >
              Abbrechen
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verarbeite PDF...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Hochladen & Auslesen
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
