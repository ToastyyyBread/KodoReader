import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchBookmarks, deleteBookmarkAsync } from './Reader';
import { apiUrl } from '../runtime';
import CustomDropdown from './CustomDropdown';

/* ── Helper: extract a numeric chapter number for sorting ────── */
const extractChapterNumber = (chapterId) => {
    if (!chapterId) return 0;
    const m = String(chapterId).match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
};

/* ── Star icon (outline / filled) ───────────────────────────── */
const StarIcon = ({ filled, size = 14 }) =>
    filled ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );

/* ── Bookmark card ───────────────────────────────────────────── */
const BookmarkCard = ({ bm, onNavigate, onDelete, onToggleFavorite }) => {
    const isFav = !!bm.favorite;

    return (
        <div
            onClick={() => onNavigate(bm)}
            style={{
                background: 'var(--surface)',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                border: `1px solid ${isFav ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
                transition: 'transform 0.15s, box-shadow 0.15s',
                position: 'relative',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
            }}
        >
            {/* Thumbnail */}
            <div style={{ width: '100%', height: 220, background: 'var(--surface2)', overflow: 'hidden' }}>
                {bm.thumbnail
                    ? <img
                        src={bm.thumbnail.startsWith('http') ? bm.thumbnail : apiUrl(bm.thumbnail)}
                        alt="Bookmark"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
                        No Preview
                    </div>
                }
            </div>

            {/* Info bar */}
            <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    Page {bm.page + 1}
                </div>
                {/* Favorite star */}
                <button
                    onClick={e => { e.stopPropagation(); onToggleFavorite(bm.id, !isFav); }}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '2px 4px', borderRadius: 6,
                        color: isFav ? '#f59e0b' : 'var(--muted)',
                        display: 'flex', alignItems: 'center',
                        transition: 'color 0.15s, transform 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#f59e0b'; e.currentTarget.style.transform = 'scale(1.2)'; }}
                    onMouseLeave={e => {
                        e.currentTarget.style.color = isFav ? '#f59e0b' : 'var(--muted)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <StarIcon filled={isFav} size={15} />
                </button>
            </div>

            {/* Delete button (top-right, over thumbnail) */}
            <button
                onClick={e => onDelete(bm.id, e)}
                title="Remove bookmark"
                style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.7)', borderRadius: 8,
                    width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 14, opacity: 0.6,
                    transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
            >✕</button>
        </div>
    );
};

/* ── Main component ──────────────────────────────────────────── */
const BookmarksPage = ({ onNavigateToBookmark }) => {
    const [bookmarks, setBookmarks] = useState([]);
    const [selectedManga, setSelectedManga] = useState(null);
    const [apiManga, setApiManga] = useState([]);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');   // series filter on main view
    const [favFilter, setFavFilter] = useState('All');          // 'All' | 'Favorites'

    const loadBookmarks = useCallback(async () => {
        const data = await fetchBookmarks(apiUrl(''));
        setBookmarks(data);
    }, []);

    useEffect(() => {
        loadBookmarks();
        fetch(apiUrl('/api/manga')).then(r => r.json()).then(setApiManga).catch(() => { });
    }, [loadBookmarks]);

    /* Optimistic favorite toggle ─────────────────────────────── */
    const handleToggleFavorite = useCallback(async (id, favorite) => {
        // Optimistic UI update immediately
        setBookmarks(prev => prev.map(b => b.id === id ? { ...b, favorite } : b));
        try {
            const res = await fetch(apiUrl(`/api/bookmarks/${id}/favorite`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ favorite }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }));
                console.error('[Bookmark] favorite PATCH failed:', err);
                // Revert – reload fresh from server
                loadBookmarks();
            }
            // On success the server already persisted it; no extra action needed
        } catch (err) {
            console.error('[Bookmark] favorite PATCH error:', err);
            loadBookmarks(); // revert to server state
        }
    }, [loadBookmarks]);

    /* Delete ─────────────────────────────────────────────────── */
    const handleDelete = useCallback(async (id, e) => {
        e.stopPropagation();
        await deleteBookmarkAsync(apiUrl(''), id);
        loadBookmarks();
    }, [loadBookmarks]);

    /* Grouped by manga ───────────────────────────────────────── */
    const grouped = useMemo(() => {
        const g = {};
        bookmarks.forEach(b => {
            if (!g[b.mangaId]) g[b.mangaId] = { mangaId: b.mangaId, mangaTitle: b.mangaTitle, items: [] };
            g[b.mangaId].items.push(b);
        });
        return g;
    }, [bookmarks]);

    const mangaList = useMemo(() => Object.values(grouped), [grouped]);

    /* Series names for main-view filter chips ────────────────── */
    const seriesNames = useMemo(() => {
        const names = mangaList.map(g => g.mangaTitle).filter(Boolean);
        return ['All', ...new Set(names)];
    }, [mangaList]);

    /* Filtered manga list (main view) ────────────────────────── */
    const filteredMangaList = useMemo(() => mangaList.filter(g => {
        const matchFilter = activeFilter === 'All' || g.mangaTitle === activeFilter;
        const s = search.toLowerCase();
        const matchSearch = !search || g.mangaTitle?.toLowerCase().includes(s);
        return matchFilter && matchSearch;
    }), [mangaList, activeFilter, search]);

    /* ── DETAIL VIEW ─────────────────────────────────────────── */
    if (selectedManga) {
        const group = grouped[selectedManga];
        if (!group) { setSelectedManga(null); return null; }

        // Group by chapter
        const chapterMap = {};
        group.items.forEach(bm => {
            const ch = bm.chapterId || 'Unknown';
            if (!chapterMap[ch]) chapterMap[ch] = [];
            chapterMap[ch].push(bm);
        });

        // Sort chapters descending
        const allChapterGroups = Object.entries(chapterMap)
            .map(([chapterId, items]) => ({
                chapterId,
                chapterNum: extractChapterNumber(chapterId),
                items: items.sort((a, b) => (a.page ?? 0) - (b.page ?? 0)),
            }))
            .sort((a, b) => b.chapterNum - a.chapterNum);

        // Apply favorites filter to chapter groups
        const chapterGroups = favFilter === 'Favorites'
            ? allChapterGroups
                .map(cg => ({ ...cg, items: cg.items.filter(bm => bm.favorite) }))
                .filter(cg => cg.items.length > 0)
            : allChapterGroups;

        const totalBookmarks = group.items.length;
        const favCount = group.items.filter(b => b.favorite).length;

        return (
            <div style={{ padding: '0 0 32px' }}>
                {/* Sticky top bar */}
                <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)' }}>
                    <div className="topbar" style={{ position: 'static' }}>
                        <button
                            onClick={() => setSelectedManga(null)}
                            style={{
                                background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13.5,
                            }}
                        >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>

                        <h2 className="topbar-title" style={{
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: '260px', marginLeft: 16, flexShrink: 1,
                        }}>
                            {group.mangaTitle}
                        </h2>

                        <div style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted)', fontWeight: 500, flexShrink: 0 }}>
                            {totalBookmarks} bookmark{totalBookmarks !== 1 ? 's' : ''}
                            {favCount > 0 && (
                                <span style={{ marginLeft: 6, color: '#f59e0b' }}>
                                    · ★ {favCount}
                                </span>
                            )}
                        </div>

                        <div className="topbar-spacer" />

                        {/* Favorites filter dropdown */}
                        <div style={{ width: 145, flexShrink: 0 }}>
                            <CustomDropdown
                                value={favFilter}
                                onChange={setFavFilter}
                                direction="down"
                                items={[
                                    { value: 'All', label: 'All' },
                                    { value: 'Favorites', label: 'Favorites Only' },
                                ]}
                            />
                        </div>
                    </div>
                </div>

                {/* Chapter groups */}
                <div style={{ padding: '8px 40px 32px', minHeight: 'calc(100vh - 120px)' }}>
                    {chapterGroups.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.35 }}>
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>No favorites yet</div>
                            <div style={{ fontSize: 12, opacity: 0.6 }}>Star a bookmark to add it to your favorites</div>
                        </div>
                    ) : (
                        chapterGroups.map((chGroup, idx) => (
                            <div
                                key={chGroup.chapterId}
                                style={{ marginBottom: idx < chapterGroups.length - 1 ? 32 : 0 }}
                            >
                                {/* Chapter header */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    marginBottom: 14, paddingBottom: 10,
                                    borderBottom: '1px solid var(--border)',
                                }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: 'var(--bookmark-accent)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, opacity: 0.9,
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="var(--bookmark)" viewBox="0 0 16 16">
                                            <path d="M2 2v13.5a.5.5 0 0 0 .74.439L8 13.069l5.26 2.87A.5.5 0 0 0 14 15.5V2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', letterSpacing: 0.2 }}>
                                            {chGroup.chapterId}
                                        </div>
                                        <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500, marginTop: -1 }}>
                                            {chGroup.items.length} page{chGroup.items.length !== 1 ? 's' : ''} bookmarked
                                            {chGroup.items.filter(b => b.favorite).length > 0 && (
                                                <span style={{ marginLeft: 6, color: '#f59e0b' }}>
                                                    · ★ {chGroup.items.filter(b => b.favorite).length}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Bookmark grid */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                    gap: 14,
                                }}>
                                    {chGroup.items.map(bm => (
                                        <BookmarkCard
                                            key={bm.id}
                                            bm={bm}
                                            onNavigate={onNavigateToBookmark}
                                            onDelete={handleDelete}
                                            onToggleFavorite={handleToggleFavorite}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    /* ── MAIN VIEW (manga cards) ─────────────────────────────── */
    if (mangaList.length === 0) {
        return (
            <div style={{ padding: '48px 40px', textAlign: 'center' }}>
                <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="1.5" style={{ marginBottom: 16, opacity: 0.4 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <div style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>No bookmarks yet</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6, opacity: 0.6 }}>
                    Use the bookmark button in the reader to save your favorite pages
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '0 0 32px' }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg)' }}>
                {/* Top bar */}
                <div className="topbar" style={{ position: 'static' }}>
                    <h2 className="topbar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                        Bookmarks
                    </h2>
                    <div className="topbar-spacer" />
                    <div className="search-box">
                        <svg className="search-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                        </svg>
                        <input placeholder="Search bookmarks..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {/* Series filter chips */}
                {seriesNames.length > 2 && (
                    <div
                        className="filter-tags-inner"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 24px',
                            borderBottom: '1px solid var(--border)',
                            overflowX: 'auto',
                            scrollbarWidth: 'none', msOverflowStyle: 'none',
                        }}
                    >
                        {seriesNames.map(name => (
                            <button
                                key={name}
                                className={`filter-chip ${activeFilter === name ? 'active' : ''}`}
                                onClick={() => setActiveFilter(name)}
                                style={{ flexShrink: 0 }}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Manga cards grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 16,
                padding: '16px 40px',
            }}>
                {filteredMangaList.map(group => {
                    const mangaRef = apiManga.find(m => m.id === group.mangaId);
                    const cover = mangaRef?.cover ? apiUrl(mangaRef.cover) : group.items[0]?.thumbnail;
                    const favCount = group.items.filter(b => b.favorite).length;
                    return (
                        <div
                            key={group.mangaId}
                            onClick={() => setSelectedManga(group.mangaId)}
                            className="manga-card"
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="manga-card-img">
                                {cover
                                    ? <img src={cover} alt={group.mangaTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ width: '100%', height: '100%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>{group.mangaTitle}</div>
                                }
                            </div>
                            <span className="chapter-badge">{group.items.length} bookmark{group.items.length !== 1 ? 's' : ''}</span>
                            <div className="manga-card-overlay">
                                <div className="manga-card-title">{group.mangaTitle}</div>
                                <div className="manga-card-meta">
                                    {group.items.length} saved page{group.items.length !== 1 ? 's' : ''}
                                    {favCount > 0 && <span style={{ marginLeft: 6, color: '#f59e0b' }}>★ {favCount}</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* No results */}
            {filteredMangaList.length === 0 && mangaList.length > 0 && (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No bookmarks match</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>Try a different search or filter</div>
                </div>
            )}
        </div>
    );
};

export default BookmarksPage;
