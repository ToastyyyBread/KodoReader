import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import CustomDropdown from './CustomDropdown';
import { getApiBase } from '../runtime';

export const API = getApiBase();

/* ─── Reading Progress Helpers ─────────────────────────── */
// Stored in localStorage as: kodo-prog-{mangaId} → { chapterId: { page, scroll, read, ts } }
export const getChapterProgress = (mangaId, chapterId) => {
    try {
        const data = JSON.parse(localStorage.getItem(`kodo-prog-${mangaId}`)) || {};
        return data[chapterId] || null;
    } catch { return null; }
};

export const getMangaProgress = (mangaId) => {
    try { return JSON.parse(localStorage.getItem(`kodo-prog-${mangaId}`)) || {}; } catch { return {}; }
};

export const clearMangaProgress = (mangaId) => {
    try { localStorage.removeItem(`kodo-prog-${mangaId}`); } catch { }
};

const saveChapterProgress = (mangaId, chapterId, updates) => {
    try {
        const key = `kodo-prog-${mangaId}`;
        const data = JSON.parse(localStorage.getItem(key)) || {};
        data[chapterId] = { ...(data[chapterId] || {}), ...updates, ts: Date.now() };
        localStorage.setItem(key, JSON.stringify(data));
    } catch { }
};

// Fetched via API now
export const fetchBookmarks = async (API) => {
    try {
        const res = await fetch(`${API || ''}/api/bookmarks`);
        return await res.json();
    } catch { return []; }
};

export const deleteBookmarkAsync = async (API, id) => {
    try {
        await fetch(`${API || ''}/api/bookmarks/${id}`, { method: 'DELETE' });
    } catch { }
};

// Capture a thumbnail from an <img> element via canvas
const captureThumbnail = (imgEl, readMode, viewportCenterY) => {
    try {
        let settingStr = localStorage.getItem('kodo-bookmark-quality');
        let qualitySetting = settingStr ? parseInt(settingStr) : 35;
        if (qualitySetting < 35) qualitySetting = 35; // enforce min 35%

        const bmCropW = parseInt(localStorage.getItem('kodo-bm-crop-w')) || 100;
        const bmCropH = parseInt(localStorage.getItem('kodo-bm-crop-h')) || 110;
        const bmCropY = parseInt(localStorage.getItem('kodo-bm-crop-y')) || 0;

        let sx = 0, sy = 0, sw = imgEl.naturalWidth, sh = imgEl.naturalHeight;

        if (readMode === 'Vertical' || readMode === 'Double' || readMode === 'Single') {
            const rect = imgEl.getBoundingClientRect();
            // Use the provided viewport center Y, falling back to window center
            const screenCenterY = viewportCenterY != null ? viewportCenterY : (window.innerHeight / 2);
            let relativeY = screenCenterY - rect.top;

            // Clamp to image bounds
            if (relativeY < 0) relativeY = 0;
            if (relativeY > rect.height) relativeY = rect.height;

            const nativeCenterY = (relativeY / rect.height) * imgEl.naturalHeight;
            const nativeCenterX = imgEl.naturalWidth / 2;

            sw = (bmCropW / 100) * imgEl.naturalWidth;
            sh = (bmCropH / 100) * imgEl.naturalWidth;
            const offsetY = (bmCropY / 100) * imgEl.naturalWidth;

            sx = nativeCenterX - (sw / 2);
            sy = nativeCenterY + offsetY - (sh / 2);

            if (sx < 0) sx = 0;
            if (sy < 0) sy = 0;
            if (sx + sw > imgEl.naturalWidth) sw = imgEl.naturalWidth - sx;
            if (sy + sh > imgEl.naturalHeight) sh = imgEl.naturalHeight - sy;
        }

        const maxFhdWidth = Math.min(sw, 1080);
        let targetW = maxFhdWidth * (qualitySetting / 100);
        if (targetW < 200) targetW = 200;

        const ratio = sh / sw;
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = Math.round(targetW * ratio);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        const encodeQ = 0.6 + ((qualitySetting / 100) * 0.3);
        return canvas.toDataURL('image/jpeg', encodeQ);
    } catch { return null; }
};

