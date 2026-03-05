import React, { useState, useEffect, useCallback, useRef } from 'react';
import CustomDropdown from './CustomDropdown';
import { getApiBase } from '../runtime';

const API = '/api';
const BASE_URL = getApiBase();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const sendNotification = (title, body) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/kodo_500.svg' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { if (p === 'granted') new Notification(title, { body, icon: '/kodo_500.svg' }); });
    }
};


const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const formatChapterName = (name) => {
    if (!name) return name;
    const m = name.match(/chapter\s*[-_]?\s*([\d\.]+)/i);
    return m ? `Chapter - ${m[1].padStart(2, '0')}` : name;
};

// ── Series Picker Modal ──────────────────────────────────
const SeriesPickerModal = ({ library, onSelect, onClose }) => {
    const [search, setSearch] = useState('');
    const allEntries = [];
    for (const m of library) {
        allEntries.push({ ...m, _isVersion: false, _versionId: null, _versionLabel: null });
        if (Array.isArray(m.versions)) {
            for (const v of m.versions) {
                if (v.id === 'default') continue;
                allEntries.push({
                    ...m, id: m.id,
                    title: `${m.title} — ${v.name}`,
                    cover: v.cover || m.cover,
                    chapterCount: v.chapterCount ?? m.chapterCount,
                    _isVersion: true, _versionId: v.id, _versionLabel: v.name,
                });
            }
        }
    }
    const filtered = allEntries.filter(m => m.title.toLowerCase().includes(search.toLowerCase()));

    return (
        <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{
            position: 'fixed', inset: 0, zIndex: 9900,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                width: 680, maxWidth: '94vw', height: 520, maxHeight: '88vh',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Select Series</span>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ position: 'relative' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
                        </svg>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search series..." autoFocus
                            style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                </div>
                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                        {filtered.map((m, idx) => (
                            <div key={`${m.id}_${m._versionId || 'main'}_${idx}`} onClick={() => { onSelect(m); onClose(); }}
                                style={{ borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: `1.5px solid ${m._isVersion ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`, background: 'var(--surface2)', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = m._isVersion ? 'rgba(99,102,241,0.3)' : 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                            >
                                <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: 'var(--surface)', position: 'relative' }}>
                                    {m.cover ? <img src={`${BASE_URL}${m.cover}`} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--muted)' }}>📖</div>}
                                    {m._isVersion && <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.85)', color: '#fff' }}>{m._versionLabel}</div>}
                                </div>
                                <div style={{ padding: '8px 8px 10px', fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, color: 'var(--text)' }}>
                                    {m._isVersion ? m._versionLabel : m.title}
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>{m.chapterCount} ch.</div>
                                </div>
                            </div>
                        ))}
                        {filtered.length === 0 && <div style={{ gridColumn: '1/-1', padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No series found</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Tooltip ──────────────────────────────────────────────
const Tooltip = ({ content, align = 'center' }) => (
    <div className="ui-tooltip">
        <button className="ui-tooltip-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        </button>
        <div className={`ui-tooltip-content ${align !== 'center' ? `align-${align}` : ''}`}>{content}</div>
    </div>
);

const modelCardStyle = {
    padding: '14px 16px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', flexDirection: 'column',
};

let _pcState = {
    selectedManga: null, selectedVersionId: null, chapters: [],
    startIdx: 1, endIdx: 1, activePreset: null, quality: 82,
    grayscale: false, sharpen: true, activeTab: 'compressor',
    analyzeResults: null
};

// ── Main Component ───────────────────────────────────────
const ImageCompressor = () => {
    const [library, setLibrary] = useState([]);
    const [selectedManga, setSelectedManga] = useState(_pcState.selectedManga);
    const [selectedVersionId, setSelectedVersionId] = useState(_pcState.selectedVersionId);
    const [chapters, setChapters] = useState(_pcState.chapters);
    const [loadingChapters, setLoadingChapters] = useState(false);
    const [startIdx, setStartIdx] = useState(_pcState.startIdx);
    const [endIdx, setEndIdx] = useState(_pcState.endIdx);
    const [showPicker, setShowPicker] = useState(false);
    const [queue, setQueue] = useState([]);
    const [addingToQueue, setAddingToQueue] = useState(false);
    const [analyzeResults, setAnalyzeResults] = useState(_pcState.analyzeResults);
    const [activeTab, setActiveTab] = useState(_pcState.activeTab);

    // Archive
    const [archive, setArchive] = useState([]);
    const [archiveAction, setArchiveAction] = useState(null); // { type, seriesId, chapters }
    const [archiveSelectedChapters, setArchiveSelectedChapters] = useState({}); // { mangaId: Set }

    // Compression settings
    const [activePreset, setActivePreset] = useState(_pcState.activePreset);
    const [quality, setQuality] = useState(_pcState.quality);
    const [grayscale, setGrayscale] = useState(_pcState.grayscale);
    const [sharpen, setSharpen] = useState(_pcState.sharpen);
    const [maxWidth, setMaxWidth] = useState(0);
    const [maxHeight, setMaxHeight] = useState(0);

    useEffect(() => {
        _pcState.selectedManga = selectedManga;
        _pcState.selectedVersionId = selectedVersionId;
        _pcState.chapters = chapters;
        _pcState.startIdx = startIdx;
        _pcState.endIdx = endIdx;
        _pcState.activePreset = activePreset;
        _pcState.quality = quality;
        _pcState.grayscale = grayscale;
        _pcState.sharpen = sharpen;
        _pcState.activeTab = activeTab;
        _pcState.analyzeResults = analyzeResults;
    }, [selectedManga, selectedVersionId, chapters, startIdx, endIdx, activePreset, quality, grayscale, sharpen, activeTab, analyzeResults]);

    const PRESETS = {
        manga: { label: 'Manga', desc: 'B&W manga — converts to grayscale, aggressive compression', quality: 78, grayscale: true, sharpen: true, color: '#22c55e', badge: 'B&W' },
        manhwa: { label: 'Manhwa', desc: 'Full-color webtoon — preserves colors, balanced compression', quality: 82, grayscale: false, sharpen: true, color: '#818cf8', badge: 'Color' },
        aggressive: { label: 'Aggressive', desc: 'Maximum file-size reduction, some quality loss', quality: 65, grayscale: false, sharpen: false, color: '#ef4444', badge: 'Heavy' },
        lossless: { label: 'Lossless-ish', desc: 'Nearly original quality, larger files', quality: 95, grayscale: false, sharpen: true, color: '#f59e0b', badge: 'Light' },
    };

    // ── Fetches ──────────────────────────────────────────
    useEffect(() => {
        fetch(`${API}/manga`).then(r => r.json()).then(setLibrary).catch(() => { });
    }, []);

    useEffect(() => {
        if (!selectedManga) { setChapters([]); setStartIdx(1); setEndIdx(1); setSelectedVersionId(null); return; }
        setLoadingChapters(true);
        setSelectedVersionId(selectedManga._versionId || null);
        const versionParam = selectedManga._versionId ? `?version=${encodeURIComponent(selectedManga._versionId)}` : '';
        fetch(`${API}/manga/${encodeURIComponent(selectedManga.id)}${versionParam}`)
            .then(r => r.json())
            .then(data => {
                const raw = data.chapters || [];
                const chs = raw.map(c => typeof c === 'string' ? c : c.name);
                setChapters(chs);
                if (chs.length > 0) { setStartIdx(1); setEndIdx(chs.length); }
            })
            .catch(() => setChapters([]))
            .finally(() => setLoadingChapters(false));
    }, [selectedManga]);

    const fetchArchive = useCallback(async () => {
        try {
            const r = await fetch(`${API}/compress/archive`);
            if (!r.ok) return [];
            const data = await r.json();
            setArchive(data);
            return data;
        } catch {
            return [];
        }
    }, []);

    const fetchQueue = useCallback(async () => {
        try {
            const r = await fetch(`${API}/compress/queue`);
            if (!r.ok) return [];
            const data = await r.json();
            setQueue(data);
            return data;
        } catch {
            return [];
        }
    }, []);

    useEffect(() => {
        fetchQueue();
        fetchArchive();
        const id = setInterval(() => {
            fetchQueue();
            fetchArchive();
        }, 1200);
        return () => clearInterval(id);
    }, [fetchQueue, fetchArchive]);

    // ── Derived ──────────────────────────────────────────
    const isInvalidRange = startIdx > endIdx || startIdx < 1 || (chapters.length > 0 && endIdx > chapters.length);
    const selectedChapters = (() => {
        if (!chapters.length || isInvalidRange) return [];
        return chapters.slice(startIdx - 1, endIdx);
    })();

    const canSubmit = selectedManga && activePreset && selectedChapters.length > 0 && !isInvalidRange;
    const activeJob = queue.find(j => j.status === 'processing');
    const isProcessing = !!activeJob;

    // ── Select preset ────────────────────────────────────
    const selectPreset = (key) => {
        if (activePreset === key) {
            setActivePreset(null);
            return;
        }
        setActivePreset(key);
        const p = PRESETS[key];
        setQuality(p.quality);
        setGrayscale(p.grayscale);
        setSharpen(p.sharpen);
    };

    // ── Handlers ─────────────────────────────────────────
    const addToQueue = async () => {
        if (!canSubmit) return;
        setAddingToQueue(true);
        try {
            const res = await fetch(`${API}/compress/add`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mangaId: selectedManga.id,
                    mangaTitle: selectedManga.title,
                    chapters: selectedChapters,
                    versionId: selectedVersionId || undefined,
                    preset: activePreset,
                    quality, grayscale, sharpen, maxWidth, maxHeight,
                }),
            });
            if (!res.ok) throw new Error('Failed to add compression job');
            const created = await res.json();
            if (created?.id) {
                setQueue(prev => prev.some(j => j.id === created.id) ? prev : [...prev, created]);
            }

            // Fast-follow polling so queued -> processing status appears immediately.
            await fetchQueue();
            for (let i = 0; i < 5; i++) {
                await sleep(250);
                await fetchQueue();
            }
        } catch (err) {
            console.error('Failed to start compressor job:', err);
        } finally {
            setAddingToQueue(false);
        }
    };

    const removeFromQueue = async (jobId) => {
        await fetch(`${API}/compress/remove/${jobId}`, { method: 'DELETE' });
        fetchQueue();
    };

    const abort = async () => {
        await fetch(`${API}/compress/abort`, { method: 'POST' });
        fetchQueue();
    };

    const finalizeJob = async (jobId, action) => {
        await fetch(`${API}/compress/finalize`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId, action }),
        });
        fetchQueue();
    };

    const discardJob = async (jobId) => {
        await fetch(`${API}/compress/discard`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
        });
        fetchQueue();
    };

    const analyzeChapters = async () => {
        if (!selectedManga || selectedChapters.length === 0) return;
        try {
            const res = await fetch(`${API}/compress/analyze`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mangaId: selectedManga.id, chapters: selectedChapters, versionId: selectedVersionId }),
            });
            const data = await res.json();
            setAnalyzeResults(data);
        } catch { }
    };

    const restoreBackup = async (ch) => {
        await fetch(`${API}/compress/restore`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mangaId: selectedManga.id, chapter: ch, versionId: selectedVersionId }),
        });
        analyzeChapters();
    };

    const clearAll = () => {
        setSelectedManga(null);
        setActivePreset(null);
        setStartIdx(1);
        setEndIdx(1);
        setAnalyzeResults(null);
    };

    const groupedQueue = [];
    queue.forEach(job => {
        let group = groupedQueue.find(g => g.mangaId === job.mangaId);
        if (!group) {
            group = { mangaId: job.mangaId, mangaTitle: job.mangaTitle, jobs: [] };
            groupedQueue.push(group);
        }
        group.jobs.push(job);
    });

    const removeFromQueueSeries = async (mangaId) => {
        const jobs = queue.filter(j => j.mangaId === mangaId);
        for (const j of jobs) {
            if (j.status === 'processing') {
                await fetch(`${API}/compress/abort`, { method: 'POST' });
            }
            await fetch(`${API}/compress/remove/${j.id}`, { method: 'DELETE' });
        }
        fetchQueue();
    };

    const StatusBadge = ({ status }) => {
        const colors = {
            queued: { bg: 'var(--surface)', text: 'var(--muted)' },
            processing: { bg: '#818cf818', text: '#818cf8' },
            review: { bg: '#f59e0b18', text: '#f59e0b' },
            done: { bg: '#22c55e18', text: '#22c55e' },
            error: { bg: '#ef444418', text: '#ef4444' },
            cancelled: { bg: 'var(--surface)', text: 'var(--muted)' }
        };
        const c = colors[status] || colors.queued;
        return (
            <div style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                textTransform: 'uppercase', background: c.bg, color: c.text, letterSpacing: 0.5
            }}>
                {status}
            </div>
        );
    };

    const inputStyle = {
        width: '100%', padding: '8px 10px', borderRadius: 8,
        border: '1px solid var(--border)', background: 'var(--surface)',
        color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit',
        textAlign: 'center', fontWeight: 600, appearance: 'textfield',
    };

    // ── Render ───────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {archiveAction && (
                <div onClick={(e) => { if (e.target === e.currentTarget) setArchiveAction(null); }} style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20
                }}>
                    <div style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 16, width: 400, maxWidth: '100%',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.45)', overflow: 'hidden',
                        animation: 'modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ padding: '20px 24px' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: archiveAction.type === 'delete' ? '#ef4444' : 'var(--text)' }}>
                                {archiveAction.type === 'delete' ? 'Delete Archive' : 'Restore Archive'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                                {archiveAction.type === 'delete'
                                    ? `Are you sure you want to delete the archive for "${archiveAction.seriesId}"? This action cannot be undone.`
                                    : `Are you sure you want to restore the archive for "${archiveAction.seriesId}"? This will overwrite your currently compressed files.`}
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px', background: 'var(--surface2)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={() => setArchiveAction(null)} style={{
                                padding: '8px 16px', borderRadius: 8, background: 'transparent',
                                border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
                                cursor: 'pointer'
                            }}>Cancel</button>
                            <button onClick={async () => {
                                const ep = archiveAction.type === 'delete' ? `${API}/compress/archive/delete` : `${API}/compress/archive/restore`;
                                await fetch(ep, {
                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ seriesId: archiveAction.seriesId, chapters: archiveAction.chapters })
                                });
                                setArchiveAction(null);
                                setArchiveSelectedChapters(prev => { const n = { ...prev }; delete n[archiveAction.seriesId]; return n; });
                                fetchArchive();
                            }} style={{
                                padding: '8px 16px', borderRadius: 8,
                                background: archiveAction.type === 'delete' ? '#ef4444' : 'var(--accent)', border: 'none',
                                color: archiveAction.type === 'delete' ? '#fff' : 'var(--bg)', fontSize: 13, fontWeight: 600,
                                cursor: 'pointer'
                            }}>
                                {archiveAction.type === 'delete' ? 'Delete' : 'Restore'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Topbar */}
            <div className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
                <h2 className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M9 4V9H4M15 4V9H20M4 15H9V20M15 20V15H20" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                    Series Compressor
                    <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>
                        Optimize CBZ files — reduce size while preserving sharpness.
                    </span>
                </h2>
                <button onClick={clearAll} style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface2)', color: 'var(--text)', fontSize: 12,
                    fontWeight: 600, cursor: (selectedManga || activePreset !== null) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                    opacity: (selectedManga || activePreset !== null) ? 1 : 0,
                    pointerEvents: (selectedManga || activePreset !== null) ? 'auto' : 'none',
                }} onMouseEnter={e => { if (selectedManga || activePreset !== null) e.currentTarget.style.background = 'var(--surface)'; }} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Clear All
                </button>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: 0, padding: '0 32px', borderBottom: '1px solid var(--border)' }}>
                {['compressor', 'archive'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: '10px 20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                        background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                        color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
                        textTransform: 'capitalize', transition: 'all 0.15s', letterSpacing: 0.5,
                    }}>
                        {tab === 'archive' ? `Archive (${archive.length})` : 'Compressor'}
                    </button>
                ))}
            </div>

            {activeTab === 'compressor' ? (
                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Info banner */}
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                        background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)',
                        borderRadius: 10, fontSize: 12.5, color: 'var(--text)',
                    }}>
                        <svg style={{ flexShrink: 0, marginTop: 1 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                        </svg>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span><strong>Sharp + MozJPEG</strong> — Optimizes images by re-encoding them into high-efficiency JPEG format, reducing file size while preserving visual quality.</span>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Original CBZ can be saved as backup. You can restore them anytime.</span>
                        </div>
                    </div>

                    {/* ── Step 1: Series ─────────────────────── */}
                    <div className="settings-card">
                        <div style={{ padding: '14px 18px', borderBottom: selectedManga ? '1px solid var(--border)' : 'none' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>1 · Select Series</div>
                            <div onClick={() => setShowPicker(true)} style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                border: '1.5px dashed var(--border)', borderRadius: 10, cursor: 'pointer',
                                background: 'var(--surface2)', transition: 'border-color 0.15s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                            >
                                {selectedManga ? (
                                    <>
                                        {selectedManga.cover && <img src={`${BASE_URL}${selectedManga.cover}`} alt="" style={{ width: 36, height: 48, objectFit: 'cover', borderRadius: 4 }} />}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedManga.title}</div>
                                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{selectedManga.chapterCount} chapters — click to change</div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedManga(null); setAnalyzeResults(null); }}
                                            style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            title="Remove Series">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" /></svg>
                                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Click to browse your library…</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Chapter range */}
                        {selectedManga && (
                            <div style={{ padding: '14px 18px' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                                    2 · Chapter Range
                                    {selectedChapters.length > 0 && (
                                        <span style={{ marginLeft: 8, color: 'var(--accent)', textTransform: 'none', letterSpacing: 0, fontSize: 11, fontWeight: 600 }}>
                                            · {selectedChapters.length} chapter{selectedChapters.length > 1 ? 's' : ''} selected
                                        </span>
                                    )}
                                </div>
                                {loadingChapters ? (
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading chapters…</div>
                                ) : chapters.length === 0 ? (
                                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>No chapters found</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Start</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: `1px solid ${isInvalidRange ? '#ef4444' : 'var(--border)'}`, borderRadius: 6, overflow: 'hidden' }}>
                                                        <button onClick={() => setStartIdx(v => Math.max(1, v - 1))} style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>-</button>
                                                        <input type="number" min="1" max={chapters.length} value={startIdx} onChange={e => setStartIdx(parseInt(e.target.value) || 1)} className="hide-spin"
                                                            style={{ ...inputStyle, width: 44, border: 'none', padding: '6px 0', borderRadius: 0, background: 'transparent' }} />
                                                        <button onClick={() => setStartIdx(v => Math.min(chapters.length, v + 1))} style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>+</button>
                                                    </div>
                                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                                        {formatChapterName(chapters[Math.max(0, Math.min(startIdx - 1, chapters.length - 1))])}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ width: 1, height: 32, background: 'var(--border)', alignSelf: 'center', margin: '0 4px' }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>End</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: `1px solid ${isInvalidRange ? '#ef4444' : 'var(--border)'}`, borderRadius: 6, overflow: 'hidden' }}>
                                                        <button onClick={() => setEndIdx(v => Math.max(1, v - 1))} style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>-</button>
                                                        <input type="number" min="1" max={chapters.length} value={endIdx} onChange={e => setEndIdx(parseInt(e.target.value) || 1)} className="hide-spin"
                                                            style={{ ...inputStyle, width: 44, border: 'none', padding: '6px 0', borderRadius: 0, background: 'transparent' }} />
                                                        <button onClick={() => setEndIdx(v => Math.min(chapters.length, v + 1))} style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>+</button>
                                                    </div>
                                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                                        {formatChapterName(chapters[Math.max(0, Math.min(endIdx - 1, chapters.length - 1))])}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {isInvalidRange && (
                                            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                                                <strong>Start</strong> chapter cannot exceed <strong>End</strong> chapter.
                                            </div>
                                        )}
                                        {/* Analyze button */}
                                        {!isInvalidRange && selectedChapters.length > 0 && (
                                            <button onClick={analyzeChapters} style={{
                                                padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
                                                background: 'var(--surface2)', color: 'var(--text)', fontSize: 11.5,
                                                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content',
                                            }}>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                Analyze Selected ({selectedChapters.length})
                                            </button>
                                        )}
                                        {analyzeResults && (
                                            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 11.5 }}>
                                                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Analysis</div>
                                                <div style={{ color: 'var(--muted)' }}>
                                                    {analyzeResults.length} CBZ files · {analyzeResults.reduce((s, r) => s + r.pageCount, 0)} pages · {formatSize(analyzeResults.reduce((s, r) => s + r.fileSize, 0))} total
                                                </div>
                                                {analyzeResults.some(r => r.hasBackup) && (
                                                    <div style={{ marginTop: 4, color: '#f59e0b', fontSize: 11 }}>⚠ Some chapters have existing backups (previously compressed)</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Step 3: Preset Selection (side-by-side cards) */}
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>3 · Compression Preset</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {Object.entries(PRESETS).map(([key, preset]) => (
                                <div key={key} onClick={() => selectPreset(key)}
                                    style={{
                                        ...modelCardStyle,
                                        border: `1.5px solid ${activePreset === key ? preset.color : 'var(--border)'}`,
                                        background: activePreset === key ? `${preset.color}0d` : 'var(--surface2)',
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>{preset.label}</div>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${preset.color}18`, color: preset.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{preset.badge}</span>
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>{preset.desc}</div>

                                    {/* Settings inside card */}
                                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                Quality
                                                <Tooltip align="left" content={<>JPEG quality (1-100). Lower = smaller file, more artifacts.<br /><br /><strong>65</strong>: Aggressive<br /><strong>78</strong>: Manga (B&W, good)<br /><strong>82</strong>: Manhwa (color, balanced)<br /><strong>95</strong>: Near-lossless</>} />
                                            </div>
                                            <CustomDropdown
                                                value={activePreset === key ? quality : preset.quality}
                                                onChange={val => { setQuality(parseInt(val)); setActivePreset(key); }}
                                                items={[
                                                    { value: 65, label: '65 (Aggressive)' },
                                                    { value: 72, label: '72 (Medium)' },
                                                    { value: 78, label: '78 (Good)' },
                                                    { value: 82, label: '82 (Balanced)' },
                                                    { value: 88, label: '88 (High)' },
                                                    { value: 95, label: '95 (Near-lossless)' },
                                                ]}
                                            />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                Options
                                                <Tooltip align="right" content={<>Sharpening preserves line art crispness after JPEG re-encode.<br /><br />Grayscale converts to B&W which reduces file size further for manga.</>} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text)', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={activePreset === key ? sharpen : preset.sharpen}
                                                        onChange={e => { setSharpen(e.target.checked); setActivePreset(key); }}
                                                        style={{ accentColor: preset.color }} />
                                                    Sharpen
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text)', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={activePreset === key ? grayscale : preset.grayscale}
                                                        onChange={e => { setGrayscale(e.target.checked); setActivePreset(key); }}
                                                        style={{ accentColor: preset.color }} />
                                                    Grayscale
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Queue ───────────────────────────────── */}
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
                            Queue {queue.length > 0 && `(${queue.length})`}
                        </div>

                        {groupedQueue.length === 0 ? (
                            <div style={{
                                padding: '32px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13,
                                border: '1px dashed var(--border)', borderRadius: 12,
                            }}>
                                Queue is empty
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {groupedQueue.map(group => {
                                    const activeInSeries = group.jobs.find(j => j.status === 'processing');
                                    return (
                                        <div key={group.mangaId} style={{
                                            border: `1px solid ${activeInSeries ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                                            background: activeInSeries ? 'rgba(99,102,241,0.02)' : 'var(--surface2)',
                                            borderRadius: 12, overflow: 'hidden'
                                        }}>
                                            {/* Series Header */}
                                            <div style={{
                                                padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                borderBottom: `1px solid ${activeInSeries ? 'rgba(99,102,241,0.1)' : 'var(--border)'}`
                                            }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {group.mangaTitle}
                                                </div>
                                                <button onClick={() => removeFromQueueSeries(group.mangaId)} style={{
                                                    background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', cursor: 'pointer',
                                                    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.15s'
                                                }} title="Cancel Series" onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}>
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>

                                            {/* Jobs in Series */}
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                {group.jobs.map((job, idx) => (
                                                    <div key={job.id} style={{
                                                        padding: '12px 16px',
                                                        borderTop: idx > 0 ? `1px solid ${activeInSeries ? 'rgba(99,102,241,0.1)' : 'var(--border)'}` : 'none',
                                                        display: 'flex', flexDirection: 'column', gap: 10,
                                                        opacity: job.status === 'done' || job.status === 'cancelled' || job.status === 'error' ? 0.6 : 1
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                                                                    {job.chapters.length} chapters
                                                                </div>
                                                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                                                    Preset: {PRESETS[job.preset]?.label || job.preset} · Quality {job.quality}
                                                                </div>
                                                            </div>
                                                            {job.status === 'processing' ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.1)', padding: '2px 10px 2px 4px', borderRadius: 99 }}>
                                                                    {job.progress === 0 && !job.processedPages ? (
                                                                        <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', animation: 'ellipsePulse 1.2s ease-in-out infinite', boxShadow: '0 0 8px rgba(99,102,241,0.5)' }} />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="ai-process-ring"><div className="ai-core" /><div className="ai-orbit" /><div className="ai-orbit" /><div className="ai-orbit" /></div>
                                                                    )}
                                                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1' }}>{job.progress === 0 && !job.processedPages ? 'Loading' : 'Compressing'}</span>
                                                                </div>
                                                            ) : (
                                                                <StatusBadge status={job.status} />
                                                            )}
                                                        </div>

                                                        {/* Progress bars */}
                                                        {job.status === 'processing' && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                <div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>
                                                                        <span>{job.processedPages === 0 ? 'Evaluating files…' : `Pages (${job.progress}%)`}</span>
                                                                        {job.processedPages > 0 && <span>{job.processedPages} / {job.totalPages}</span>}
                                                                    </div>
                                                                    <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', position: 'relative' }}>
                                                                        {job.processedPages === 0 ? (
                                                                            <div style={{ position: 'absolute', top: 0, height: '100%', width: '30%', borderRadius: 2, background: 'linear-gradient(90deg, transparent, #6366f1aa, transparent)', animation: 'scanSlide 1.4s ease-in-out infinite' }} />
                                                                        ) : (
                                                                            <div style={{ height: '100%', borderRadius: 2, background: '#22c55e', width: `${job.progress}%`, transition: 'width 0.5s ease', minWidth: job.progress > 0 ? 4 : 0 }} />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>
                                                                        <span style={{ fontWeight: 600, color: 'var(--text)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                            Current: {job.currentChapter ? formatChapterName(job.currentChapter) : 'Starting…'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {job.status === 'done' && job.originalSize > 0 && (
                                                            <div style={{ marginTop: 4, fontSize: 11, color: '#22c55e', fontWeight: 600 }}>
                                                                {formatSize(job.originalSize)} → {formatSize(job.compressedSize)} ({Math.round((1 - job.compressedSize / job.originalSize) * 100)}% reduced)
                                                            </div>
                                                        )}
                                                        {job.status === 'review' && (
                                                            <div style={{ marginTop: 8, display: 'flex', gap: 10, background: 'rgba(245,158,11,0.05)', padding: '12px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)' }}>
                                                                <button onClick={() => finalizeJob(job.id, 'archive')} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#eab308', color: '#fff', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#ca8a04'} onMouseLeave={e => e.currentTarget.style.background = '#eab308'}>
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                                                    Replace & Save Original
                                                                </button>
                                                                <button onClick={() => finalizeJob(job.id, 'replace')} style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#16a34a'} onMouseLeave={e => e.currentTarget.style.background = '#22c55e'}>
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                                                    Replace & Delete Original
                                                                </button>
                                                                <button onClick={() => discardJob(job.id)} title="Discard" style={{ padding: '8px 12px', borderRadius: 6, background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                        {job.error && <div style={{ marginTop: 4, fontSize: 11, color: '#ef4444' }}>{job.error}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Bottom Action Button ─────────────────── */}
                    <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', gap: 12 }}>
                        <button
                            onClick={addToQueue} disabled={addingToQueue || !canSubmit}
                            style={{
                                flex: 1, padding: '13px 0', borderRadius: 10,
                                background: (isProcessing && !canSubmit) ? 'rgba(99,102,241,0.08)' : 'var(--surface2)',
                                border: (isProcessing && !canSubmit) ? '1px solid rgba(99,102,241,0.25)' : '1px solid var(--border)',
                                color: (isProcessing && !canSubmit) ? 'var(--accent)' : canSubmit ? 'var(--text)' : 'var(--muted)',
                                fontSize: 14, fontWeight: 700,
                                cursor: (addingToQueue || !canSubmit) ? 'not-allowed' : 'pointer',
                                opacity: addingToQueue ? 0.7 : 1,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'all 0.15s'
                            }}
                        >
                            {(isProcessing && !canSubmit) ? (
                                <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                    </svg>
                                    Processing…
                                </>
                            ) : isProcessing && canSubmit ? (
                                <>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 5v14M5 12h14" />
                                    </svg>
                                    {addingToQueue ? 'Adding…' : 'Add to Queue'}
                                </>
                            ) : (
                                <>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                    {addingToQueue ? 'Starting…' : 'Start Compressing'}
                                </>
                            )}
                        </button>
                        {isProcessing && (
                            <button onClick={abort} style={{
                                padding: '0 20px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)',
                                background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 14, fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s'
                            }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                                Stop
                            </button>
                        )}
                    </div>
                </div >
            ) : (
                /* ── Archive Tab ─────────────────────────────────────── */
                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                    {archive.length === 0 ? (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: '60px 20px', color: 'var(--muted)', textAlign: 'center'
                        }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: 16 }}>
                                <rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" /><path d="M10 12h4" />
                            </svg>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No archived originals</div>
                            <div style={{ fontSize: 12 }}>When you compress with "Save Original", the originals will appear here.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {archive.map(series => {
                                const selected = archiveSelectedChapters[series.mangaId] || new Set();
                                const allChapterNames = (series.chapters || []).map(c => c.name);
                                const allSelected = allChapterNames.length > 0 && allChapterNames.every(n => selected.has(n));
                                const someSelected = selected.size > 0;

                                const toggleChapter = (chName) => {
                                    setArchiveSelectedChapters(prev => {
                                        const s = new Set(prev[series.mangaId] || []);
                                        if (s.has(chName)) s.delete(chName); else s.add(chName);
                                        return { ...prev, [series.mangaId]: s };
                                    });
                                };
                                const toggleAll = () => {
                                    setArchiveSelectedChapters(prev => {
                                        if (allSelected) return { ...prev, [series.mangaId]: new Set() };
                                        return { ...prev, [series.mangaId]: new Set(allChapterNames) };
                                    });
                                };

                                return (
                                    <div key={series.mangaId} style={{
                                        background: 'var(--surface2)', border: '1px solid var(--border)',
                                        borderRadius: 12, overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        }}>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700 }}>{series.mangaId}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                                                    {series.chapterCount} chapter{series.chapterCount !== 1 ? 's' : ''} · {(series.totalSize / 1048576).toFixed(1)} MB
                                                    {someSelected && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>({selected.size} selected)</span>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button
                                                    onClick={() => setArchiveAction({ type: 'restore', seriesId: series.mangaId, chapters: someSelected ? [...selected] : null })}
                                                    style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                                    {someSelected ? `Restore Selected (${selected.size})` : 'Restore All'}
                                                </button>
                                                <button
                                                    onClick={() => setArchiveAction({ type: 'delete', seriesId: series.mangaId, chapters: someSelected ? [...selected] : null })}
                                                    style={{ padding: '6px 12px', borderRadius: 6, background: '#ef4444', border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                                    {someSelected ? `Delete Selected (${selected.size})` : 'Delete All'}
                                                </button>
                                            </div>
                                        </div>
                                        {series.chapters && series.chapters.length > 0 && (
                                            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 18px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 10.5, color: 'var(--muted)', fontWeight: 600 }}>
                                                        <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: 'var(--accent)' }} />
                                                        Select All
                                                    </label>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {series.chapters.map(ch => {
                                                        const isChecked = selected.has(ch.name);
                                                        return (
                                                            <label key={ch.name} style={{
                                                                fontSize: 10.5, padding: '4px 8px', borderRadius: 5,
                                                                background: isChecked ? 'rgba(99,102,241,0.12)' : 'var(--surface)',
                                                                border: `1px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                                                                color: isChecked ? 'var(--accent)' : 'var(--muted)', fontWeight: 500,
                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                                                transition: 'all 0.15s',
                                                            }}>
                                                                <input type="checkbox" checked={isChecked} onChange={() => toggleChapter(ch.name)} style={{ display: 'none' }} />
                                                                {ch.name}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Picker Modal */}
            {showPicker && <SeriesPickerModal library={library} onSelect={m => setSelectedManga(m)} onClose={() => setShowPicker(false)} />}
        </div>
    );
};

export default ImageCompressor;
