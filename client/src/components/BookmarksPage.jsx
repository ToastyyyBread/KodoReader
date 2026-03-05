import React, { useState, useEffect, useMemo } from 'react';
import { fetchBookmarks, deleteBookmarkAsync } from './Reader';
import { apiUrl } from '../runtime';

const BookmarksPage = ({ onNavigateToBookmark }) => {
    const [bookmarks, setBookmarks] = useState([]);
    const [selectedManga, setSelectedManga] = useState(null);
    const [apiManga, setApiManga] = useState([]);
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');

    const loadBookmarks = async () => {
        const data = await fetchBookmarks(apiUrl(''));
        setBookmarks(data);
    };

    useEffect(() => {
        loadBookmarks();
        fetch(apiUrl('/api/manga')).then(r => r.json()).then(data => setApiManga(data)).catch(() => { });
    }, []);

    // Group bookmarks by mangaId
    const grouped = {};
    bookmarks.forEach(b => {
        if (!grouped[b.mangaId]) {
            grouped[b.mangaId] = { mangaId: b.mangaId, mangaTitle: b.mangaTitle, items: [] };
        }
        grouped[b.mangaId].items.push(b);
    });
    const mangaList = Object.values(grouped);

    // Build unique series names for filter bar
    const seriesNames = useMemo(() => {
        const names = mangaList.map(g => g.mangaTitle).filter(Boolean);
        return ['All', ...new Set(names)];
    }, [bookmarks]);

    // Apply search + filter
    const filteredMangaList = mangaList.filter(g => {
        const matchFilter = activeFilter === 'All' || g.mangaTitle === activeFilter;
        const s = search.toLowerCase();
        const matchSearch = !search || g.mangaTitle?.toLowerCase().includes(s);
        return matchFilter && matchSearch;
    });

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        await deleteBookmarkAsync(apiUrl(''), id);
        loadBookmarks();
    };

    // Detail view: show all bookmarks for a manga
    if (selectedManga) {
        const group = grouped[selectedManga];
        if (!group) {
            setSelectedManga(null);
            return null;
        }
        return (
            <div style={{ padding: '0 0 32px' }}>
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
                        <h2 className="topbar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px', marginLeft: 16 }}>{group.mangaTitle}</h2>
                        <div className="topbar-spacer" />
                    </div>
                </div>

                {/* Bookmark list */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 16,
                    padding: '16px 40px'
                }}>
                    {group.items.map(bm => (
                        <div
                            key={bm.id}
                            onClick={() => onNavigateToBookmark(bm)}
                            style={{
                                background: 'var(--surface)',
                                borderRadius: 12,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: '1px solid var(--border)',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                                position: 'relative',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                        >
                            {/* Thumbnail */}
                            <div style={{
                                width: '100%', height: 220,
                                background: 'var(--surface2)',
                                overflow: 'hidden',
                            }}>
                                {bm.thumbnail
                                    ? <img src={bm.thumbnail.startsWith('http') ? bm.thumbnail : apiUrl(bm.thumbnail)} alt="Bookmark" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>No Preview</div>
                                }
                            </div>

                            {/* Info */}
                            <div style={{ padding: '10px 12px' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                                    {bm.chapterId}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                    Page {bm.page + 1}
                                </div>
                            </div>

                            {/* Delete button */}
                            <button
                                onClick={(e) => handleDelete(bm.id, e)}
                                title="Remove bookmark"
                                style={{
                                    position: 'absolute', top: 8, right: 8,
                                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: 'rgba(255,255,255,0.7)', borderRadius: 8,
                                    width: 28, height: 28,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', fontSize: 14,
                                    opacity: 0.6, transition: 'opacity 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                            >✕</button>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Main view: show manga cards that have bookmarks
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
                {/* Topbar with search */}
                <div className="topbar" style={{ position: 'static' }}>
                    <h2 className="topbar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>Bookmarks</h2>
                    <div className="topbar-spacer" />
                    <div className="search-box">
                        <svg className="search-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                        </svg>
                        <input placeholder="Search bookmarks..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {/* Series filter bar */}
                {seriesNames.length > 2 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 24px',
                        borderBottom: '1px solid var(--border)',
                        overflowX: 'auto',
                        scrollbarWidth: 'none', msOverflowStyle: 'none',
                    }}
                        className="filter-tags-inner"
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

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 16,
                padding: '16px 40px'
            }}>
                {filteredMangaList.map(group => {
                    const mangaRef = apiManga.find(m => m.id === group.mangaId);
                    const cover = mangaRef?.cover ? apiUrl(mangaRef.cover) : group.items[0]?.thumbnail;
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
                                <div className="manga-card-meta">{group.items.length} saved page{group.items.length !== 1 ? 's' : ''}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* No results from filter/search */}
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