/* ─── Custom Dropdown (opens upward) ───────────────────── */
const ToolbarDropdown = ({ label, items, activeIndex, onSelect, onOpenChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef();
    const listRef = useRef();

    const toggleOpen = (val) => {
        setOpen(val);
        if (onOpenChange) onOpenChange(val);
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) toggleOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (open && listRef.current) {
            const activeEl = listRef.current.querySelector('.dropdown-item.active');
            if (activeEl) activeEl.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button className="toolbar-dropdown-trigger" onClick={() => toggleOpen(!open)} title={label}>
                {label && <span className="toolbar-dropdown-label">{label}</span>}
                <span className="toolbar-dropdown-value">{items[activeIndex] || '—'}</span>
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 15l-7-7-7 7" />
                </svg>
            </button>
            {open && (
                <div className="toolbar-dropdown-menu" ref={listRef}>
                    <div style={{ overflowY: 'auto', maxHeight: '188px', borderRadius: 8 }}>
                        {items.map((item, i) => (
                            <button key={i} className={`dropdown-item${i === activeIndex ? ' active' : ''}`}
                                onClick={() => { onSelect(i); toggleOpen(false); }}>
                                <span className="dropdown-item-index">{i + 1}</span>
                                <span className="dropdown-item-text">{item}</span>
                                {i === activeIndex && (
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="var(--accent)" strokeWidth="3" style={{ flexShrink: 0 }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ─── Reader Settings Panel (inline popover) ──────────── */
const ReaderSettingsPanel = ({
    optimizeImages, onOptimizeImages,
    theme, onToggleTheme,
    eyeComfort, onEyeComfortChange,
    showProgressBar, onShowProgressBar,
    barTimeout, onBarTimeout,
    barMinOpacity, onBarMinOpacity,
    onClose,
}) => {
    const ref = useRef();
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.custom-dropdown-menu')) {
                onClose();
            }
        };
        const t = setTimeout(() => document.addEventListener('mousedown', handler), 100);
        return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
    }, []);

    const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' };
    const rowLast = { ...row, borderBottom: 'none' };
    const label = { fontSize: 12, fontWeight: 500, color: 'var(--text)', userSelect: 'none' };
    const desc = { fontSize: 10, color: 'var(--muted)', marginTop: 1 };

    return (
        <div ref={ref} style={{
            position: 'absolute', bottom: 'calc(100% + 12px)', left: 0,
            width: 280, maxHeight: '60vh', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 14,
            padding: '10px 14px',
            boxShadow: '0 -16px 48px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(20px)',
            animation: 'dropdownFadeIn 0.15s ease',
            zIndex: 600,
            display: 'flex', flexDirection: 'column',
        }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, flexShrink: 0 }}>Reader Settings</div>

            <div style={{ overflowY: 'auto', paddingRight: 4, marginRight: -4, display: 'flex', flexDirection: 'column' }} className="custom-scrollbar">
                {/* Optimize Images */}
                <div style={row}>
                    <div><div style={label}>Optimize Images</div><div style={desc}>GPU-accelerated smooth rendering</div></div>
                    <label className="toggle" style={{ flexShrink: 0 }}>
                        <input type="checkbox" checked={optimizeImages} onChange={e => onOptimizeImages(e.target.checked)} />
                        <span className="toggle-slider" />
                    </label>
                </div>

                {/* Dark/Light Mode */}
                <div style={row}>
                    <div><div style={label}>Light Mode</div><div style={desc}>Switch reader to light background</div></div>
                    <label className="toggle" style={{ flexShrink: 0 }}>
                        <input type="checkbox" checked={theme === 'light'} onChange={onToggleTheme} />
                        <span className="toggle-slider" />
                    </label>
                </div>

                {/* Eye Comfort Mode */}
                <div style={{ ...row, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                    <div><div style={label}>Smart Eye Comfort</div><div style={desc}>Warm shading, neutral lineart</div></div>
                    <CustomDropdown
                        value={eyeComfort}
                        onChange={(val) => onEyeComfortChange(val)}
                        direction="down"
                        items={[
                            { value: 'none', label: 'Original Colors' },
                            { value: 'warm', label: 'Warm Paper' },
                            { value: 'sepia', label: 'Cozy Sepia' },
                            { value: 'night', label: 'Deep Night' },
                        ]}
                    />
                </div>

                {/* Progress Bar */}
                <div style={row}>
                    <div><div style={label}>Show Progress Bar</div><div style={desc}>Reading progress at bottom</div></div>
                    <label className="toggle" style={{ flexShrink: 0 }}>
                        <input type="checkbox" checked={showProgressBar} onChange={e => onShowProgressBar(e.target.checked)} />
                        <span className="toggle-slider" />
                    </label>
                </div>

                {/* Bar Timeout */}
                <div style={row}>
                    <div><div style={label}>Toolbar Timeout</div><div style={desc}>{barTimeout / 1000}s before fading</div></div>
                    <input type="range" min="1000" max="5000" step="500" value={barTimeout}
                        onChange={e => onBarTimeout(+e.target.value)}
                        style={{ width: 90, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                </div>

                {/* Min Opacity */}
                <div style={rowLast}>
                    <div><div style={label}>Faded Opacity</div><div style={desc}>{Math.round(barMinOpacity * 100)}% when inactive</div></div>
                    <input type="range" min="0" max="3" step="1"
                        value={[0, 0.2, 0.4, 0.5].findIndex(v => v >= barMinOpacity) >= 0 ? [0, 0.2, 0.4, 0.5].findIndex(v => v >= barMinOpacity) : 0}
                        onChange={e => onBarMinOpacity([0, 0.2, 0.4, 0.5][+e.target.value])}
                        style={{ width: 90, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                </div>
            </div>
        </div>
    );
};

/* ─── Toolbar ──────────────────────────────────────────── */
const ReaderToolbar = ({
    currentImg, totalImgs,
    chapters, currentChapterIdx,
    onChapterChange,
    readMode, onReadModeChange,
    fitMode, onFitModeChange,
    zoom, onZoomChange,
    currentPage, totalPages, onPageChange,
    onBookmark,
    onDropdownToggle,
    // settings
    optimizeImages, onOptimizeImages,
    theme, onToggleTheme,
    eyeComfort, onEyeComfortChange,
    showProgressBar, onShowProgressBar,
    barTimeout, onBarTimeout,
    barMinOpacity, onBarMinOpacity,
}) => {
    const [settingsOpen, setSettingsOpen] = useState(false);

    const chapterLabels = chapters.map((_, i) => `Chapter ${String(i + 1).padStart(2, '0')}`);
    const pageLabels = Array.from({ length: totalPages }, (_, i) => `Page ${String(i + 1).padStart(2, '0')}`);

    // Active page index for dropdown and prev/next logic
    const pageActiveIndex = readMode === 'Vertical' ? Math.max(0, currentImg - 1) : currentPage;

    const isFirstPage = pageActiveIndex <= 0;
    const isLastPage = pageActiveIndex >= totalPages - 1;

    const handleSettingsToggle = () => {
        const next = !settingsOpen;
        setSettingsOpen(next);
        if (onDropdownToggle) onDropdownToggle(next);
    };

    useEffect(() => {
        if (!settingsOpen) return;
        const handleScroll = () => {
            setSettingsOpen(false);
            if (onDropdownToggle) onDropdownToggle(false);
        };
        window.addEventListener('wheel', handleScroll, { passive: true, capture: true });
        window.addEventListener('touchmove', handleScroll, { passive: true, capture: true });
        return () => {
            window.removeEventListener('wheel', handleScroll, { capture: true });
            window.removeEventListener('touchmove', handleScroll, { capture: true });
        };
    }, [settingsOpen, onDropdownToggle]);

    return (
        <div className="reader-toolbar" style={{ gap: 10 }}>
            {/* Settings gear button */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="toolbar-btn" title="Reader Settings" onClick={handleSettingsToggle}
                    style={{ color: settingsOpen ? 'var(--accent)' : undefined }}>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
                {settingsOpen && (
                    <ReaderSettingsPanel
                        optimizeImages={optimizeImages}
                        onOptimizeImages={onOptimizeImages}
                        theme={theme}
                        onToggleTheme={onToggleTheme}
                        eyeComfort={eyeComfort}
                        onEyeComfortChange={onEyeComfortChange}
                        showProgressBar={showProgressBar}
                        onShowProgressBar={onShowProgressBar}
                        barTimeout={barTimeout}
                        onBarTimeout={onBarTimeout}
                        barMinOpacity={barMinOpacity}
                        onBarMinOpacity={onBarMinOpacity}
                        onClose={() => { setSettingsOpen(false); if (onDropdownToggle) onDropdownToggle(false); }}
                    />
                )}
            </div>

            <div className="toolbar-divider" />

            {/* Prev Chapter */}
            <button className="toolbar-btn" title="Prev Chapter" disabled={currentChapterIdx <= 0} onClick={() => onChapterChange(currentChapterIdx - 1)}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Chapter dropdown */}
            <ToolbarDropdown
                label="Ch"
                items={chapterLabels}
                activeIndex={currentChapterIdx}
                onSelect={onChapterChange}
                onOpenChange={onDropdownToggle}
            />

            {/* Next Chapter */}
            <button className="toolbar-btn" title="Next Chapter" disabled={currentChapterIdx >= chapters.length - 1} onClick={() => onChapterChange(currentChapterIdx + 1)}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </button>

            <div className="toolbar-divider" />

            {/* Prev Page */}
            <button className="toolbar-btn" title="Prev Page" disabled={isFirstPage} onClick={() => onPageChange(pageActiveIndex - 1)}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Page dropdown - activeIndex auto-tracks currentImg or currentPage */}
            <ToolbarDropdown
                label={readMode === 'Vertical' ? 'Pg' : ''}
                items={pageLabels}
                activeIndex={pageActiveIndex}
                onSelect={(i) => onPageChange(i)}
                onOpenChange={onDropdownToggle}
            />

            {/* Next Page */}
            <button className="toolbar-btn" title="Next Page" disabled={isLastPage} onClick={() => onPageChange(pageActiveIndex + 1)}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </button>

            <div className="toolbar-divider" />

            <button className="toolbar-btn" title="Zoom Out" onClick={() => onZoomChange(Math.max(20, zoom - 10))}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" d="M20 12H4" />
                </svg>
            </button>
            <span className="toolbar-page-info" title="Reset Zoom" onClick={() => onZoomChange(100)}
                style={{ width: 44, minWidth: 44, cursor: 'pointer', textAlign: 'center' }}>
                {zoom}%
            </span>
            <button className="toolbar-btn" title="Zoom In" onClick={() => onZoomChange(Math.min(300, zoom + 10))}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                </svg>
            </button>

            <div className="toolbar-divider" />

            <ToolbarDropdown
                label=""
                items={['Vertical', 'Single', 'Double']}
                activeIndex={['Vertical', 'Single', 'Double'].indexOf(readMode)}
                onSelect={(i) => onReadModeChange(['Vertical', 'Single', 'Double'][i])}
                onOpenChange={onDropdownToggle}
            />

            {readMode !== 'Vertical' && (
                <ToolbarDropdown
                    label=""
                    items={['Fit Width', 'Fit Height', 'Original']}
                    activeIndex={['Width', 'Height', 'Original'].indexOf(fitMode)}
                    onSelect={(i) => onFitModeChange(['Width', 'Height', 'Original'][i])}
                    onOpenChange={onDropdownToggle}
                />
            )}

            <div className="toolbar-divider" />

            <button className="toolbar-btn" title="Bookmark this page" onClick={onBookmark}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
            </button>
        </div>
    );
};

/* ─── Main Reader ──────────────────────────────────────── */
const Reader = ({ mangaId, chapterId, versionId = 'default', mangaTitle, chapters, onBack, initialPage, theme, onToggleTheme }) => {
    // Restore saved progress for this chapter
    const savedProg = getChapterProgress(mangaId, chapterId);

    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [backHover, setBackHover] = useState(false);
    // initialPage (from bookmark) takes priority over saved progress
    // initialPage can be a number (legacy) or an object { page, scrollRatio } (new)
    const initialPageNum = initialPage != null
        ? (typeof initialPage === 'object' ? initialPage.page : initialPage)
        : null;
    const [currentPage, setCurrent] = useState(initialPageNum ?? savedProg?.page ?? 0);
    const [visibleImg, setVisible] = useState(1);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [showBar, setShowBar] = useState(true);
    // Show toast only on fresh chapter entry (not page refresh)
    const toastKey = `kodo-toast-${mangaId}-${chapterId}`;
    const [showResume] = useState(() => {
        if (sessionStorage.getItem(toastKey)) return false; // already shown this session
        const hasProgress = !!(savedProg && (savedProg.page > 0 || savedProg.scroll > 0.01));
        if (hasProgress) sessionStorage.setItem(toastKey, '1');
        return hasProgress;
    });

    // Reset page to 0 (top) when changing chapters, unless initialPage is provided (e.g., from bookmark)
    // We use a ref to track if this is the first mount or a subsequent chapter change.
    const isFirstMount = useRef(true);
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
        } else {
            // This runs when chapterId changes dynamically within the Reader
            setCurrent(0);
            setVisible(1);
            setScrollProgress(0);
            setPendingScroll(null);
            if (scrollRef.current) {
                scrollRef.current.scrollTop = 0;
            }
        }
    }, [chapterId]);


    const [readMode, setReadMode] = useState(() => {
        try {
            const perManga = JSON.parse(localStorage.getItem(`kodo-${mangaId}`))?.readMode;
            return perManga || localStorage.getItem('kodo-default-readmode') || 'Vertical';
        } catch { return localStorage.getItem('kodo-default-readmode') || 'Vertical'; }
    });
    const [fitMode, setFitMode] = useState(() => {
        try {
            const perManga = JSON.parse(localStorage.getItem(`kodo-${mangaId}`))?.fitMode;
            return perManga || localStorage.getItem('kodo-default-fitmode') || 'Width';
        } catch { return localStorage.getItem('kodo-default-fitmode') || 'Width'; }
    });
    const [zoom, setZoom] = useState(() => { try { return JSON.parse(localStorage.getItem(`kodo-${mangaId}`))?.zoom || 100; } catch { return 100; } });

    // ── Reader-specific settings (live-configurable) ────────────────────────────────
    const [optimizeImages, setOptimizeImages] = useState(() => localStorage.getItem('kodo-optimize-images') !== 'false');
    const [showProgressBar, setShowProgressBar] = useState(() => localStorage.getItem('kodo-show-progressbar') !== 'false');
    const [barTimeout, setBarTimeout] = useState(() => parseInt(localStorage.getItem('kodo-bar-timeout')) || 3000);
    const [barMinOpacity, setBarMinOpacity] = useState(() => parseFloat(localStorage.getItem('kodo-bar-opacity')) || 0);

    // New: Eye Comfort Mode
    const [eyeComfort, setEyeComfort] = useState(() => localStorage.getItem('kodo-eye-comfort') || 'none');

    const handleOptimizeImages = (val) => { setOptimizeImages(val); localStorage.setItem('kodo-optimize-images', val); };
    const handleShowProgressBar = (val) => { setShowProgressBar(val); localStorage.setItem('kodo-show-progressbar', val); };
    const handleBarTimeout = (val) => { setBarTimeout(val); localStorage.setItem('kodo-bar-timeout', val); };
    const handleBarMinOpacity = (val) => { setBarMinOpacity(val); localStorage.setItem('kodo-bar-opacity', val); };
    const handleEyeComfort = (val) => { setEyeComfort(val); localStorage.setItem('kodo-eye-comfort', val); };


    const themeStyle = {
        bg: theme === 'light' ? '#fff' : '#000',
    };

    const imgOptStyle = {
        ...(optimizeImages ? {
            imageRendering: 'auto',
            transform: 'translateZ(0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
        } : {}),
        filter: eyeComfort !== 'none' ? `url(#filter-${eyeComfort})` : 'none',
        transition: 'filter 0.3s ease',
    };

    const scrollRef = useRef();
    const contentRef = useRef();
    const barTimer = useRef();
    const imgRefs = useRef([]);

    const exactRatioRef = useRef(0);
    const [pendingScroll, setPendingScroll] = useState(null);
    const zoomAnchorRef = useRef(null); // { imgIndex, offsetRatio }

    // ── Image-based zoom anchoring ─────────────────────────────
    // Before zoom: find which image is at the viewport center, store it
    const handleZoom = (newZoomOrFn) => {
        const el = scrollRef.current;
        if (el && readMode === 'Vertical' && imgRefs.current.length > 0) {
            const containerRect = el.getBoundingClientRect();
            const viewportCenterY = containerRect.top + containerRect.height / 2;
            for (let i = 0; i < imgRefs.current.length; i++) {
                const img = imgRefs.current[i];
                if (!img) continue;
                const r = img.getBoundingClientRect();
                if (r.top <= viewportCenterY && r.bottom > viewportCenterY) {
                    zoomAnchorRef.current = { imgIndex: i, offsetRatio: (viewportCenterY - r.top) / r.height };
                    break;
                }
            }
        }
        setZoom(newZoomOrFn);
    };

    // After zoom renders and images resize, scroll back to the anchor image
    useLayoutEffect(() => {
        const anchor = zoomAnchorRef.current;
        const el = scrollRef.current;
        if (!anchor || !el || readMode !== 'Vertical') return;
        // Use rAF to ensure layout has settled after the zoom CSS change
        const frame = requestAnimationFrame(() => {
            const img = imgRefs.current[anchor.imgIndex];
            if (!img) return;
            const imgRect = img.getBoundingClientRect();
            const containerRect = el.getBoundingClientRect();
            const currentAnchorY = imgRect.top + anchor.offsetRatio * imgRect.height;
            const desiredCenterY = containerRect.top + containerRect.height / 2;
            el.scrollTop += currentAnchorY - desiredCenterY;
        });
        return () => cancelAnimationFrame(frame);
    }, [zoom, readMode]);

    const currentChapterIdx = chapters?.indexOf(chapterId) ?? 0;
    const isLastChapter = currentChapterIdx >= (chapters?.length ?? 1) - 1;

    // ── Load images ─────────────────────────────────────────
    useEffect(() => {
        setLoading(true);
        fetch(`${API}/api/manga/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}?version=${encodeURIComponent(versionId)}`)
            .then(r => r.json())
            .then(data => {
                setImages(Array.isArray(data) ? data : []);
                setLoading(false);
                if (readMode === 'Vertical') {
                    if (initialPage != null && typeof initialPage === 'object' && initialPage.scrollRatio != null) {
                        // Bookmark with exact scroll ratio — restore precisely
                        setPendingScroll({ type: 'exact', value: initialPage.scrollRatio });
                    } else if (initialPage != null && typeof initialPage === 'number' && initialPage > 0) {
                        // Legacy bookmark with just page index — scroll to the image and center it
                        setTimeout(() => {
                            const targetImg = imgRefs.current[initialPage];
                            if (targetImg) targetImg.scrollIntoView({ behavior: 'instant', block: 'center' });
                        }, 100);
                    } else if (savedProg?.exactScroll != null) {
                        setPendingScroll({ type: 'exact', value: savedProg.exactScroll });
                    } else if (savedProg?.scroll > 0) {
                        setPendingScroll({ type: 'legacy', value: savedProg.scroll });
                    }
                }
            })
            .catch(() => setLoading(false));

        // Reset ratio on chapter change so we don't jump back to the previous chapter's exact scroll
        exactRatioRef.current = 0;
    }, [mangaId, chapterId]);



    // ── Save page progress (single/double) ──────────────────
    // ── Save page progress (single/double/vertical) ─────────────
    useEffect(() => {
        if (!loading && images.length > 0) {
            const isCompleted = readMode !== 'Vertical' && currentPage >= images.length - 1;
            const updatedPage = readMode === 'Vertical' ? Math.max(0, visibleImg - 1) : currentPage;
            fetch(`${API}/api/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mangaId, chapterId, page: updatedPage, completed: isCompleted, versionId })
            });
            saveChapterProgress(mangaId, chapterId, { page: updatedPage, read: isCompleted ? true : undefined });
        }
    }, [currentPage, visibleImg, mangaId, chapterId, loading, readMode, images.length]);

    // ── Persist reader preferences ──────────────────────────
    useEffect(() => {
        localStorage.setItem(`kodo-${mangaId}`, JSON.stringify({ readMode, fitMode, zoom }));
    }, [mangaId, readMode, fitMode, zoom]);

    // ── Ctrl+Wheel Zoom ─────────────────────────────────────
    useEffect(() => {
        const handleWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                handleZoom(z => Math.max(20, Math.min(400, z + (e.deltaY < 0 ? 10 : -10))));
            }
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [readMode]);

    // ── Track which image is visible (Vertical) via scroll ──────────
    useEffect(() => {
        if (readMode !== 'Vertical' || images.length === 0) return;
        const container = scrollRef.current;
        if (!container) return;

        const updateVisible = () => {
            const containerTop = container.getBoundingClientRect().top;
            let closestIdx = 0;
            let closestDist = Infinity;
            imgRefs.current.forEach((el, i) => {
                if (!el) return;
                const rect = el.getBoundingClientRect();
                // Distance of image top from container top (prefer top-most visible image)
                const dist = Math.abs(rect.top - containerTop);
                if (dist < closestDist) { closestDist = dist; closestIdx = i; }
            });
            setVisible(closestIdx + 1);
        };

        container.addEventListener('scroll', updateVisible, { passive: true });
        // Run once immediately to set initial value
        updateVisible();
        return () => container.removeEventListener('scroll', updateVisible);
    }, [readMode, images]);

    // ── Scroll Restoration (initial chapter load only) ───────────────────
    useEffect(() => {
        if (readMode !== 'Vertical') return;
        const el = scrollRef.current;
        const content = contentRef.current;
        if (!el || !content) return;

        let active = true;

        const observer = new ResizeObserver(() => {
            if (!active || pendingScroll === null) return;
            const maxScroll = el.scrollHeight - el.clientHeight;
            if (maxScroll <= 0) return;

            if (pendingScroll.type === 'exact') {
                el.scrollTop = pendingScroll.value * el.scrollHeight - el.clientHeight / 2;
                exactRatioRef.current = pendingScroll.value;
            } else {
                el.scrollTop = pendingScroll.value * maxScroll;
                exactRatioRef.current = (el.scrollTop + el.clientHeight / 2) / el.scrollHeight;
            }
        });

        observer.observe(content);

        const cancelPending = () => {
            if (!active) return;
            setPendingScroll(null);
        };

        el.addEventListener('wheel', cancelPending, { passive: true });
        el.addEventListener('touchstart', cancelPending, { passive: true });
        el.addEventListener('mousedown', cancelPending, { passive: true });

        return () => {
            active = false;
            observer.disconnect();
            el.removeEventListener('wheel', cancelPending);
            el.removeEventListener('touchstart', cancelPending);
            el.removeEventListener('mousedown', cancelPending);
        };
    }, [pendingScroll, readMode]);

    // ── Dropdown-open lock: prevent fade while dropdown is open ──
    const dropdownOpenRef = useRef(false);
    const handleDropdownToggle = (isOpen) => {
        dropdownOpenRef.current = isOpen;
        if (isOpen) {
            clearTimeout(barTimer.current);
            setShowBar(true);
        } else {
            barTimer.current = setTimeout(() => setShowBar(false), barTimeout);
        }
    };

    // ── Show/hide toolbar based on mouse proximity ───────────────
    useEffect(() => {
        const PROXIMITY = 90;

        const handleMouseMove = (e) => {
            if (dropdownOpenRef.current) return;
            const distFromBottom = window.innerHeight - e.clientY;
            if (distFromBottom <= PROXIMITY) {
                setShowBar(true);
                clearTimeout(barTimer.current);
                barTimer.current = setTimeout(() => setShowBar(false), barTimeout);
            }
        };

        const handleMouseLeave = () => {
            if (dropdownOpenRef.current) return;
            clearTimeout(barTimer.current);
            barTimer.current = setTimeout(() => setShowBar(false), Math.min(1500, barTimeout));
        };

        barTimer.current = setTimeout(() => setShowBar(false), barTimeout);

        window.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', handleMouseLeave);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
            clearTimeout(barTimer.current);
        };
    }, [barTimeout]);

    // ── Chapter nav ─────────────────────────────────────────
    const handleChapterChange = (idx) => {
        if (!chapters || !chapters[idx]) return;
        const targetChapter = chapters[idx];
        onBack(targetChapter);
    };

    // ── Single/Double page nav ───────────────────────────────
    const totalPages = readMode === 'Double'
        ? Math.ceil(images.length / 2)
        : images.length;

    const handlePageChange = (p) => {
        const clamped = Math.max(0, Math.min(totalPages - 1, p));
        if (readMode === 'Vertical') {
            // Scroll to the target image in vertical mode
            const targetImg = imgRefs.current[clamped];
            if (targetImg) targetImg.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            setCurrent(readMode === 'Double' ? clamped * 2 : clamped);
            scrollRef.current?.scrollTo({ top: 0 });
        }
    };

    const fitStyleSingleDouble = (() => {
        const z = zoom / 100;
        if (fitMode === 'Width') return { width: `${100 * z}%`, height: 'auto' };
        if (fitMode === 'Height') return { height: `calc((100vh - 72px) * ${z})`, width: 'auto' };
        return { width: `${100 * z}%`, height: 'auto' };
    })();

    const verticalMaxWidth = `${9 * zoom}px`;

    // ── Progress (0 to 1) ────────────────────────────────────
    const currentPageForProgress = readMode === 'Double' ? Math.floor(currentPage / 2) : currentPage;
    const progress = (loading || images.length === 0) ? 0
        : readMode === 'Vertical'
            ? scrollProgress
            : Math.min(1, (currentPageForProgress + 1) / Math.max(1, totalPages));

    // ── Mark as read & show Next Chapter prompt ──────────────
    const atEnd = !loading && images.length > 0 && (
        readMode === 'Vertical'
            ? scrollProgress >= 0.98
            : currentPageForProgress >= totalPages - 1
    );
    const showNextChapter = atEnd && !isLastChapter;

    // Mark chapter as read when reaching the end
    useEffect(() => {
        if (atEnd) {
            // Wait this triggers on scrolling to the very bottom
            fetch(`${API}/api/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mangaId, chapterId, page: images.length - 1, completed: true })
            });
            saveChapterProgress(mangaId, chapterId, { read: true });
        }
    }, [atEnd, mangaId, chapterId, images.length]);

    // ── Bookmark handler ─────────────────────────────────────
    const [bookmarkToast, setBookmarkToast] = useState(null);
    const bookmarkToastTimer = useRef(null);
    const lastBookmarkRef = useRef(null);

    const handleBookmark = () => {
        const container = scrollRef.current;
        // Determine viewport center in screen coordinates
        const containerRect = container ? container.getBoundingClientRect() : null;
        const viewportCenterY = containerRect
            ? containerRect.top + containerRect.height / 2
            : window.innerHeight / 2;

        // Find the image that actually covers the viewport center
        let pageIdx = readMode === 'Vertical' ? Math.max(0, visibleImg - 1) : currentPage;
        if (readMode === 'Vertical') {
            let bestIdx = 0;
            let bestOverlap = -Infinity;
            imgRefs.current.forEach((el, i) => {
                if (!el) return;
                const rect = el.getBoundingClientRect();
                // Check if this image covers the viewport center
                if (rect.top <= viewportCenterY && rect.bottom >= viewportCenterY) {
                    // Direct hit — this image is at the viewport center
                    bestIdx = i;
                    bestOverlap = Infinity;
                } else if (bestOverlap < Infinity) {
                    // Otherwise find the image closest to viewport center
                    const dist = Math.min(Math.abs(rect.top - viewportCenterY), Math.abs(rect.bottom - viewportCenterY));
                    if (-dist > bestOverlap) {
                        bestOverlap = -dist;
                        bestIdx = i;
                    }
                }
            });
            pageIdx = bestIdx;
        }

        const currentScrollY = container ? container.scrollTop : 0;

        // Spam protection (prevent creating bookmark at exact same page and scroll position)
        if (lastBookmarkRef.current && lastBookmarkRef.current.pageIdx === pageIdx && lastBookmarkRef.current.chapterId === chapterId) {
            if (Math.abs(lastBookmarkRef.current.scrollY - currentScrollY) < (window.innerHeight * 0.3)) {
                // Ignore if the bookmark toast is still showing to prevent spamming
                if (bookmarkToast && bookmarkToast.show && !bookmarkToast.leaving) return;
                // Or simply return early entirely so we don't save duplicate images
                if (Math.abs(lastBookmarkRef.current.scrollY - currentScrollY) < 50) return;
            }
        }

        lastBookmarkRef.current = { pageIdx, chapterId, scrollY: currentScrollY };

        const imgEl = imgRefs.current[pageIdx];
        const thumbnailBase64 = imgEl ? captureThumbnail(imgEl, readMode, viewportCenterY) : null;

        const bookmarkId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

        // Compute exact scroll ratio so we can restore to this exact position later
        let scrollRatio = null;
        if (readMode === 'Vertical' && container) {
            scrollRatio = container.scrollHeight > 0
                ? (container.scrollTop + container.clientHeight / 2) / container.scrollHeight
                : 0;
        }

        if (thumbnailBase64) {
            setBookmarkToast({ id: bookmarkId, thumbnail: thumbnailBase64, show: true, leaving: false });

            fetch(`${API}/api/bookmark/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: bookmarkId, mangaId, mangaTitle, chapterId, page: pageIdx, scrollRatio, thumbnailBase64 })
            }).catch(() => { });
        } else {
            setBookmarkToast({ id: bookmarkId, thumbnail: null, show: true, leaving: false });
        }

        if (bookmarkToastTimer.current) clearTimeout(bookmarkToastTimer.current);
        bookmarkToastTimer.current = setTimeout(() => {
            setBookmarkToast(prev => prev ? { ...prev, leaving: true } : null);
            setTimeout(() => {
                setBookmarkToast(prev => prev?.leaving ? null : prev);
            }, 300);
        }, 4000);
    };

    // ── Resume info label ────────────────────────────────────
    const resumeLabel = savedProg ? 'You were here before' : null;

    return (
        <div
            style={{
                position: 'absolute', inset: 0,
                background: themeStyle.bg,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                userSelect: 'none',
                transition: 'background 0.3s ease',
            }}
        >
            {/* SVG Filters for Eye Comfort */}
            <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
                <defs>
                    {/* Warm Paper: Reduce Blue, Slight Red/Green Boost (Keeps black black) */}
                    <filter id="filter-warm">
                        <feColorMatrix type="matrix" values="
                            1.05 0 0 0 0
                            0 1.02 0 0 0
                            0 0 0.9 0 0
                            0 0 0 1 0 "/>
                    </filter>
                    {/* Cozy Sepia: Stronger Warmth + slight desaturation/mixing */}
                    <filter id="filter-sepia">
                        <feColorMatrix type="matrix" values="
                            1.1 0 0 0 0
                            0 1.0 0 0 0
                            0 0 0.75 0 0
                            0 0 0 1 0 "/>
                    </filter>
                    {/* Deep Night: Just brightness reduction (0.8) */}
                    <filter id="filter-night">
                        <feColorMatrix type="matrix" values="
                            0.8 0 0 0 0
                            0 0.8 0 0 0
                            0 0 0.8 0 0
                            0 0 0 1 0 "/>
                    </filter>
                </defs>
            </svg>

            {/* Back button */}
            <button
                onClick={() => onBack(null)}
                onMouseEnter={() => setBackHover(true)}
                onMouseLeave={() => setBackHover(false)}
                style={{
                    position: 'absolute', top: 16, left: 16, zIndex: 200,
                    background: (showBar || backHover) ? 'rgba(20,20,20,0.85)' : 'transparent',
                    backdropFilter: (showBar || backHover) ? 'blur(12px)' : 'none',
                    border: (showBar || backHover) ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                    color: (showBar || backHover) ? '#fff' : 'transparent',
                    borderRadius: 24,
                    padding: '6px 14px', fontSize: 12.5, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                    opacity: (showBar || backHover) ? 1 : Math.max(barMinOpacity, 0.01),
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    maxWidth: '400px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                }}
            >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={(showBar || backHover) ? "currentColor" : "var(--accent)"} strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span style={{
                    opacity: (showBar || backHover) ? 1 : 0,
                    transition: 'opacity 0.2s',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {mangaTitle}
                </span>
            </button>

            {/* ── "You were here before" toast ────────────────── */}
            {showResume && resumeLabel && (
                <div style={{
                    position: 'absolute', top: 16, left: 0, right: 0,
                    display: 'flex', justifyContent: 'center',
                    zIndex: 300, pointerEvents: 'none',
                }}>
                    <div style={{
                        background: 'rgba(20,20,20,0.92)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.85)',
                        borderRadius: 10,
                        padding: '8px 16px',
                        fontSize: 12.5,
                        fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                        animation: 'toastFadeOut 4s ease forwards',
                        whiteSpace: 'nowrap',
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" style={{ opacity: 0.7 }}>
                            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
                            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0" />
                        </svg>
                        {resumeLabel}
                    </div>
                </div>
            )}

            {/* ── "Bookmarked!" toast ─────────────────────────── */}
            {bookmarkToast && (
                <div style={{
                    position: 'absolute', top: 16, left: 0, right: 0,
                    display: 'flex', justifyContent: 'center',
                    zIndex: 300, pointerEvents: 'none',
                }}>
                    <div style={{
                        background: 'rgba(20,20,20,0.92)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.85)',
                        borderRadius: 10,
                        padding: '8px 16px',
                        fontSize: 12.5,
                        fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                        animation: 'toastFadeOut 2s ease forwards',
                        whiteSpace: 'nowrap',
                    }}>
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        Bookmarked!
                    </div>
                </div>
            )}

            {/* ── SCROLL CONTAINER ─────────────────────────────── */}
            <div
                ref={scrollRef}
                onScroll={(e) => {
                    const el = e.target;
                    if (readMode === 'Vertical') {
                        const maxScroll = el.scrollHeight - el.clientHeight;
                        if (maxScroll > 0) {
                            const sp = Math.min(1, el.scrollTop / maxScroll);
                            setScrollProgress(sp);
                            // Always update exact scroll ratio for progress saving
                            if (el.scrollTop === 0) exactRatioRef.current = 0;
                            else exactRatioRef.current = (el.scrollTop + el.clientHeight / 2) / el.scrollHeight;
                            // Save scroll progress to localStorage
                            saveChapterProgress(mangaId, chapterId, { scroll: sp, exactScroll: exactRatioRef.current });
                        }
                    }
                }}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: themeStyle.bg,
                    transition: 'background 0.3s ease',
                }}
            >
                {loading && (
                    <div style={{ color: '#666', padding: '80px 0', fontSize: 14 }}>
                        Loading chapter...
                    </div>
                )}

                {/* ── VERTICAL ────────────────────────────────────── */}
                {!loading && readMode === 'Vertical' && (
                    <div ref={contentRef} style={{
                        width: '100%',
                        maxWidth: verticalMaxWidth,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                    }}>
                        {images.map((src, i) => (
                            <img
                                key={i}
                                ref={el => (imgRefs.current[i] = el)}
                                src={`${API}${src}`}
                                alt={`Page ${i + 1}`}
                                crossOrigin="anonymous"
                                loading={i > 5 ? 'lazy' : 'eager'}
                                style={{ width: '100%', height: 'auto', display: 'block', margin: 0, padding: 0, border: 'none', ...imgOptStyle }}
                            />
                        ))}
                        <div style={{ height: 80 }} />
                    </div>
                )}

                {/* ── SINGLE ──────────────────────────────────────── */}
                {!loading && readMode === 'Single' && (
                    <div style={{ width: '100%', minHeight: 'calc(100vh - 72px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                        {images[currentPage] && (
                            <img
                                src={`${API}${images[currentPage]}`}
                                alt={`Page ${currentPage + 1}`}
                                crossOrigin="anonymous"
                                ref={el => (imgRefs.current[currentPage] = el)}
                                style={{ ...fitStyleSingleDouble, objectFit: 'contain', ...imgOptStyle }}
                            />
                        )}
                    </div>
                )}

                {/* ── DOUBLE ──────────────────────────────────────── */}
                {!loading && readMode === 'Double' && (
                    <div style={{ width: '100%', minHeight: 'calc(100vh - 72px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                        {images[currentPage] && (
                            <img
                                src={`${API}${images[currentPage]}`}
                                alt={`Page ${currentPage + 1}`}
                                crossOrigin="anonymous"
                                ref={el => (imgRefs.current[currentPage] = el)}
                                style={{ ...fitStyleSingleDouble, maxWidth: fitMode === 'Original' ? '50%' : 'none', objectFit: 'contain', ...imgOptStyle }}
                            />
                        )}
                        {images[currentPage + 1] && (
                            <img
                                src={`${API}${images[currentPage + 1]}`}
                                alt={`Page ${currentPage + 2}`}
                                crossOrigin="anonymous"
                                style={{ ...fitStyleSingleDouble, maxWidth: fitMode === 'Original' ? '50%' : 'none', objectFit: 'contain', ...imgOptStyle }}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* ── PROGRESS BAR ───────────────────────────────── */}
            {showProgressBar && (
                <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}>
                    <div style={{
                        height: '100%',
                        width: `${progress * 100}%`,
                        background: 'var(--accent)',
                        transition: 'width 0.3s ease',
                        borderRadius: '0 2px 2px 0',
                    }} />
                </div>
            )}

            {/* ── NEXT CHAPTER FLOATING BUTTON ─────────────────── */}
            {showNextChapter && (
                <div style={{
                    position: 'absolute', bottom: 72, right: 24, zIndex: 300,
                    opacity: showBar ? 1 : barMinOpacity, transition: 'opacity 0.2s',
                    animation: showNextChapter ? 'fadeSlideUp 0.4s ease both' : undefined,
                }}>
                    <button
                        onClick={() => handleChapterChange(currentChapterIdx + 1)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 14px',
                            background: 'var(--toolbar-bg)',
                            backdropFilter: 'blur(12px)',
                            color: 'var(--text)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 8, fontSize: 13, fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                            letterSpacing: 0.3,
                        }}
                    >
                        Next Chapter
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}

            {/* ── BACK TO TOP FLOATING BUTTON (Vertical Only) ─── */}
            {atEnd && readMode === 'Vertical' && (
                <div style={{
                    position: 'absolute', bottom: 84, left: 0, right: 0,
                    display: 'flex', justifyContent: 'center', pointerEvents: 'none',
                    zIndex: 300, opacity: showBar ? 1 : barMinOpacity, transition: 'opacity 0.2s',
                    animation: 'fadeSlideUp 0.4s ease both',
                }}>
                    <button
                        onClick={() => {
                            const container = scrollRef.current;
                            if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
                            setScrollProgress(0);
                        }}
                        style={{
                            pointerEvents: 'auto',
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 14px',
                            background: 'var(--toolbar-bg)',
                            backdropFilter: 'blur(12px)',
                            color: 'var(--text)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 8, fontSize: 13, fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                            letterSpacing: 0.3,
                        }}
                    >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                        Back to Top
                    </button>
                </div>
            )
            }

            {/* ── BOOKMARK TOAST ─────────────────────────────── */}
            {bookmarkToast && bookmarkToast.show && (
                <div style={{
                    position: 'absolute', top: 24, right: 24, zIndex: 1000,
                    background: 'var(--surface)', backdropFilter: 'blur(16px)',
                    border: '1px solid var(--border)', borderRadius: 12,
                    padding: 12, display: 'flex', alignItems: 'center', gap: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    animation: bookmarkToast.leaving ? 'toastFadeOut 0.3s ease forwards' : 'modalPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
                }}>
                    <div style={{ width: 42, height: 42, borderRadius: 6, background: 'var(--surface2)', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                        {bookmarkToast.thumbnail ? (
                            <img src={bookmarkToast.thumbnail} alt="Bookmark Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                            </div>
                        )}
                    </div>
                    <div style={{ paddingRight: 8 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Bookmark Saved!</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Added to Bookmarks</div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteBookmarkAsync(API, bookmarkToast.id);
                            setBookmarkToast(prev => prev ? { ...prev, leaving: true } : null);
                            setTimeout(() => {
                                setBookmarkToast(prev => prev?.leaving ? null : prev);
                            }, 300);
                        }}
                        style={{
                            marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                        title="Delete Bookmark"
                    >
                        ✕
                    </button>
                </div>
            )
            }


            {/* ── TOOLBAR ────────────────────────────────────── */}
            <div style={{ opacity: showBar ? 1 : barMinOpacity, transition: 'opacity 0.5s', flexShrink: 0 }}>
                <ReaderToolbar
                    currentImg={visibleImg}
                    totalImgs={images.length}
                    chapters={chapters || []}
                    currentChapterIdx={currentChapterIdx}
                    onChapterChange={handleChapterChange}
                    readMode={readMode}
                    onReadModeChange={(m) => { setReadMode(m); setCurrent(0); }}
                    fitMode={fitMode}
                    onFitModeChange={setFitMode}
                    zoom={zoom}
                    onZoomChange={handleZoom}
                    currentPage={readMode === 'Double' ? Math.floor(currentPage / 2) : currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    onBookmark={handleBookmark}
                    onDropdownToggle={handleDropdownToggle}
                    optimizeImages={optimizeImages}
                    onOptimizeImages={handleOptimizeImages}
                    theme={theme}
                    onToggleTheme={onToggleTheme}
                    eyeComfort={eyeComfort}
                    onEyeComfortChange={handleEyeComfort}
                    showProgressBar={showProgressBar}
                    onShowProgressBar={handleShowProgressBar}
                    barTimeout={barTimeout}
                    onBarTimeout={handleBarTimeout}
                    barMinOpacity={barMinOpacity}
                    onBarMinOpacity={handleBarMinOpacity}
                />
            </div>
        </div >
    );
};

export default Reader;
