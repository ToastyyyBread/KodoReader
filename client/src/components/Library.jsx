import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import emptyLottie from '../assets/empty file transparent.lottie?url';
import { apiUrl } from '../runtime';

import CustomDropdown from './CustomDropdown';

let initialLibraryLoad = true;

const MangaCard = ({ manga, onClick, fixJagged, rotatingCovers, rotatingCoversInterval, gridSize, nsfwDisplay }) => {
    const hasVersions = manga.versions && manga.versions.length > 0;
    const isBlur = nsfwDisplay === 'blur' && manga.isNsfw;

    let finishedMain = false;
    let finishedVersionsCount = 0;

    if (manga.chapterCount > 0 && manga.readChapters?.length >= manga.chapterCount) {
        finishedMain = true;
    }
    manga.versions?.forEach(v => {
        if (v.chapterCount > 0 && manga.readChaptersByVersion?.[v.id]?.length >= v.chapterCount) {
            finishedVersionsCount++;
        }
    });

    const totalFinished = (finishedMain ? 1 : 0) + finishedVersionsCount;
    const totalSeriesCount = 1 + (manga.versions?.length || 0);
    const finishedText = totalFinished > 0
        ? (totalSeriesCount > 1 ? `${totalFinished} Series End` : 'Finished')
        : null;

    // Detect newly added chapter (added after last read progress save)
    const lastReadTime = (() => {
        const prog = manga.progress;
        // We don't have a timestamp on progress, so we use 'firstRead' approximation:
        // Show "New Ch." if manga.lastChapterAdded is within 7 days and user has progress but read ch < total 
        return 0;
    })();
    const NEW_CHAPTER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const hasProgress = !!(manga.progress || Object.keys(manga.progressByVersion || {}).length > 0);
    const notFullyFinished = !finishedText;
    const hasNewChapter = notFullyFinished && hasProgress &&
        manga.lastChapterAdded > 0 &&
        (Date.now() - manga.lastChapterAdded) < NEW_CHAPTER_WINDOW_MS &&
        (manga.readChapters?.length || 0) < manga.chapterCount;

    const validCovers = useMemo(() => {
        const covers = [];
        if (manga.cover) covers.push(manga.cover);
        if (manga.versions) {
            manga.versions.forEach(v => {
                if (v.cover && !covers.includes(v.cover)) covers.push(v.cover);
            });
        }
        return covers;
    }, [manga.cover, manga.versions]);

    const [coverIndex, setCoverIndex] = useState(0);

    useEffect(() => {
        if (!rotatingCovers) {
            setCoverIndex(0);
            return;
        }
        if (validCovers.length > 1) {
            const timer = setInterval(() => {
                setCoverIndex(prev => (prev + 1) % validCovers.length);
            }, rotatingCoversInterval || 3500);
            return () => clearInterval(timer);
        }
    }, [validCovers.length, rotatingCovers, rotatingCoversInterval]);

    const isSmallGrid = gridSize && gridSize <= 190;

    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <div className="manga-card" onClick={onClick} style={{ flex: 1 }}>
                <div className="manga-card-img">
                    {validCovers.length > 0 ? (
                        validCovers.map((cov, i) => (
                            <img
                                key={cov}
                                src={apiUrl(cov)}
                                alt={manga.title}
                                loading="lazy"
                                style={{
                                    position: 'absolute',
                                    top: 0, left: 0, width: '100%', height: '100%',
                                    objectFit: 'cover',
                                    opacity: coverIndex === i ? 1 : 0,
                                    transition: 'opacity 0.8s ease-in-out, transform 0.5s cubic-bezier(.4,0,.2,1)',
                                    imageRendering: fixJagged ? 'auto' : undefined,
                                    filter: isBlur ? 'blur(16px) saturate(1.5)' : undefined,
                                }}
                                className={fixJagged ? 'fix-jagged' : ''}
                            />
                        ))
                    ) : (
                        <div style={{ position: 'absolute', inset: 0, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '11px', gap: '8px' }}>
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="3" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <path strokeLinecap="round" d="M21 15l-5-5L5 21" />
                            </svg>
                            <span style={{ fontWeight: 600 }}>No cover</span>
                        </div>
                    )}
                </div>
                {/* Top-left status badges */}
                <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 3 }}>
                    {manga.isNsfw && (
                        <span className="chapter-badge" style={{ position: 'static', background: '#e11d48', color: '#fff', minWidth: 34, textAlign: 'center', justifyContent: 'center', padding: '2px 6px', boxSizing: 'border-box', fontWeight: 800 }}>
                            18+
                        </span>
                    )}
                    {finishedText && (
                        <span className="chapter-badge" style={{ position: 'static', background: 'rgba(15,168,138,0.92)', color: '#fff' }}>
                            {finishedText}
                        </span>
                    )}
                </div>
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, zIndex: 3 }}>
                    {hasVersions && !isSmallGrid && (
                        <span className="chapter-badge" style={{ position: 'static', background: 'var(--chapter-badge)', color: 'var(--chapter-text)' }}>
                            {manga.versions.length + 1} Editions
                        </span>
                    )}
                    <span className="chapter-badge" style={{ position: 'static' }}>{manga.chapterCount || 0}</span>
                </div>
                <div className="manga-card-overlay">
                    <div className="manga-card-title">{manga.title}</div>
                    {manga.authors && <div className="manga-card-meta">{manga.authors}</div>}
                    {manga.tags?.length > 0 && (
                        <div className="manga-card-tags">
                            {manga.tags?.slice(0, 3).map(t => <span key={t} className="tag" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '9.5px' }}>#{t}</span>)}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};

const TagFilterBar = ({ tags, activeTag, setActiveTag, activeSort, setActiveSort, sortOptions }) => {
    const filterRef = React.useRef(null);
    const [canLeft, setCanLeft] = React.useState(false);
    const [canRight, setCanRight] = React.useState(false);

    const checkScroll = () => {
        const el = filterRef.current;
        if (!el) return;
        setCanLeft(el.scrollLeft > 2);
        setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    };

    React.useEffect(() => {
        checkScroll();
        const el = filterRef.current;
        if (el) el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        return () => {
            if (el) el.removeEventListener('scroll', checkScroll);
            window.removeEventListener('resize', checkScroll);
        };
    }, [tags]);

    const scrollDir = (dir) => {
        filterRef.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });
    };

    const arrowStyle = (visible) => ({
        background: 'none', border: 'none', color: 'var(--muted)',
        cursor: visible ? 'pointer' : 'default',
        padding: '0 6px', display: 'flex', alignItems: 'center', flexShrink: 0,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.15s',
    });

    const nonAllTags = tags.filter(t => t !== 'All');

    return (
        <div style={{ display: 'flex', alignItems: 'stretch', padding: '10px 24px', gap: 0, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
            {/* Left: Filter label + sort dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingRight: 12, borderRight: '1px solid var(--border)', marginRight: 8 }}>
                <svg width="13" height="13" viewBox="0 0 971.986 971.986" fill="currentColor" style={{ opacity: 0.5, flexShrink: 0 }}>
                    <path d="M370.216,459.3c10.2,11.1,15.8,25.6,15.8,40.6v442c0,26.601,32.1,40.101,51.1,21.4l123.3-141.3 c16.5-19.8,25.6-29.601,25.6-49.2V500c0-15,5.7-29.5,15.8-40.601L955.615,75.5c26.5-28.8,6.101-75.5-33.1-75.5h-873 c-39.2,0-59.7,46.6-33.1,75.5L370.216,459.3z" />
                </svg>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Filter</span>
                <CustomDropdown
                    value={activeSort}
                    onChange={(val) => setActiveSort(val)}
                    items={sortOptions}
                />
            </div>

            {/* Pinned "All" chip */}
            {tags.includes('All') && (
                <>
                    <button
                        className={`filter-chip ${activeTag === 'All' ? 'active' : ''}`}
                        onClick={() => setActiveTag('All')}
                        style={{ flexShrink: 0, marginRight: 4 }}
                    >
                        All
                    </button>
                    {nonAllTags.length > 0 && (
                        <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, margin: '4px 4px 4px 0' }} />
                    )}
                </>
            )}

            {/* Arrow Left */}
            <button onClick={() => scrollDir(-1)} style={arrowStyle(canLeft)}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Scrollable tags (no scrollbar) */}
            {nonAllTags.length > 0 && (
                <div
                    ref={filterRef}
                    style={{
                        display: 'flex', gap: '8px',
                        overflowX: 'auto', flex: 1,
                        scrollbarWidth: 'none', msOverflowStyle: 'none',
                        alignItems: 'center',
                    }}
                    className="filter-tags-inner"
                >
                    {nonAllTags.map(t => (
                        <button key={t} className={`filter-chip ${activeTag === t ? 'active' : ''}`} onClick={() => setActiveTag(t)}>
                            {t}
                        </button>
                    ))}
                </div>
            )}

            {/* Arrow Right */}
            <button onClick={() => scrollDir(1)} style={arrowStyle(canRight)}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
};

