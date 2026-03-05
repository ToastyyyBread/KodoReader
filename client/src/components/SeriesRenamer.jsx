import React, { useState, useEffect, useRef } from 'react';
import { getApiBase } from '../runtime';

const API = '/api';
const BASE_URL = getApiBase();

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


let _srState = { selectedManga: null, selectedVersionId: null, chapters: [], baseName: '', results: null, errorMsg: null, startFromZero: false, customPrefix: ' - ' };
// ── Main Component ───────────────────────────────────────
const SeriesRenamer = () => {
    const [library, setLibrary] = useState([]);
    const [selectedManga, setSelectedManga] = useState(_srState.selectedManga);
    const [selectedVersionId, setSelectedVersionId] = useState(_srState.selectedVersionId);
    const [chapters, setChapters] = useState(_srState.chapters);
    const [loadingChapters, setLoadingChapters] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [baseName, setBaseName] = useState(_srState.baseName);
    const [isRenaming, setIsRenaming] = useState(false);
    const [results, setResults] = useState(_srState.results);
    const [errorMsg, setErrorMsg] = useState(_srState.errorMsg);
    const [startFromZero, setStartFromZero] = useState(_srState.startFromZero);
    const [customPrefix, setCustomPrefix] = useState(_srState.customPrefix);

        useEffect(() => { Object.assign(_srState, { selectedManga, selectedVersionId, chapters, baseName, results, errorMsg, startFromZero, customPrefix }); }, [selectedManga, selectedVersionId, chapters, baseName, results, errorMsg, startFromZero, customPrefix]);
    // ── Fetches ──────────────────────────────────────────
    useEffect(() => {
        fetch(`${API}/manga`).then(r => r.json()).then(setLibrary).catch(() => { });
    }, []);

    const prevMangaRef = useRef(selectedManga);
    useEffect(() => {
        const isNewSelection = selectedManga !== prevMangaRef.current;
        prevMangaRef.current = selectedManga;

        if (!selectedManga) { setChapters([]); setSelectedVersionId(null); return; }
        if(isNewSelection) { setChapters([]); }
        setLoadingChapters(true);
        setSelectedVersionId(selectedManga._versionId || null);

        // Auto-fill base name from original title
        if(isNewSelection) { setBaseName(selectedManga.title.replace(/\s*—\s*.*$/, '')); setResults(null); }
        setErrorMsg(null);

        const versionParam = selectedManga._versionId ? `&versionId=${encodeURIComponent(selectedManga._versionId)}` : '';
        fetch(`${API}/rename-series?mangaId=${encodeURIComponent(selectedManga.id)}${versionParam}`)
            .then(r => r.json())
            .then(data => {
                const chs = Array.isArray(data) ? data : [];
                setChapters(chs);
            })
            .catch(() => setChapters([]))
            .finally(() => setLoadingChapters(false));
    }, [selectedManga]);

    const canSubmit = selectedManga && chapters.length > 0 && baseName.trim().length > 0;

    // ── Handlers ─────────────────────────────────────────
    const executeRename = async () => {
        if (!canSubmit) return;
        setIsRenaming(true);
        setResults(null);
        setErrorMsg(null);

        try {
            const res = await fetch(`${API}/rename-series`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mangaId: selectedManga.id,
                    versionId: selectedVersionId || undefined,
                    baseName: baseName.trim(),
                    startFromZero,
                    customPrefix
                }),
            });
            const data = await res.json();
            if (data.error) {
                setErrorMsg(data.error);
            } else {
                setResults(data.renamed || []);
                // Refetch chapters to update UI
                const versionParam = selectedVersionId ? `&versionId=${encodeURIComponent(selectedVersionId)}` : '';
                const rList = await fetch(`${API}/rename-series?mangaId=${encodeURIComponent(selectedManga.id)}${versionParam}`);
                const rData = await rList.json();
                setChapters(Array.isArray(rData) ? rData : []);
            }
        } catch (err) {
            setErrorMsg(err.message);
        }
        setIsRenaming(false);
    };

    const clearAll = () => {
        setSelectedManga(null);
        setBaseName('');
        setResults(null);
        setErrorMsg(null);
    };

    const inputStyle = {
        width: '100%', padding: '12px 14px', borderRadius: 10,
        border: '1px solid var(--border)', background: 'var(--surface)',
        color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
        fontWeight: 600, boxSizing: 'border-box'
    };

    // ── Render ───────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
            <style>{`.no-scrollbar-panel::-webkit-scrollbar { display: none; }`}</style>

            {/* Topbar — Clear All always rendered but visibility toggled to avoid layout shift */}
            <div className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Chapter Renamer
                </h2>
                <button onClick={clearAll} style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface2)', color: 'var(--text)', fontSize: 12,
                    fontWeight: 600, cursor: selectedManga ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.2s',
                    opacity: selectedManga ? 1 : 0,
                    pointerEvents: selectedManga ? 'auto' : 'none',
                }}
                    onMouseEnter={e => { if (selectedManga) e.currentTarget.style.background = 'var(--surface)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Clear All
                </button>
            </div>

            <div className="no-scrollbar-panel" style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960, margin: '0 auto', width: '100%' }}>

                {/* Info banner */}
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                    background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: 10, fontSize: 12.5, color: 'var(--text)',
                }}>
                    <svg style={{ flexShrink: 0, marginTop: 1 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span><strong>Bulk Renaming</strong> — Automatically standardizes chapter filenames.</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>⚠ Warning: This operation is permanent and will directly modify files in the filesystem. Please ensure you have a backup before proceeding.</span>
                    </div>
                </div>

                {/* ── Two-column layout ─────────────────────── */}
                <div style={{ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap', width: '100%' }}>

                    {/* LEFT: Select Series + Preview */}
                    <div className="settings-card" style={{ flex: '1.2 1 320px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
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
                                            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{chapters.length} files found</div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); clearAll(); }}
                                            style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                            title="Remove Series">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 48, color: 'var(--muted)', fontSize: 13, fontWeight: 600, gap: 8 }}>
                                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                        Click here to select a series...
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Preview pane — always visible, fills remaining space */}
                        <div style={{ padding: '14px 18px', background: 'var(--surface)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: results ? '#22c55e' : 'var(--muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {results ? (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                        Renaming completed ({results.length} files changed)
                                    </>
                                ) : 'Current chapters (Preview sorting):'}
                            </div>
                            {loadingChapters ? (
                                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading chapters...
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, flex: 1, minHeight: 120, maxHeight: 120, overflowY: 'auto', overflowX: 'auto' }} className="custom-scrollbar">
                                    {results ? (
                                        results.map((r, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5 }}>
                                                <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.old}</span>
                                                <span style={{ color: 'var(--muted)' }}>→</span>
                                                <span style={{ color: 'var(--text)', whiteSpace: 'nowrap', fontWeight: 500 }}>{r.new}</span>
                                            </div>
                                        ))
                                    ) : selectedManga ? (
                                        chapters.length > 0 ? chapters.map((c, i) => (
                                            <div key={i} style={{ fontSize: 11.5, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                                                <span style={{ color: 'var(--muted)', display: 'inline-block', width: 20, marginRight: 6 }}>{i + 1}.</span> {c}
                                            </div>
                                        )) : <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>No .cbz files found in this series directory.</div>
                                    ) : (
                                        <div style={{ fontSize: 11.5, color: 'var(--muted)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            Select a series to view its chapters.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Base Title + Prefix + Start from 00 */}
                    <div className="settings-card" style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', opacity: selectedManga ? 1 : 0.5, pointerEvents: selectedManga ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)' }}>2 · Base Title</div>
                            </div>
                            <input
                                value={baseName}
                                onChange={e => setBaseName(e.target.value)}
                                placeholder="Enter base title"
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ padding: '14px 18px', display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)' }}>Prefix</div>
                                <input
                                    value={customPrefix}
                                    onChange={e => setCustomPrefix(e.target.value)}
                                    placeholder=" - "
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)' }}>Start from 00</div>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 41, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                                    <input
                                        type="checkbox"
                                        checked={startFromZero}
                                        onChange={e => setStartFromZero(e.target.checked)}
                                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Example preview */}
                        <div style={{ padding: '14px 18px', flex: 1, display: 'flex', alignItems: 'center' }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)', width: '100%' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, color: 'var(--muted)' }}>Preview</div>
                                <code style={{ fontSize: 12, display: 'block', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontWeight: 500, wordBreak: 'break-all' }}>
                                    {baseName || 'Series Title'}{customPrefix}{startFromZero ? '00' : '01'}.cbz
                                </code>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Block — centered */}
                {selectedManga && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                            className="btn btn-primary"
                            onClick={executeRename}
                            disabled={!canSubmit || isRenaming}
                            style={{
                                width: '100%', maxWidth: 900, padding: '12px', borderRadius: 12, fontSize: 14,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                opacity: canSubmit ? 1 : 0.5
                            }}
                        >
                            {isRenaming ? (
                                <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'var(--bg)', borderTopColor: 'transparent' }} /> Processing...</>
                            ) : (
                                <>
                                    Batch Rename
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Results / Feedback */}
                {errorMsg && (
                    <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12.5, fontWeight: 500 }}>
                        {errorMsg}
                    </div>
                )}

                {showPicker && <SeriesPickerModal library={library} onSelect={setSelectedManga} onClose={() => setShowPicker(false)} />}
            </div>
        </div>
    );
};

export default SeriesRenamer;
