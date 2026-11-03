import React, { useEffect, useState } from 'react';
import { X, Calendar, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

export interface LightboxPhotoItem {
  photo_url: string;
  caption?: string;
  upload_date?: string;
  stage_badge?: string;
}

interface PhotoLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl?: string | null;
  caption?: string;
  uploadDate?: string;
  stageBadge?: string;
  photos?: LightboxPhotoItem[];
  initialIndex?: number;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  onClose,
  photoUrl,
  caption,
  uploadDate,
  stageBadge,
  photos,
  initialIndex = 0,
}) => {
  const gallery: LightboxPhotoItem[] =
    photos && photos.length > 0
      ? photos
      : photoUrl
      ? [
          {
            photo_url: photoUrl,
            caption,
            upload_date: uploadDate,
            stage_badge: stageBadge,
          },
        ]
      : [];

  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(
        Math.min(Math.max(0, initialIndex), Math.max(0, gallery.length - 1))
      );
    }
  }, [isOpen, initialIndex, gallery.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && gallery.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
      } else if (e.key === 'ArrowRight' && gallery.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % gallery.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, gallery.length]);

  if (!isOpen || gallery.length === 0) return null;

  const activePhoto = gallery[currentIndex] || gallery[0];
  const activeDate = activePhoto.upload_date;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/90 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full max-h-[92vh] flex flex-col bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-950/95 border-b border-zinc-800/80 text-white z-10">
          <div className="flex items-center gap-3 flex-wrap">
            {gallery.length > 1 && (
              <span className="text-xs font-mono text-zinc-400">
                {currentIndex + 1} / {gallery.length}
              </span>
            )}
            {activePhoto.stage_badge && (
              <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {activePhoto.stage_badge}
              </span>
            )}
            {activeDate && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                {activeDate.includes('T')
                  ? formatDate(activeDate.slice(0, 10))
                  : formatDate(activeDate)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={activePhoto.photo_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Open full resolution in new tab"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="relative flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 bg-zinc-950/60 min-h-[300px]">
          {gallery.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((prev) => (prev - 1 + gallery.length) % gallery.length)
              }
              className="absolute left-3 sm:left-5 p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/80 transition-colors z-10"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <img
            src={activePhoto.photo_url}
            alt={activePhoto.caption || 'Project progress photograph'}
            className="max-h-[72vh] w-auto max-w-full object-contain rounded shadow-lg"
          />

          {gallery.length > 1 && (
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => (prev + 1) % gallery.length)}
              className="absolute right-3 sm:right-5 p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700/80 transition-colors z-10"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Caption bar */}
        {activePhoto.caption && (
          <div className="px-5 py-3.5 bg-zinc-950/95 border-t border-zinc-800/80 text-xs text-zinc-300 leading-relaxed">
            <p className="font-medium text-zinc-100">{activePhoto.caption}</p>
          </div>
        )}
      </div>
    </div>
  );
};
