import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Check,
  Phone,
  Mail,
  Globe,
  ArrowRight,
  Lock,
  AlertCircle,
  Maximize2,
  Camera,
  Compass,
  PenTool,
  Package,
  Hammer,
  Paintbrush,
  Flag,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import { crmRepository } from '@/services/database';
import { PublicClientTrackingData, WORK_STAGES } from '@/types/crm';
import { formatDate } from '@/lib/formatters';
import {
  PhotoLightboxModal,
  LightboxPhotoItem,
} from '@/components/modals/PhotoLightboxModal';

type PortalState = 'loading' | 'ready' | 'invalid_link' | 'revoked_link' | 'error';

// ----------------------------------------------------------------------------
// Visual language: "Midnight Atelier" — warm charcoal + champagne gold,
// editorial serif headlines, blueprint grid, animated progress ring.
// ----------------------------------------------------------------------------
const PORTAL_CSS = `
  .akd-serif { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; letter-spacing: -0.01em; font-variant-numeric: lining-nums; font-feature-settings: 'lnum' 1; }
  .akd-blueprint {
    background-image:
      linear-gradient(rgba(197,160,89,0.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(197,160,89,0.07) 1px, transparent 1px);
    background-size: 44px 44px;
    -webkit-mask-image: radial-gradient(ellipse 80% 90% at 70% 30%, #000 20%, transparent 75%);
            mask-image: radial-gradient(ellipse 80% 90% at 70% 30%, #000 20%, transparent 75%);
  }
  .akd-gold-text {
    background: linear-gradient(100deg, #E9D5A1 0%, #C5A059 45%, #F1DFAE 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .akd-ring-arc { transition: stroke-dashoffset 1.8s cubic-bezier(.22,.8,.24,1) .25s; }
  .akd-reveal { opacity: 0; transform: translateY(20px); transition: opacity .8s ease, transform .8s cubic-bezier(.22,.8,.24,1); }
  .akd-reveal.is-in { opacity: 1; transform: none; }
  @keyframes akd-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  .akd-rise { opacity: 0; animation: akd-rise .9s cubic-bezier(.22,.8,.24,1) forwards; }
  @keyframes akd-pulse-ring { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(1.7); opacity: 0; } }
  .akd-pulse::before {
    content: ''; position: absolute; inset: 0; border-radius: 9999px; pointer-events: none;
    border: 2px solid rgba(197,160,89,.65); animation: akd-pulse-ring 2.2s ease-out infinite;
  }
  @keyframes akd-sheen { from { transform: translateX(-120%); } to { transform: translateX(260%); } }
  .akd-bar-sheen::after {
    content: ''; position: absolute; inset: 0; width: 40%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
    animation: akd-sheen 2.8s ease-in-out infinite 1.6s;
  }
  @keyframes akd-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  .akd-float { animation: akd-float 9s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .akd-reveal, .akd-rise { opacity: 1 !important; transform: none !important; animation: none !important; transition: none !important; }
    .akd-pulse::before, .akd-bar-sheen::after, .akd-float { animation: none !important; }
    .akd-ring-arc { transition: none !important; }
  }
`;

const STAGE_ICONS: Record<string, LucideIcon> = {
  Planning: Compass,
  Design: PenTool,
  'Material Preparation': Package,
  'Work in Progress': Hammer,
  Finishing: Paintbrush,
  Completed: Flag,
};

