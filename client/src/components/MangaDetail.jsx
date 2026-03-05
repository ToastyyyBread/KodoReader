import React, { useState, useEffect, useRef } from 'react';
import AddSeriesModal from './AddSeriesModal';
import CustomDropdown from './CustomDropdown';
import { getMangaProgress, clearMangaProgress } from './Reader';
import { apiUrl } from '../runtime';

const statusClass = (s) => {
    if (!s) return '';
    const l = s.toLowerCase();
    if (l === 'completed') return 'completed';
    if (l === 'ongoing') return 'ongoing';
    if (l === 'cancelled' || l === 'canceled') return 'cancelled';
    return '';
};

const getDominantColor = (imgEl) => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = 64;
        canvas.height = 64;
        ctx.drawImage(imgEl, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue; // Skip somewhat transparent
            if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) continue; // Skip near white
            if (data[i] < 20 && data[i + 1] < 20 && data[i + 2] < 20) continue; // Skip near black
            r += data[i]; g += data[i + 1]; b += data[i + 2];
            count++;
        }
        if (count > 0) return `${Math.floor(r / count)}, ${Math.floor(g / count)}, ${Math.floor(b / count)}`;
    } catch (e) { console.error('Canvas color extract failed', e); }
    return null;
};

const MangaDetail = ({ manga, onSelectChapter, onBack }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dominantColor, setDominantColor] = useState(null);
    const [showEdit, setShowEdit] = useState(false);
    const [readProgress, setReadProgress] = useState({});
    const [confirmRewatch, setConfirmRewatch] = useState(false);
    const [sortAsc, setSortAsc] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState('default');

    const currentVersionObj = details?.versions?.find(v => v.id === selectedVersion) || details?.versions?.[0];
    const activeVersionId = currentVersionObj?.id || 'default';
    const displayChapters = currentVersionObj ? currentVersionObj.chapters : (details?.chapters || []);

    // Derive displayed hero details based on selected version
    const displayTitle = (activeVersionId !== 'default' && currentVersionObj?.title) ? currentVersionObj.title : details?.title;
    const displayDescription = (activeVersionId !== 'default' && currentVersionObj?.description) ? currentVersionObj.description : details?.description;
    const displayAuthors = (activeVersionId !== 'default' && currentVersionObj?.authors) ? currentVersionObj.authors : details?.authors;
    const displayArtists = (activeVersionId !== 'default' && currentVersionObj?.artists) ? currentVersionObj.artists : details?.artists;
    const displayTags = (activeVersionId !== 'default' && currentVersionObj?.tags?.length > 0) ? currentVersionObj.tags : details?.tags;
    const displayCover = (activeVersionId !== 'default' && currentVersionObj?.cover) ? currentVersionObj.cover : details?.cover;
    const displayStatus = (activeVersionId !== 'default' && currentVersionObj?.status) ? currentVersionObj.status : details?.status;

    // fix jagged covers setting
    const [fixJagged, setFixJagged] = useState(() => localStorage.getItem('kodo-jagged-covers') === 'true');
    useEffect(() => {
        const onStorage = () => setFixJagged(localStorage.getItem('kodo-jagged-covers') === 'true');
        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', onStorage);
        return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onStorage); };
    }, []);

    // readChapters comes from the backend API response (through `details`)
    const readChapters = details?.readChaptersByVersion?.[activeVersionId] || (activeVersionId === 'default' ? details?.readChapters || [] : []);

    // Description scroll mask logic
    const descRef = useRef(null);
    const [descScrollMask, setDescScrollMask] = useState('bottom');

    const updateDescScroll = () => {
        const el = descRef.current;
        if (!el) return;
        if (el.scrollHeight <= el.clientHeight) {
            if (descScrollMask !== 'none') setDescScrollMask('none');
            return;
        }
        const isTop = (el.scrollTop === 0);
        // Add a small buffer (2px) to account for fractional pixel scrolling
        const isBottom = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 2;

        if (isTop && !isBottom) setDescScrollMask('bottom');
        else if (!isTop && isBottom) setDescScrollMask('top');
        else if (!isTop && !isBottom) setDescScrollMask('both');
        else setDescScrollMask('none');
    };

    useEffect(() => {
        if (details?.description) {
            // Need a slight delay to let DOM render and calculate dimensions
            const t = setTimeout(updateDescScroll, 50);
            return () => clearTimeout(t);
        }
    }, [details, activeVersionId]);

    const fetchDetails = () => {
        fetch(apiUrl(`/api/manga/${manga.id}`))
            .then(r => r.json())
            .then(data => {
                setDetails(data);
                const local = localStorage.getItem(`kodo-ver-${manga.id}`);
                if (local && data.versions?.some(v => v.id === local)) {
                    setSelectedVersion(local);
                } else if (data.progress && data.progress.versionId) {
                    setSelectedVersion(data.progress.versionId);
                    localStorage.setItem(`kodo-ver-${manga.id}`, data.progress.versionId);
                }
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchDetails();
    }, [manga.id]);

    // Reload progress every time the detail page shows (user may have just finished reading)
    useEffect(() => {
        const load = () => setReadProgress(getMangaProgress(manga.id));
        load();
        window.addEventListener('focus', load);
        return () => window.removeEventListener('focus', load);
    }, [manga.id]);

    if (loading) return (
        <div style={{ padding: '48px', color: 'var(--muted)', fontSize: '14px' }}>Loading...</div>
    );

    const hasMultipleVersions = details.versions && details.versions.length > 1;

    return (
        <div className="detail-page fade-in">
            {/* Topbar */}
            <div className="topbar">
                <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13.5px' }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Library
                </button>
                <div style={{ marginLeft: 'auto' }}></div>
            </div>

            {/* Hero */}
            <div
                className="detail-hero"
                style={{
                    position: 'relative',
                    ...(dominantColor ? {
                        background: `linear-gradient(to bottom, rgba(${dominantColor}, 0.25) 0%, rgba(${dominantColor}, 0.05) 60%, transparent 100%)`
                    } : {})
                }}
            >
                {/* Action buttons: Rewatch + Edit */}
                <div style={{ position: 'absolute', top: '24px', right: '32px', display: 'flex', gap: 8, alignItems: 'center', minHeight: 36 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {confirmRewatch ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '5px 10px', border: '1px solid rgba(255,255,255,0.12)', height: 36 }}>
                                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>Reset progress?</span>
                                <button
                                    onClick={async () => {
                                        clearMangaProgress(manga.id);
                                        await fetch(apiUrl(`/api/progress/${encodeURIComponent(manga.id)}?versionId=${encodeURIComponent(activeVersionId)}`), { method: 'DELETE' });
                                        setReadProgress({});
                                        setDetails(p => ({
                                            ...p,
                                            readChapters: activeVersionId === 'default' ? [] : p.readChapters,
                                            readChaptersByVersion: { ...p.readChaptersByVersion, [activeVersionId]: [] },
                                            progressByVersion: { ...p.progressByVersion, [activeVersionId]: null },
                                            progress: (p.progress?.versionId === activeVersionId || activeVersionId === 'default') ? null : p.progress
                                        }));
                                        setConfirmRewatch(false);
                                    }}
                                    style={{ fontSize: 12, fontWeight: 700, background: 'rgba(255,80,80,0.25)', border: '1px solid rgba(255,80,80,0.4)', color: '#ff6060', borderRadius: 7, padding: '3px 10px', cursor: 'pointer' }}
                                >Yes</button>
                                <button
                                    onClick={() => setConfirmRewatch(false)}
                                    style={{ fontSize: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', borderRadius: 7, padding: '3px 10px', cursor: 'pointer' }}
                                >No</button>
                            </div>
                        ) : (
                            <button
                                className="btn btn-ghost"
                                title="Reset all reading progress"
                                disabled={!(details?.progressByVersion?.[activeVersionId] || (details.progress?.versionId === activeVersionId && details.progress)) && readChapters.length === 0}
                                style={{
                                    padding: '6px 12px', fontSize: '12.5px', background: 'var(--hero-button-bg)', backdropFilter: 'blur(8px)', overflow: 'hidden', clipPath: 'inset(0 round var(--radius-sm))', height: 36,
                                    opacity: (!(details?.progressByVersion?.[activeVersionId] || (details.progress?.versionId === activeVersionId && details.progress)) && readChapters.length === 0) ? 0.3 : 1
                                }}
                                onClick={() => setConfirmRewatch(true)}
                            >
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 6 }}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Rewatch
                            </button>
                        )}
                        <button
                            className="btn btn-ghost"
                            onClick={() => setShowEdit(true)}
                            style={{ padding: '6px 12px', fontSize: '12.5px', background: 'var(--hero-button-bg)', backdropFilter: 'blur(8px)', overflow: 'hidden', clipPath: 'inset(0 round var(--radius-sm))', height: 36 }}
                        >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit
                        </button>
                        {/* Version dropdown */}
                        {hasMultipleVersions && (
                            <div style={{ minWidth: '130px', maxWidth: '200px' }}>
                                <CustomDropdown
                                    value={activeVersionId}
                                    onChange={(val) => {
                                        setSelectedVersion(val);
                                        localStorage.setItem(`kodo-ver-${manga.id}`, val);
                                    }}
                                    direction="down"
                                    items={details.versions.map(v => ({ value: v.id, label: v.name }))}
                                />
                            </div>
                        )}
                    </div>
                </div>
                {displayCover
                    ? <div className={`detail-cover-wrapper ${fixJagged ? 'fix-jagged' : ''}`}>
                        <img
                            className="detail-cover"
                            src={apiUrl(displayCover)}
                            alt={displayTitle}
                            crossOrigin="anonymous"
                            onLoad={(e) => {
                                const color = getDominantColor(e.target);
                                if (color) setDominantColor(color);
                            }}
                        />
                    </div>
                    : <div className="detail-cover-wrapper" style={{ background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '13px', fontWeight: 500, border: '1px solid var(--border)' }}>No Cover</div>
                }
                <div className="detail-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h1 className="detail-title" style={{ margin: 0 }}>
                            {displayTitle}
                        </h1>
                    </div>

                    <div className="detail-meta-grid">
                        {displayAuthors && (
                            <div className="detail-meta-group">
                                <span className="meta-label">Author(s)</span>
                                <span className="meta-value">{displayAuthors}</span>
                            </div>
                        )}
                        {displayArtists && (
                            <div className="detail-meta-group">
                                <span className="meta-label">Artist(s)</span>
                                <span className="meta-value">{displayArtists}</span>
                            </div>
                        )}
                        {details.releaseYear && (
                            <div className="detail-meta-group">
                                <span className="meta-label">Release Year</span>
                                <span className="meta-value">{details.releaseYear}</span>
                            </div>
                        )}
                    </div>

                    {displayDescription && (
                        <p
                            className={`detail-desc mask-${descScrollMask}`}
                            ref={descRef}
                            onScroll={updateDescScroll}
                        >
                            {displayDescription}
                        </p>
                    )}

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
                        {details?.isNsfw && (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#fff', background: '#e11d48', padding: '2px 0', minWidth: 38, borderRadius: '12px', border: '1px solid #be123c', letterSpacing: '0.5px', boxSizing: 'border-box' }}>
                                18+
                            </span>
                        )}
                        {displayStatus && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <span className={`status-dot ${statusClass(displayStatus)}`} />
                                <span style={{ textTransform: 'capitalize' }}>{displayStatus}</span>
                            </span>
                        )}
                        {details.language && (
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>🌐 {details.language}</span>
                        )}
                        <span style={{ fontSize: '12.5px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <svg width="15" height="15" viewBox="0 0 122.88 96.16" xmlns="http://www.w3.org/2000/svg">
                                <g>
                                    <path fill="currentColor" d="M108.82,14.33c-0.02-0.18-0.05-0.37-0.05-0.57c0-0.19,0.01-0.38,0.05-0.57V0.7 c-8.76-0.83-17.79,0.13-25.68,3.12c-7.37,2.8-13.73,7.39-17.86,13.98v71.15c6.43-4.29,13-7.82,19.75-10.22 c7.69-2.74,15.6-4.04,23.79-3.39V14.33L108.82,14.33L108.82,14.33z M57.71,88.21V17.68C53.74,10.68,47.32,6,40.08,3.22 C31.87,0.08,22.64-0.63,14.6,0.51l-0.43,75.05c8.77-0.32,17.36,0.8,25.43,3.44C46.03,81.09,52.12,84.16,57.71,88.21L57.71,88.21 L57.71,88.21z" />
                                    <path fill="currentColor" d="M6.62,79.25l0.35-61.69H0v78.5c9.57-2.47,19.17-4.04,28.85-4.11c8.93-0.05,17.86,1.19,26.81,4.22 c-5.56-4.5-11.76-7.82-18.38-9.97c-8.33-2.72-17.34-3.62-26.58-2.83c-2.09,0.17-3.91-1.38-4.09-3.46 C6.59,79.68,6.59,79.46,6.62,79.25L6.62,79.25L6.62,79.25z M68.95,95.59c8.37-2.63,16.72-3.71,25.08-3.66 c9.67,0.05,19.28,1.64,28.85,4.11V17.56h-6.48v62.03c0,2.09-1.7,3.79-3.79,3.79c-0.3,0-0.59-0.03-0.87-0.1 c-8.29-1.3-16.32-0.22-24.16,2.57C81.26,88.1,75.06,91.47,68.95,95.59L68.95,95.59L68.95,95.59z" />
                                </g>
                            </svg>
                            {displayChapters?.length || 0} chapters
                        </span>
                    </div>

                    {/* Progress Bar & Actions */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
                        <button
                            className="btn btn-primary"
                            style={{ padding: '8px 24px', fontSize: '13.5px', gap: '8px' }}
                            onClick={() => {
                                setReadProgress(getMangaProgress(manga.id));
                                const activeProgress = details?.progressByVersion?.[activeVersionId] || (details.progress?.versionId === activeVersionId ? details.progress : null);
                                if (activeProgress?.chapterId) {
                                    onSelectChapter(activeProgress.chapterId, displayChapters, activeVersionId);
                                } else if (displayChapters?.length > 0) {
                                    onSelectChapter(displayChapters[0], displayChapters, activeVersionId);
                                }
                            }}
                        >
                            {!(details?.progressByVersion?.[activeVersionId] || (details.progress?.versionId === activeVersionId && details.progress)) ? (
                                <>
                                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                    Read First
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 010 1.393z" />
                                    </svg>
                                    Resume
                                </>
                            )}
                        </button>

                        {(details?.progressByVersion?.[activeVersionId] || (details.progress?.versionId === activeVersionId && details.progress)) && (() => {
                            const prog = details.progressByVersion?.[activeVersionId] || details.progress;
                            const localProg = readProgress[prog.chapterId];
                            const scrollPct = localProg?.scroll != null ? Math.round(localProg.scroll * 100) : null;
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Last Read</span>
                                    <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        Chapter {(prog.chapterId || '').split(' - ').pop()}{scrollPct != null ? ` · ${scrollPct}% Progress` : ` · ${prog.page === 0 ? 0 : Math.round((prog.page / Math.max(prog.totalPages || 1, 1)) * 100) || 0}% Progress`}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>

                    {displayTags?.length > 0 && (
                        <div className="detail-tags">
                            {displayTags.map(t => <span key={t} className="tag">#{t}</span>)}
                        </div>
                    )}
                </div>
            </div>

            {/* Chapter list */}
            <div className="chapter-list">
                <div className="chapter-list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span>CHAPTERS · {displayChapters?.length || 0}</span>
                    <button
                        onClick={() => setSortAsc(!sortAsc)}
                        style={{
                            background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase'
                        }}
                    >
                        {sortAsc ? 'Lowest to Highest' : 'Highest to Lowest'}
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ transform: sortAsc ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {(() => {
                    const hasZeroChapter = displayChapters?.some(c => /(?:^|[\s\-_])0(0)?(?:[\s\-_]|\.cbz|$)/i.test(c));
                    const chapterIndexOffset = hasZeroChapter ? 0 : 1;
                    return (sortAsc ? displayChapters : [...(displayChapters || [])].reverse())?.map((ch, i) => {
                        // Because we reverse, the original chronological index needs to be calculated
                        const chronoIndex = sortAsc ? i : displayChapters.length - 1 - i;

                        const progl = readProgress[ch];
                        const isRead = readChapters.includes(ch);

                        const activeProgress = details?.progressByVersion?.[activeVersionId] || (details.progress?.versionId === activeVersionId ? details.progress : null);
                        const isLastRead = (activeProgress?.chapterId === ch);
                        const chProgress = progl
                            ? (progl.scroll != null ? progl.scroll : (progl.page != null && displayChapters ? progl.page / Math.max(1, displayChapters.length - 1) : 0))
                            : 0;
                        const hasProgress = !isRead && chProgress > 0.01;

                        return (
                            <button
                                key={ch}
                                className={`chapter-item ${isRead ? 'read' : ''}`}
                                onClick={() => {
                                    // Save progress to local state before switching
                                    if (details.progress?.chapterId && details.progress.chapterId !== ch && window.location.pathname.includes('/reader')) {
                                        // do nothing to the actual storage, the reader unmount will handle save.
                                    }
                                    setReadProgress(getMangaProgress(manga.id)); // refresh before entering
                                    onSelectChapter(ch, displayChapters, activeVersionId);
                                }}
                                style={{ opacity: isRead ? 0.6 : 1 }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="chapter-num" style={{ color: isRead ? 'var(--muted)' : 'var(--text)' }}>{ch}</span>

                                        {/* Viewed badge */}
                                        {isRead && (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: 4,
                                                fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                                padding: '2px 7px', borderRadius: 4,
                                                background: 'rgba(255,255,255,0.06)',
                                                color: 'var(--muted)',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                textTransform: 'uppercase', flexShrink: 0,
                                            }}>
                                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                Viewed
                                            </span>
                                        )}

                                        {/* Last Read badge */}
                                        {isLastRead && (
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                                padding: '2px 7px', borderRadius: 20,
                                                background: 'rgba(255,255,255,0.1)',
                                                color: 'var(--accent)',
                                                border: '1px solid rgba(255,255,255,0.15)',
                                                textTransform: 'uppercase',
                                                flexShrink: 0,
                                            }}>
                                                Last Read
                                            </span>
                                        )}
                                    </div>

                                    {/* Mini progress bar for in-progress chapters */}
                                    {hasProgress && (
                                        <div style={{
                                            height: 2, borderRadius: 2,
                                            background: 'rgba(255,255,255,0.08)',
                                            width: '100%', overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${Math.min(100, chProgress * 100)}%`,
                                                background: 'var(--accent)',
                                                borderRadius: 2,
                                            }} />
                                        </div>
                                    )}
                                </div>
                                <span className="chapter-meta">#{chronoIndex + chapterIndexOffset}</span>
                            </button>
                        );
                    })
                })()}

                {/* END MARKER */}
                {details.chapters?.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', opacity: 0.5, gap: '12px' }}>
                        <div style={{ height: 1, width: '40px', background: 'var(--border)' }} />
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', textTransform: 'uppercase' }}>End</span>
                        <div style={{ height: 1, width: '40px', background: 'var(--border)' }} />
                    </div>
                )}
            </div>

            {
                showEdit && (
                    <AddSeriesModal
                        editManga={details}
                        onClose={() => setShowEdit(false)}
                        onAdd={(updated) => {
                            setShowEdit(false);
                            fetchDetails();
                        }}
                        onDelete={() => {
                            setShowEdit(false);
                            onBack();
                        }}
                    />
                )
            }
        </div >
    );
};


export default MangaDetail;