const Library = ({ onSelectManga, refresh, activeCategory }) => {
    const [manga, setManga] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tags, setTags] = useState([]);
    const [activeTag, setActiveTag] = useState('All');
    const [activeSort, setActiveSort] = useState('Newest');
    const [spinning, setSpinning] = useState(() => initialLibraryLoad);
    const [gridSize, setGridSize] = useState(() => parseInt(localStorage.getItem('kodo-grid-size')) || 220);
    const [fixJagged, setFixJagged] = useState(() => localStorage.getItem('kodo-jagged-covers') !== 'false');
    const [rotatingCovers, setRotatingCovers] = useState(() => localStorage.getItem('kodo-rotating-covers') !== 'false');
    const [rotatingCoversInterval, setRotatingCoversInterval] = useState(() => parseInt(localStorage.getItem('kodo-rotating-covers-interval')) || 3500);
    const [nsfwDisplay, setNsfwDisplay] = useState(() => localStorage.getItem('kodo-nsfw-display') || 'blur');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Listen for changes from Settings page
    useEffect(() => {
        const onStorage = () => {
            setGridSize(parseInt(localStorage.getItem('kodo-grid-size')) || 220);
            setFixJagged(localStorage.getItem('kodo-jagged-covers') !== 'false');
            setRotatingCovers(localStorage.getItem('kodo-rotating-covers') !== 'false');
            setRotatingCoversInterval(parseInt(localStorage.getItem('kodo-rotating-covers-interval')) || 3500);
            setNsfwDisplay(localStorage.getItem('kodo-nsfw-display') || 'blur');
        };
        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', onStorage);
        window.addEventListener('kodo-settings-changed', onStorage);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('focus', onStorage);
            window.removeEventListener('kodo-settings-changed', onStorage);
        };
    }, []);

    const retryCountRef = React.useRef(0);
    const retryTimerRef = React.useRef(null);
    const abortRef = React.useRef(null);

    const applyLibraryData = useCallback((data) => {
        const filteredManga = data.filter(m => {
            return !activeCategory || (m.categories && m.categories.includes(activeCategory));
        });
        setManga(filteredManga);

        const allTags = new Set();
        filteredManga.forEach(m => {
            m.tags?.forEach(t => allTags.add(t));
            m.versions?.forEach(v => {
                v.tags?.forEach(vt => allTags.add(vt));
            });
        });
        setTags(['All', ...allTags]);
    }, [activeCategory]);

    const load = useCallback((silent = false) => {
        if (!silent) setLoading(true);

        // Abort any pending background refresh from a previous load cycle
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }

        fetch(apiUrl('/api/manga'))
            .then(async (r) => {
                const cacheState = String(r.headers.get('x-kodo-library-cache') || '').toLowerCase();
                const data = await r.json();
                return { data, cacheState };
            })
            .then(({ data, cacheState }) => {
                retryCountRef.current = 0;

                // Always show whatever data we have immediately
                applyLibraryData(data);
                if (!silent) setLoading(false);

                if (cacheState === 'warming') {
                    // Full cache is still building — fetch the complete data
                    // in the background and silently update when ready
                    const controller = new AbortController();
                    abortRef.current = controller;
                    fetch(apiUrl('/api/manga?wait=true'), { signal: controller.signal })
                        .then(r2 => r2.json())
                        .then(fullData => {
                            applyLibraryData(fullData);
                        })
                        .catch(() => {
                            // Silently ignore — we already have data displayed
                        });
                }
            })
            .catch(() => {
                // Server might not be ready yet; retry with short delay.
                if (retryCountRef.current < 20) {
                    retryCountRef.current++;
                    const delay = Math.min(500 * retryCountRef.current, 3000);
                    retryTimerRef.current = setTimeout(() => load(silent), delay);
                } else if (!silent) {
                    setLoading(false);
                }
            });
    }, [applyLibraryData]);

    useEffect(() => {
        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            if (abortRef.current) {
                abortRef.current.abort();
                abortRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        load(false);
    }, [load, refresh]);

    useEffect(() => {
        const onHardRefresh = () => load(false);
        const onSeriesAdded = (e) => {
            const added = e?.detail || {};
            if (!added.id) return;
            setManga((prev) => {
                const optimistic = {
                    id: added.id,
                    title: added.title || added.id,
                    authors: added.authors || '',
                    artists: added.artists || '',
                    tags: Array.isArray(added.tags) ? added.tags : [],
                    language: added.language || '',
                    status: added.status || '',
                    categories: Array.isArray(added.categories) ? added.categories : [],
                    description: added.description || '',
                    releaseYear: added.releaseYear || '',
                    isNsfw: !!added.isNsfw,
                    chapterCount: Number(added.chapterCount || 0),
                    versions: [],
                    cover: added.cover || null,
                    progress: null,
                    progressByVersion: {},
                    readChapters: [],
                    readChaptersByVersion: {},
                    lastChapterAdded: Date.now(),
                };
                const existingIdx = prev.findIndex(m => m.id === added.id);
                if (existingIdx !== -1) {
                    const next = [...prev];
                    next[existingIdx] = { ...next[existingIdx], ...optimistic };
                    return next;
                }
                return [...prev, optimistic];
            });
            load(true);
        };

        window.addEventListener('kodo-library-hard-refresh', onHardRefresh);
        window.addEventListener('kodo-library-series-added', onSeriesAdded);
        return () => {
            window.removeEventListener('kodo-library-hard-refresh', onHardRefresh);
            window.removeEventListener('kodo-library-series-added', onSeriesAdded);
        };
    }, [load]);

    useEffect(() => {
        if (initialLibraryLoad) {
            initialLibraryLoad = false;
            const timer = setTimeout(() => setSpinning(false), 4500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleRefresh = () => {
        setSpinning(true);
        setLoading(true);
        setIsRefreshing(true);

        // Manual refresh should wait for the full rebuild response.
        const minDelay = new Promise(r => setTimeout(r, 800));
        const fullRefresh = fetch(apiUrl('/api/manga?refresh=true')).then(r => r.json());

        Promise.all([fullRefresh, minDelay])
            .then(([data]) => {
                applyLibraryData(data);
            })
            .catch(() => { })
            .finally(() => {
                setLoading(false);
                setSpinning(false);
                setIsRefreshing(false);
            });
    };

    let filtered = manga.filter(m => {
        if (nsfwDisplay === 'hide' && m.isNsfw) return false;
        const matchTag = activeTag === 'All' || m.tags?.includes(activeTag) || m.versions?.some(v => v.tags?.includes(activeTag));
        const s = search.toLowerCase();
        const matchSearch = !search ||
            m.title.toLowerCase().includes(s) ||
            m.authors?.toLowerCase().includes(s) ||
            m.versions?.some(v => v.title?.toLowerCase().includes(s) || v.authors?.toLowerCase().includes(s));
        return matchTag && matchSearch;
    });

    if (activeSort === 'Newest') {
        filtered = [...filtered].reverse();
    } else if (activeSort === 'Oldest') {
        // base loaded order
    } else if (activeSort === 'LastRead') {
        filtered = filtered.filter(m => m.progress || (m.progressByVersion && Object.keys(m.progressByVersion).length > 0)).reverse().slice(0, 3);
    } else if (activeSort === 'Multiple') {
        filtered = filtered.filter(m => m.versions?.length > 0).reverse();
    } else if (activeSort === 'Finished') {
        filtered = filtered.filter(m => {
            return (m.chapterCount > 0 && m.readChapters?.length >= m.chapterCount) ||
                m.versions?.some(v => v.chapterCount > 0 && m.readChaptersByVersion?.[v.id]?.length >= v.chapterCount);
        }).reverse();
    } else if (activeSort === '18+') {
        filtered = filtered.filter(m => m.isNsfw).reverse();
    } else if (['Completed', 'Ongoing', 'Hiatus', 'Cancelled'].includes(activeSort)) {
        filtered = filtered.filter(m => {
            const lowSort = activeSort.toLowerCase();
            const mainMatch = m.status?.toLowerCase() === lowSort || (lowSort === 'cancelled' && m.status?.toLowerCase() === 'canceled');
            const versMatch = m.versions?.some(v => v.status?.toLowerCase() === lowSort || (lowSort === 'cancelled' && v.status?.toLowerCase() === 'canceled'));
            return mainMatch || versMatch;
        }).reverse();
    }

    const sortOptions = [
        { value: 'Newest', label: 'Newest' },
        { value: 'Oldest', label: 'Oldest' },
        { value: 'LastRead', label: 'Last Read' },
        { value: 'Multiple', label: 'Multiple Series' },
        { value: 'Finished', label: 'Finished Reading' }
    ];

    const statuses = new Set();
    manga.forEach(m => {
        if (m.status) statuses.add(m.status.toLowerCase());
        m.versions?.forEach(v => {
            if (v.status) statuses.add(v.status.toLowerCase());
        });
    });

    if (statuses.has('completed')) sortOptions.push({ value: 'Completed', label: 'Completed' });
    if (statuses.has('ongoing')) sortOptions.push({ value: 'Ongoing', label: 'Ongoing' });
    if (statuses.has('hiatus')) sortOptions.push({ value: 'Hiatus', label: 'Hiatus' });
    if (statuses.has('cancelled') || statuses.has('canceled')) sortOptions.push({ value: 'Cancelled', label: 'Cancelled' });
    if (manga.some(m => m.isNsfw)) sortOptions.push({ value: '18+', label: '18+ Only' });

    const libraryPageStyle = loading
        ? {
            '--grid-width': `${gridSize}px`,
            minHeight: '100%',
            height: '100%',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }
        : { '--grid-width': `${gridSize}px` };

    return (
        <>
            {!loading && (
                <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)' }}>
                    {/* Topbar */}
                    <div className="topbar" style={{ position: 'static' }}>
                        <h2 className="topbar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{activeCategory ? activeCategory : 'Library'}</h2>
                        <div className="topbar-spacer" />
                        <div className="search-box">
                            <svg className="search-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                            </svg>
                            <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button className={`icon-btn ${spinning ? 'spinning' : ''}`} onClick={handleRefresh} title="Refresh">
                            <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118.04 122.88" width="14" height="14" fill="currentColor">
                                <path d="M16.08,59.26A8,8,0,0,1,0,59.26a59,59,0,0,1,97.13-45V8a8,8,0,1,1,16.08,0V33.35a8,8,0,0,1-8,8L80.82,43.62a8,8,0,1,1-1.44-15.95l8-.73A43,43,0,0,0,16.08,59.26Zm22.77,19.6a8,8,0,0,1,1.44,16l-10.08.91A42.95,42.95,0,0,0,102,63.86a8,8,0,0,1,16.08,0A59,59,0,0,1,22.3,110v4.18a8,8,0,0,1-16.08,0V89.14h0a8,8,0,0,1,7.29-8l25.31-2.3Z" />
                            </svg>
                        </button>
                    </div>

                    <TagFilterBar
                        tags={tags}
                        activeTag={activeTag}
                        setActiveTag={setActiveTag}
                        activeSort={activeSort}
                        setActiveSort={setActiveSort}
                        sortOptions={sortOptions}
                    />
                </div>
            )}





            {/* Grid */}
            <div className="library-page" style={libraryPageStyle}>
                {loading ? (
                    <div className="library-loading-center">
                        <div className="kodo-splash-text">Kōdo</div>
                        <div className="kodo-splash-subtext">
                            {isRefreshing ? 'Refreshing library, please wait' : 'Loading library, please wait'}
                            <span className="kodo-wait-dots" aria-hidden="true">
                                <span />
                                <span />
                                <span />
                            </span>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state" style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        minHeight: '60vh', textAlign: 'center', color: 'var(--muted)'
                    }}>
                        <div style={{ width: 300, height: 300, marginBottom: 16 }}>
                            <DotLottieReact src={emptyLottie} loop autoplay />
                        </div>
                        <p style={{ marginTop: 0 }}><strong>No series    found</strong></p>
                        <p style={{ fontSize: '12px' }}>Add series using the sidebar, or put folders in the /manga directory.</p>
                    </div>
                ) : (
                    <div className="manga-grid">
                        {filtered.map(m => <MangaCard key={m.id} manga={m} fixJagged={fixJagged} rotatingCovers={rotatingCovers} rotatingCoversInterval={rotatingCoversInterval} gridSize={gridSize} nsfwDisplay={nsfwDisplay} onClick={() => onSelectManga(m)} />)}
                    </div>
                )}
            </div>
        </>
    );
};

export default Library;