// Fade-and-rise on scroll
const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.06 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`akd-reveal ${shown ? 'is-in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// Photo mosaic: 1 → cinematic wide, 2 → pair, 3+ → feature tile + supporting tiles
const PhotoMosaic: React.FC<{
  items: Array<{ photo_url: string; caption?: string }>;
  altFallback: string;
  onOpen: (index: number) => void;
}> = ({ items, altFallback, onOpen }) => {
  const n = items.length;
  if (n === 0) return null;

  // 6-column grid on larger screens lets the feature tile and every tail row fill edge-to-edge
  const gridCls =
    n === 1 ? 'grid-cols-1' : n === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-6';

  const tileCls = (i: number): string => {
    if (n === 1) return 'aspect-[16/9]';
    if (n === 2) return 'aspect-[4/3]';
    if (i === 0) return 'col-span-2 aspect-[16/9] sm:col-span-4 sm:row-span-2 sm:aspect-auto';
    const tailCount = (n - 3) % 3; // tiles left over on the last desktop row
    const loneOnMobile = i === n - 1 && (n - 1) % 2 === 1;
    if (n > 3 && tailCount === 1 && i === n - 1) {
      return loneOnMobile
        ? 'col-span-2 aspect-[16/9] sm:col-span-6 sm:aspect-[21/9]'
        : 'sm:col-span-6 aspect-[4/3] sm:aspect-[21/9]';
    }
    if (n > 3 && tailCount === 2 && i >= n - 2) {
      return loneOnMobile
        ? 'col-span-2 aspect-[16/9] sm:col-span-3 sm:aspect-[4/3]'
        : 'sm:col-span-3 aspect-[4/3]';
    }
    return loneOnMobile
      ? 'col-span-2 aspect-[16/9] sm:col-span-2 sm:aspect-[4/3]'
      : 'sm:col-span-2 aspect-[4/3]';
  };

  return (
    <div className={`grid gap-2.5 sm:gap-3 ${gridCls}`}>
      {items.map((photo, i) => (
        <button
          type="button"
          key={`${photo.photo_url}-${i}`}
          onClick={() => onOpen(i)}
          className={`group relative overflow-hidden rounded-xl sm:rounded-2xl bg-[#E9E4D8] ring-1 ring-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B08A3E] ${tileCls(
            i
          )}`}
        >
          <img
            src={photo.photo_url}
            alt={photo.caption || altFallback}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-70 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/45 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-300">
            <Maximize2 className="w-3.5 h-3.5" />
          </span>
          {photo.caption && (
            <span className="absolute left-0 right-0 bottom-0 px-3.5 pb-3 pt-8 text-left text-[11px] sm:text-xs font-medium leading-snug text-white line-clamp-2">
              {photo.caption}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

const StudioMark: React.FC<{ src: string; alt: string; size?: string }> = ({
  src,
  alt,
  size = 'w-11 h-11 sm:w-12 sm:h-12',
}) => (
  <div
    className={`${size} rounded-xl bg-[#1B1A16] p-1.5 flex items-center justify-center shrink-0 ring-1 ring-[#C5A059]/50 shadow-[0_0_24px_-6px_rgba(197,160,89,0.55)]`}
  >
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-contain"
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = 'none';
        if (target.parentElement) {
          target.parentElement.innerHTML =
            '<span class="font-bold text-[#C5A059] text-xs tracking-wider">AKD</span>';
        }
      }}
    />
  </div>
);

export const ClientTrackingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [data, setData] = useState<PublicClientTrackingData | null>(null);
  const [portalState, setPortalState] = useState<PortalState>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ringReady, setRingReady] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhotoItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    async function loadTrackingData() {
      const cleanToken = (token || '').trim();
      if (!cleanToken || cleanToken.length < 12) {
        if (mounted) {
          setPortalState('invalid_link');
          setErrorMsg(
            'The tracking link address is incomplete or invalid. Please check the URL shared with you.'
          );
        }
        return;
      }

      try {
        const tracking = await crmRepository.getPublicProjectTracking(cleanToken);
        if (!mounted) return;
        if (tracking) {
          setData(tracking);
          setPortalState('ready');
        } else {
          setPortalState('revoked_link');
          setErrorMsg(
            'This client tracking link is currently inactive or has been revoked by the studio.'
          );
        }
      } catch (err: any) {
        if (mounted) {
          setPortalState('error');
          setErrorMsg(
            err?.message || 'Unable to load project progress at this moment. Please try again.'
          );
        }
      }
    }

    loadTrackingData();
    return () => {
      mounted = false;
    };
  }, [token]);

  // Kick off the progress-ring draw animation once data is on screen
  useEffect(() => {
    if (portalState !== 'ready') return;
    const t = window.setTimeout(() => setRingReady(true), 120);
    return () => window.clearTimeout(t);
  }, [portalState]);

  // All client-visible photographs flattened for gallery/lightbox
  const allProjectPhotos = useMemo<LightboxPhotoItem[]>(() => {
    if (!data) return [];
    const list: LightboxPhotoItem[] = [];
    for (const upd of data.updates) {
      for (const ph of upd.photos || []) {
        list.push({
          photo_url: ph.photo_url,
          caption: ph.caption,
          upload_date: ph.upload_date || upd.update_date,
          stage_badge: upd.work_stage,
        });
      }
    }
    for (const ph of data.standalone_photos || []) {
      list.push({
        photo_url: ph.photo_url,
        caption: ph.caption,
        upload_date: ph.upload_date,
      });
    }
    return list;
  }, [data]);

  const openLightboxWithGallery = (
    items: LightboxPhotoItem[],
    index: number
  ) => {
    setLightboxPhotos(items);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (portalState === 'loading') {
    return (
      <div className="min-h-screen bg-[#12110E] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <style>{PORTAL_CSS}</style>
        <div className="akd-blueprint absolute inset-0" />
        <div className="relative flex flex-col items-center">
          <div className="relative w-16 h-16 mb-6">
            <span className="absolute inset-0 rounded-full border border-[#C5A059]/25" />
            <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#C5A059] animate-spin" />
            <div className="absolute inset-2.5 rounded-full bg-[#1B1A16] p-2 flex items-center justify-center">
              <img src="/logo.png" alt="AKD Interior" className="w-full h-full object-contain" />
            </div>
          </div>
          <p className="akd-serif text-xl text-[#F3EBD8]">Preparing your project dossier</p>
          <span className="text-xs text-[#9C9482] mt-1.5 tracking-wide">
            Retrieving site progress &amp; photographs
          </span>
        </div>
      </div>
    );
  }

  if (portalState !== 'ready' || !data) {
    const isInvalid = portalState === 'invalid_link';
    const isRevoked = portalState === 'revoked_link';

    return (
      <div className="min-h-screen bg-[#12110E] flex flex-col items-center justify-center p-5 text-center relative overflow-hidden">
        <style>{PORTAL_CSS}</style>
        <div className="akd-blueprint absolute inset-0" />
        <div className="relative max-w-md w-full rounded-3xl p-8 sm:p-10 bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-5 akd-rise">
          <div className="w-14 h-14 rounded-full bg-[#C5A059]/10 text-[#C5A059] mx-auto flex items-center justify-center ring-1 ring-[#C5A059]/40">
            {isRevoked ? <Lock className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C5A059]">
              Client Project Portal
            </p>
            <h1 className="akd-serif text-2xl sm:text-3xl text-[#F3EBD8]">
              {isInvalid
                ? 'Invalid Tracking Link'
                : isRevoked
                ? 'Tracking Link Inactive'
                : 'Unable to Load Project'}
            </h1>
            <p className="text-sm text-[#B5AD9A] leading-relaxed">{errorMsg}</p>
          </div>
          <div className="pt-5 border-t border-white/10 text-xs text-[#8F8878] leading-relaxed">
            Please contact your interior design studio directly if you require an updated project
            tracking link.
          </div>
        </div>
      </div>
    );
  }

  const studioName = data.studio?.business_name?.trim() || 'AKD Interior';
  const studioLogo = data.studio?.logo_url?.trim() || '/logo.png';
  const studioPhone = data.studio?.phone?.trim() || '';
  const studioEmail = data.studio?.email?.trim() || '';
  const studioAddress = data.studio?.address?.trim() || '';
  const studioWebsite = data.studio?.website?.trim() || '';

  const currentStageIndex = Math.max(
    0,
    WORK_STAGES.findIndex((st) => st === data.current_work_stage)
  );
  const clampedProgress = Math.min(100, Math.max(0, Number(data.progress_percentage) || 0));

  // Progress ring geometry
  const RING_R = 84;
  const RING_C = 2 * Math.PI * RING_R;
  const ringOffset = RING_C * (1 - (ringReady ? clampedProgress : 0) / 100);

  const standaloneGallery: LightboxPhotoItem[] = (data.standalone_photos || []).map((ph) => ({
    photo_url: ph.photo_url,
    caption: ph.caption,
    upload_date: ph.upload_date,
  }));

  const stats: Array<{ label: string; value: string }> = [];
  if (data.estimated_start_date) {
    stats.push({ label: 'Commenced', value: formatDate(data.estimated_start_date) });
  }
  if (data.expected_completion_date) {
    stats.push({ label: 'Expected Handover', value: formatDate(data.expected_completion_date) });
  }
  stats.push({ label: 'Site Updates', value: String(data.updates.length) });
  stats.push({ label: 'Photographs', value: String(allProjectPhotos.length) });

  const siteLocation = data.site_address || data.property_location;
  const websiteHref = studioWebsite.startsWith('http') ? studioWebsite : `https://${studioWebsite}`;

  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#18181B] font-sans antialiased selection:bg-[#C5A059]/25 overflow-x-hidden">
      <style>{PORTAL_CSS}</style>

      {/* ================= HERO ================= */}
      <section className="relative bg-[#12110E] text-[#F3EBD8] overflow-hidden">
        <div className="akd-blueprint absolute inset-0" />
        <div className="akd-float pointer-events-none absolute -top-32 -right-24 w-[26rem] h-[26rem] rounded-full bg-[#C5A059]/20 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 w-[22rem] h-[22rem] rounded-full bg-[#B08A3E]/10 blur-[110px]" />
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-6 sm:pt-8 pb-28 sm:pb-36">
          {/* Brand bar */}
          <header className="akd-rise flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <StudioMark src={studioLogo} alt={studioName} />
              <div className="min-w-0">
                <span className="text-sm sm:text-base font-bold tracking-tight font-display text-[#F3EBD8] block truncate">
                  {studioName}
                </span>
                <span className="text-[10px] text-[#C5A059] font-semibold tracking-[0.22em] uppercase block">
                  Client Project Dossier
                </span>
              </div>
            </div>

            <span className="shrink-0 inline-flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full bg-white/[0.06] ring-1 ring-white/15 text-xs font-medium text-[#F3EBD8] backdrop-blur">
              <span className="relative w-2 h-2 rounded-full bg-[#C5A059] akd-pulse" />
              <span className="hidden sm:inline text-[#9C9482] uppercase tracking-wider text-[10px]">
                Status
              </span>
              {data.status}
            </span>
          </header>

          {/* Title + Ring */}
          <div className="mt-12 sm:mt-16 grid lg:grid-cols-[minmax(0,1fr)_auto] gap-12 lg:gap-16 items-center">
            <div className="min-w-0">
              <div
                className="akd-rise flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] sm:text-xs uppercase tracking-[0.2em] font-semibold text-[#C5A059]"
                style={{ animationDelay: '120ms' }}
              >
                <span className="h-px w-8 bg-[#C5A059]" />
                <span>Prepared for {data.client_name}</span>
              </div>

              <h1
                className="akd-serif akd-rise mt-5 text-[2.1rem] sm:text-5xl lg:text-[3.6rem] leading-[1.1] font-semibold text-[#F8F1DF] break-words"
                style={{ animationDelay: '220ms' }}
              >
                {data.project_name}
              </h1>

              <div
                className="akd-rise mt-6 flex flex-wrap items-center gap-2.5"
                style={{ animationDelay: '340ms' }}
              >
                {data.category && (
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#1B1A16] bg-gradient-to-r from-[#E9D5A1] to-[#C5A059]">
                    {data.category} Interior
                  </span>
                )}
                {siteLocation && (
                  <span className="inline-flex items-start gap-2 px-3.5 py-1.5 rounded-full text-xs text-[#D9D1BD] bg-white/[0.06] ring-1 ring-white/10 max-w-full">
                    <MapPin className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-px" />
                    <span className="min-w-0 break-words">{siteLocation}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Animated progress ring */}
            <div
              className="akd-rise justify-self-center lg:justify-self-end w-full max-w-[19rem]"
              style={{ animationDelay: '300ms' }}
            >
              <div className="rounded-[2rem] p-6 sm:p-7 bg-white/[0.05] ring-1 ring-white/10 backdrop-blur-md text-center">
                <div className="relative w-48 h-48 sm:w-52 sm:h-52 mx-auto">
                  <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                    <defs>
                      <linearGradient id="akdRingGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#F1DFAE" />
                        <stop offset="100%" stopColor="#B08A3E" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="100"
                      cy="100"
                      r={RING_R}
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="10"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r={RING_R}
                      fill="none"
                      stroke="url(#akdRingGrad)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={RING_C}
                      strokeDashoffset={ringOffset}
                      className="akd-ring-arc"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="akd-serif text-5xl sm:text-[3.4rem] font-semibold leading-none akd-gold-text tabular-nums">
                      {clampedProgress}
                      <span className="text-2xl align-top ml-0.5">%</span>
                    </span>
                    <span className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#9C9482] font-semibold">
                      Complete
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-white/10">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-[#9C9482] font-semibold block">
                    Current Work Stage
                  </span>
                  <span className="akd-serif text-lg text-[#F3EBD8] mt-1 block">
                    {data.current_work_stage || data.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MAIN ================= */}
      <main className="relative max-w-6xl mx-auto px-5 sm:px-8 pb-16 sm:pb-24 space-y-16 sm:space-y-24">
        {/* Journey card (overlaps hero intentionally; hero reserves space via bottom padding) */}
        <Reveal className="-mt-16 sm:-mt-20 relative z-10">
          <section className="rounded-[1.75rem] bg-white ring-1 ring-black/5 shadow-[0_30px_60px_-30px_rgba(18,17,14,0.35)] overflow-hidden">
            <div className="p-6 sm:p-10">
              <div className="flex items-end justify-between gap-4 mb-8 sm:mb-10">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9A7832] block">
                    The Journey
                  </span>
                  <h2 className="akd-serif text-2xl sm:text-3xl text-[#18181B] mt-1">
                    Completion Trajectory
                  </h2>
                </div>
                <span className="font-mono text-xs sm:text-sm font-semibold text-[#18181B] tabular-nums shrink-0">
                  {clampedProgress}% Complete
                </span>
              </div>

              {/* Desktop: horizontal path */}
              <ol className="hidden lg:grid grid-cols-6">
                {WORK_STAGES.map((stage, idx) => {
                  const isCompleted = clampedProgress === 100 || idx < currentStageIndex;
                  const isCurrent = clampedProgress < 100 && idx === currentStageIndex;
                  const Icon = STAGE_ICONS[stage] || Compass;
                  return (
                    <li key={stage} className="relative flex flex-col items-center text-center px-2">
                      {idx < WORK_STAGES.length - 1 && (
                        <span
                          className={`absolute top-[23px] left-[calc(50%+31px)] right-[calc(-50%+31px)] h-[2px] rounded-full ${
                            isCompleted
                              ? 'bg-gradient-to-r from-[#C5A059] to-[#B08A3E]'
                              : 'bg-[#E6E1D3]'
                          }`}
                        />
                      )}
                      <span
                        className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                          isCompleted
                            ? 'bg-gradient-to-br from-[#E9D5A1] to-[#B08A3E] text-[#1B1A16]'
                            : isCurrent
                            ? 'bg-[#1B1A16] text-[#E9D5A1] ring-2 ring-[#C5A059] ring-offset-4 ring-offset-white akd-pulse'
                            : 'bg-[#F5F2EA] text-[#B7B09E] ring-1 ring-[#E6E1D3]'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-5 h-5" strokeWidth={3} />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </span>
                      <span className="mt-3 text-[10px] font-mono tracking-widest text-[#B7B09E]">
                        0{idx + 1}
                      </span>
                      <span
                        className={`mt-0.5 text-sm leading-snug ${
                          isCurrent
                            ? 'font-semibold text-[#18181B]'
                            : isCompleted
                            ? 'font-medium text-[#3F3B30]'
                            : 'font-medium text-[#B7B09E]'
                        }`}
                      >
                        {stage}
                      </span>
                      {isCurrent && (
                        <span className="mt-2 px-2 py-0.5 rounded-full bg-[#C5A059]/15 text-[#8A6A22] text-[9px] font-bold uppercase tracking-widest">
                          In Focus
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>

              {/* Mobile / tablet: vertical path */}
              <ol className="lg:hidden">
                {WORK_STAGES.map((stage, idx) => {
                  const isCompleted = clampedProgress === 100 || idx < currentStageIndex;
                  const isCurrent = clampedProgress < 100 && idx === currentStageIndex;
                  const isLast = idx === WORK_STAGES.length - 1;
                  const Icon = STAGE_ICONS[stage] || Compass;
                  return (
                    <li key={stage} className={`relative flex items-start gap-4 ${isLast ? '' : 'pb-6'}`}>
                      {!isLast && (
                        <span
                          className={`absolute left-[21px] top-[50px] bottom-[2px] w-[2px] rounded-full ${
                            isCompleted
                              ? 'bg-gradient-to-b from-[#C5A059] to-[#B08A3E]'
                              : 'bg-[#E6E1D3]'
                          }`}
                        />
                      )}
                      <span
                        className={`relative w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                          isCompleted
                            ? 'bg-gradient-to-br from-[#E9D5A1] to-[#B08A3E] text-[#1B1A16]'
                            : isCurrent
                            ? 'bg-[#1B1A16] text-[#E9D5A1] ring-2 ring-[#C5A059] ring-offset-2 ring-offset-white akd-pulse'
                            : 'bg-[#F5F2EA] text-[#B7B09E] ring-1 ring-[#E6E1D3]'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-[18px] h-[18px]" strokeWidth={3} />
                        ) : (
                          <Icon className="w-[18px] h-[18px]" />
                        )}
                      </span>
                      <div className="pt-1 min-w-0">
                        <span className="text-[10px] font-mono tracking-widest text-[#B7B09E] block">
                          STEP 0{idx + 1}
                        </span>
                        <span
                          className={`text-[15px] leading-snug flex flex-wrap items-center gap-2 ${
                            isCurrent
                              ? 'font-semibold text-[#18181B]'
                              : isCompleted
                              ? 'font-medium text-[#3F3B30]'
                              : 'font-medium text-[#B7B09E]'
                          }`}
                        >
                          {stage}
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-[#C5A059]/15 text-[#8A6A22] text-[9px] font-bold uppercase tracking-widest">
                              In Focus
                            </span>
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Key facts strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#EDE8DA] border-t border-[#EDE8DA]">
              {stats.map((s) => (
                <div key={s.label} className="bg-[#FBF9F3] px-6 sm:px-8 py-5 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9C9482] block">
                    {s.label}
                  </span>
                  <span className="akd-serif text-lg sm:text-xl text-[#18181B] mt-1 block break-words">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ================= SITE LOG ================= */}
        <section>
          <Reveal>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-10 sm:mb-12">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9A7832] block">
                  Chronological Site Log
                </span>
                <h2 className="akd-serif text-3xl sm:text-4xl text-[#18181B] mt-1.5">
                  Work Updates &amp; Site Milestones
                </h2>
              </div>
              <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-full bg-white ring-1 ring-black/5 text-xs text-[#5C5648] font-medium">
                {data.updates.length}{' '}
                {data.updates.length === 1 ? 'documented update' : 'documented updates'}
              </span>
            </div>
          </Reveal>

          {data.updates.length === 0 ? (
            <Reveal>
              <div className="rounded-3xl p-10 sm:p-14 text-center bg-white ring-1 ring-black/5 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#C5A059]/10 text-[#B08A3E] flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <h3 className="akd-serif text-xl text-[#18181B]">No Site Updates Published Yet</h3>
                <p className="text-sm text-[#7A7363] max-w-md mx-auto leading-relaxed">
                  Dated site progress logs and execution photographs will appear here as your
                  project milestones are recorded.
                </p>
              </div>
            </Reveal>
          ) : (
            <ol className="relative">
              {/* Timeline spine */}
              <span className="absolute left-4 sm:left-5 top-3 bottom-3 w-px -translate-x-1/2 bg-gradient-to-b from-[#C5A059] via-[#C5A059]/40 to-transparent" />

              {data.updates.map((update, idx) => {
                const updateLightboxItems: LightboxPhotoItem[] = (update.photos || []).map(
                  (ph) => ({
                    photo_url: ph.photo_url,
                    caption: ph.caption,
                    upload_date: ph.upload_date || update.update_date,
                    stage_badge: update.work_stage,
                  })
                );
                const isLatest = idx === 0;
                const milestone = Math.min(100, Math.max(0, Number(update.progress_percentage) || 0));

                return (
                  <li key={update.id} className="relative pb-8 sm:pb-12 last:pb-0">
                    <Reveal className="relative pl-12 sm:pl-16">
                      {/* Node */}
                      <span
                        className={`absolute left-0 top-5 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                          isLatest
                            ? 'bg-gradient-to-br from-[#E9D5A1] to-[#B08A3E] text-[#1B1A16] akd-pulse ring-4 ring-[#F5F2EA]'
                            : 'bg-[#1B1A16] text-[#C5A059] ring-4 ring-[#F5F2EA]'
                        }`}
                      >
                        <span className="text-[10px] sm:text-xs font-bold tabular-nums">
                          {data.updates.length - idx}
                        </span>
                      </span>

                      <article className="rounded-3xl bg-white ring-1 ring-black/5 shadow-[0_18px_40px_-28px_rgba(18,17,14,0.35)] overflow-hidden">
                        {/* Card header */}
                        <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-5 border-b border-[#F0ECE0] bg-gradient-to-b from-[#FBF9F3] to-white">
                          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {isLatest && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#1B1A16] text-[#E9D5A1]">
                                  Latest Update
                                </span>
                              )}
                              <span className="px-3 py-1 rounded-full text-xs font-semibold text-[#18181B] bg-[#F5F2EA] ring-1 ring-[#E6E1D3]">
                                {update.work_stage}
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#5C5648] font-medium">
                              <Calendar className="w-3.5 h-3.5 text-[#B08A3E]" />
                              {formatDate(update.update_date)}
                            </span>
                          </div>

                          <div className="mt-4 flex items-center gap-3">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9C9482] shrink-0">
                              Milestone Progress
                            </span>
                            <div className="relative flex-1 h-1.5 rounded-full bg-[#EDE8DA] overflow-hidden">
                              <div
                                className="relative h-full rounded-full bg-gradient-to-r from-[#E9D5A1] to-[#B08A3E] overflow-hidden akd-bar-sheen"
                                style={{ width: `${milestone}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-[#18181B] tabular-nums shrink-0">
                              {update.progress_percentage}%
                            </span>
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="p-5 sm:p-8 space-y-6">
                          <div className="space-y-2">
                            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9C9482]">
                              Work Completed
                            </h3>
                            <p className="text-[15px] text-[#27241C] leading-relaxed whitespace-pre-wrap break-words">
                              {update.work_completed}
                            </p>
                          </div>

                          {update.client_note && (
                            <div className="relative rounded-2xl bg-[#FBF6E8] ring-1 ring-[#E9D5A1]/70 p-5 sm:p-6">
                              <Quote className="absolute top-4 right-4 w-6 h-6 text-[#C5A059]/35" />
                              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8A6A22] block">
                                Note from the Studio
                              </span>
                              <p className="akd-serif italic text-base sm:text-lg text-[#3A3220] leading-relaxed mt-2 pr-6 whitespace-pre-wrap break-words">
                                {update.client_note}
                              </p>
                            </div>
                          )}

                          {update.work_remaining && (
                            <div className="flex items-start gap-3 rounded-2xl bg-[#F5F2EA] px-4 sm:px-5 py-4 text-sm text-[#3F3B30]">
                              <span className="w-7 h-7 rounded-full bg-[#1B1A16] text-[#C5A059] flex items-center justify-center shrink-0">
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                              <div className="min-w-0 pt-0.5 leading-relaxed">
                                <span className="font-semibold text-[#18181B] block text-[11px] uppercase tracking-[0.16em] mb-0.5">
                                  Up Next
                                </span>
                                <span className="break-words">{update.work_remaining}</span>
                              </div>
                            </div>
                          )}

                          {update.photos && update.photos.length > 0 && (
                            <div className="space-y-3 pt-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9C9482] inline-flex items-center gap-2">
                                  <Camera className="w-3.5 h-3.5 text-[#B08A3E]" />
                                  Progress Photographs ({update.photos.length})
                                </span>
                                <span className="text-[11px] text-[#B7B09E]">
                                  Tap any photograph to enlarge
                                </span>
                              </div>
                              <PhotoMosaic
                                items={update.photos}
                                altFallback="Site progress photograph"
                                onOpen={(pIdx) =>
                                  openLightboxWithGallery(updateLightboxItems, pIdx)
                                }
                              />
                            </div>
                          )}
                        </div>
                      </article>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ================= STANDALONE PHOTOS ================= */}
        {data.standalone_photos && data.standalone_photos.length > 0 && (
          <section>
            <Reveal>
              <div className="flex items-end justify-between gap-4 mb-8">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9A7832] block">
                    Visual Documentation
                  </span>
                  <h2 className="akd-serif text-2xl sm:text-3xl text-[#18181B] mt-1.5">
                    Additional Site Photographs
                  </h2>
                </div>
                <span className="px-3.5 py-1.5 rounded-full bg-white ring-1 ring-black/5 text-xs text-[#5C5648] font-medium shrink-0">
                  {data.standalone_photos.length} photos
                </span>
              </div>
              <PhotoMosaic
                items={data.standalone_photos}
                altFallback="Site photograph"
                onOpen={(sIdx) => openLightboxWithGallery(standaloneGallery, sIdx)}
              />
            </Reveal>
          </section>
        )}

        {/* ================= STUDIO CONTACT ================= */}
        <Reveal>
          <footer className="relative rounded-[2rem] bg-[#12110E] text-[#F3EBD8] overflow-hidden">
            <div className="akd-blueprint absolute inset-0 opacity-70" />
            <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-[#C5A059]/20 blur-[90px]" />

            <div className="relative p-7 sm:p-12">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="space-y-3 max-w-xl min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C5A059] block">
                    Studio Enquiries &amp; Assistance
                  </span>
                  <h3 className="akd-serif text-2xl sm:text-3xl text-[#F8F1DF] break-words">
                    Questions about your project?
                  </h3>
                  <p className="text-sm text-[#B5AD9A] leading-relaxed">
                    {studioName} is happy to walk you through any milestone, material or timeline.
                  </p>
                  {studioAddress && (
                    <p className="text-xs text-[#8F8878] leading-relaxed inline-flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#C5A059] shrink-0 mt-0.5" />
                      <span className="break-words">{studioAddress}</span>
                    </p>
                  )}
                </div>

                {studioPhone && (
                  <a
                    href={`tel:${studioPhone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-full bg-gradient-to-r from-[#E9D5A1] to-[#C5A059] hover:brightness-110 text-[#1B1A16] text-sm font-semibold transition shrink-0 self-start md:self-auto"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Contact Studio</span>
                  </a>
                )}
              </div>

              {(studioPhone || studioEmail || studioWebsite) && (
                <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-[#D9D1BD]">
                  {studioPhone && (
                    <a
                      href={`tel:${studioPhone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-2 hover:text-white transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>{studioPhone}</span>
                    </a>
                  )}
                  {studioEmail && (
                    <a
                      href={`mailto:${studioEmail}`}
                      className="inline-flex items-center gap-2 hover:text-white transition-colors break-all"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                      <span>{studioEmail}</span>
                    </a>
                  )}
                  {studioWebsite && (
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 hover:text-white transition-colors break-all"
                    >
                      <Globe className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                      <span>{studioWebsite}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </footer>

          <p className="text-center text-[11px] text-[#9C9482] mt-8 tracking-wide">
            A private progress page prepared exclusively for {data.client_name} by {studioName}.
          </p>
        </Reveal>
      </main>

      {/* Lightbox Modal */}
      <PhotoLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photos={lightboxPhotos.length > 0 ? lightboxPhotos : allProjectPhotos}
        initialIndex={lightboxIndex}
      />
    </div>
  );
};

