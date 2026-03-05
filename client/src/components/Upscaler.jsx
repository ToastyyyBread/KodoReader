import React, { useState, useEffect, useCallback, useRef } from 'react';
import CustomDropdown from './CustomDropdown';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import processingLottie from '../assets/Loader.lottie?url';
import { getApiBase } from '../runtime';

const API = '/api';
const BASE_URL = getApiBase();

// ── Model definitions ────────────────────────────────────
const REALESRGAN_MODEL_DESCRIPTIONS = {
    'realesrgan-x4plus': 'General-purpose - sharper, realistic detail',
    'realesrgan-x4plus-anime': 'Anime variant of x4plus',
    'realesrnet-x4plus': 'Cleaner restoration profile from RealESRNet',
};
const ESRGAN_SCALE_OPTIONS = [{ value: 2, label: '2x' }, { value: 4, label: '4x' }];

const normalizeRealEsrganModelId = (value) => {
    if (value === 'RealESRGAN_x4plus_anime_6B') return 'realesrgan-x4plus-anime';
    return String(value || '').trim();
};

const formatRealEsrganModelLabel = (value) => {
    const id = normalizeRealEsrganModelId(value);
    if (!id) return 'Unknown';
    return id
        .replace(/^realesrgan[-_]/i, '')
        .replace(/^realesrnet[-_]/i, 'realesrnet-')
        .replace(/[-_]+/g, ' ')
        .replace(/\bx\b(\d+)/gi, 'x$1')
        .replace(/\b\w/g, c => c.toUpperCase());
};

const formatChapterName = (name) => {
    if (!name) return name;
    const m = name.match(/chapter\s*[-_]?\s*([\d\.]+)/i);
    return m ? `Chapter - ${m[1].padStart(2, '0')}` : name;
};

// ── Series Library Modal ─────────────────────────────────
const SeriesPickerModal = ({ library, onSelect, onClose }) => {
    const [search, setSearch] = useState('');

    // Build flat list: main series + versions as separate entries
    const allEntries = [];
    for (const m of library) {
        allEntries.push({ ...m, _isVersion: false, _versionId: null, _versionLabel: null });
        if (Array.isArray(m.versions)) {
            for (const v of m.versions) {
                if (v.id === 'default') continue;
                allEntries.push({
                    ...m,
                    id: m.id,
                    title: `${m.title} — ${v.name}`,
                    cover: v.cover || m.cover,
                    chapterCount: v.chapterCount ?? m.chapterCount,
                    _isVersion: true,
                    _versionId: v.id,
                    _versionLabel: v.name,
                });
            }
        }
    }

    const filtered = allEntries.filter(m =>
        m.title.toLowerCase().includes(search.toLowerCase())
    );
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
                {/* header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Select Series</span>
                    <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                {/* search */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ position: 'relative' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search series or versions..."
                            autoFocus
                            style={{
                                width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8,
                                border: '1px solid var(--border)', background: 'var(--surface2)',
                                color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>
                {/* grid */}
                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                        {filtered.map((m, idx) => (
                            <div key={`${m.id}_${m._versionId || 'main'}_${idx}`} onClick={() => { onSelect(m); onClose(); }} style={{
                                borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                                border: `1.5px solid ${m._isVersion ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                                background: 'var(--surface2)',
                                transition: 'all 0.15s',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = m._isVersion ? 'rgba(99,102,241,0.3)' : 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                            >
                                <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: 'var(--surface)', position: 'relative' }}>
                                    {m.cover
                                        ? <img src={`${BASE_URL}${m.cover}`} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--muted)' }}>📖</div>
                                    }
                                    {m._isVersion && (
                                        <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.85)', color: '#fff' }}>{m._versionLabel}</div>
                                    )}
                                </div>
                                <div style={{ padding: '8px 8px 10px', fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, color: 'var(--text)' }}>
                                    {m._isVersion ? m._versionLabel : m.title}
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>
                                        {m._isVersion && <span style={{ color: 'var(--accent)', marginRight: 4 }}>{m.title.split(' — ')[0]}</span>}
                                        {m.chapterCount} ch.
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <div style={{ gridColumn: '1/-1', padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No series found</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Custom Components ─────────────────────────────────────
const Tooltip = ({ content, align = 'center' }) => {
    return (
        <div className="ui-tooltip">
            <button className="ui-tooltip-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </button>
            <div className={`ui-tooltip-content ${align !== 'center' ? `align-${align}` : ''}`}>
                {content}
            </div>
        </div>
    );
};

const ArchiveConfirmModal = ({ action, seriesId, onConfirm, onClose }) => {
    if (!action) return null;
    const isDelete = action === 'delete';
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9900,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
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
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: isDelete ? '#ef4444' : 'var(--text)' }}>
                        {isDelete ? 'Delete Archive' : 'Restore Archive'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                        {isDelete
                            ? `Are you sure you want to delete the archive for "${seriesId}"? This action cannot be undone.`
                            : `Are you sure you want to restore the archive for "${seriesId}"? This will overwrite your currently upscaled files.`}
                    </div>
                </div>
                <div style={{ padding: '16px 24px', background: 'var(--surface2)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button onClick={onClose} style={{
                        padding: '8px 16px', borderRadius: 8, background: 'transparent',
                        border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer'
                    }}>Cancel</button>
                    <button onClick={onConfirm} style={{
                        padding: '8px 16px', borderRadius: 8,
                        background: isDelete ? '#ef4444' : 'var(--accent)', border: 'none',
                        color: isDelete ? '#fff' : 'var(--bg)', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer'
                    }}>
                        {isDelete ? 'Delete' : 'Restore'}
                    </button>
                </div>
            </div>
        </div>
    );
};


const sendUpscaleNotification = (title, body) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/kodo_500.svg' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { if (p === 'granted') new Notification(title, { body, icon: '/kodo_500.svg' }); });
    }
};
// ── Main Component ───────────────────────────────────────
let cachedGpuStatus = null;
let isFetchingGpu = false;

const Upscaler = () => {
    const [library, setLibrary] = useState([]);
    const [selectedManga, setSelectedManga] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('kodo_upscaler_manga')) || null; } catch { return null; }
    });
    const [selectedVersionId, setSelectedVersionId] = useState(() => sessionStorage.getItem('kodo_upscaler_version') || null);
    const [chapters, setChapters] = useState([]);
    const [loadingChapters, setLoadingChapters] = useState(false);
    const [startIdx, setStartIdx] = useState(() => parseInt(sessionStorage.getItem('kodo_upscaler_start')) || 1);
    const [endIdx, setEndIdx] = useState(() => parseInt(sessionStorage.getItem('kodo_upscaler_end')) || 1);
    const [waifu2xModel] = useState('waifu2x');
    const [waifu2xDenoiseLevel, setWaifu2xDenoiseLevel] = useState(1);
    const [waifu2xScale, setWaifu2xScale] = useState(2);
    const [waifu2xWorkers, setWaifu2xWorkers] = useState(3);
    const [waifu2xModelDir, setWaifu2xModelDir] = useState('models-cunet');
    const [waifu2xModelDirs, setWaifu2xModelDirs] = useState([]);
    const [realesrganModel, setRealesrganModel] = useState('realesrgan-x4plus-anime');
    const [realesrganModels, setRealesrganModels] = useState([]);
    const [esrganScale, setEsrganScale] = useState(2);
    const [esrganDenoise, setEsrganDenoise] = useState(-1);
    const [esrganWorkers, setEsrganWorkers] = useState(1);
    const [activeModel, setActiveModel] = useState(() => sessionStorage.getItem('kodo_upscaler_model') || null);

    useEffect(() => {
        if (selectedManga) sessionStorage.setItem('kodo_upscaler_manga', JSON.stringify(selectedManga));
        else sessionStorage.removeItem('kodo_upscaler_manga');
    }, [selectedManga]);

    useEffect(() => {
        if (selectedVersionId) sessionStorage.setItem('kodo_upscaler_version', selectedVersionId);
        else sessionStorage.removeItem('kodo_upscaler_version');
    }, [selectedVersionId]);

    useEffect(() => {
        if (activeModel) sessionStorage.setItem('kodo_upscaler_model', activeModel);
        else sessionStorage.removeItem('kodo_upscaler_model');
    }, [activeModel]);

    useEffect(() => {
        if (startIdx) sessionStorage.setItem('kodo_upscaler_start', startIdx);
        if (endIdx) sessionStorage.setItem('kodo_upscaler_end', endIdx);
    }, [startIdx, endIdx]);
    const [queue, setQueue] = useState([]);
    const [addingToQueue, setAddingToQueue] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [upscaleSettings, setUpscaleSettings] = useState(null);
    const [activeTab, setActiveTab] = useState('upscaler');
    const [archive, setArchive] = useState([]);
    const [archiveAction, setArchiveAction] = useState(null); // { type, seriesId, chapters }
    const [archiveSelectedChapters, setArchiveSelectedChapters] = useState({}); // { mangaId: Set }
    const [esrganModelCheck, setEsrganModelCheck] = useState({});
    const [previewJob, setPreviewJob] = useState(null);
    const [gpuStatus, setGpuStatus] = useState(() => cachedGpuStatus);
    const [gpuChecking, setGpuChecking] = useState(!cachedGpuStatus);
    const [packageState, setPackageState] = useState(null);

    const [upscaleType, setUpscaleType] = useState('chapters'); // 'chapters' | 'cover'
    const persistUpscalePatch = useCallback((patch) => {
        if (!patch || typeof patch !== 'object') return;
        setUpscaleSettings(prev => ({ ...(prev || {}), ...patch }));
        fetch(`${API}/upscale/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        }).catch(() => { });
    }, []);

    // ── Fetches ──────────────────────────────────────────
    useEffect(() => {
        fetch(`${API}/manga`).then(r => r.json()).then(setLibrary).catch(() => { });
        const fetchUpscaleSettings = () => fetch(`${API}/upscale/settings`).then(r => r.json()).then(s => {
            setUpscaleSettings(s);
            if (s.waifu2xDenoiseLevel !== undefined) setWaifu2xDenoiseLevel(s.waifu2xDenoiseLevel);
            if (s.waifu2xScale !== undefined) setWaifu2xScale(s.waifu2xScale);
            if (s.waifu2xWorkers !== undefined) setWaifu2xWorkers(s.waifu2xWorkers);
            if (s.waifu2xModelDir !== undefined) setWaifu2xModelDir(s.waifu2xModelDir);
            if (s.realesrganModel !== undefined) setRealesrganModel(normalizeRealEsrganModelId(s.realesrganModel));
            if (s.esrganScale !== undefined) setEsrganScale(s.esrganScale || 2);
            if (s.esrganWorkers !== undefined) setEsrganWorkers(s.esrganWorkers);
        }).catch(() => { });
        fetchUpscaleSettings();
        fetch(`${API}/upscale/archive`).then(r => r.json()).then(setArchive).catch(() => { });

        if (cachedGpuStatus) {
            setGpuStatus(cachedGpuStatus);
            setGpuChecking(false);
        } else if (!isFetchingGpu) {
            isFetchingGpu = true;
            setGpuChecking(true);
            const minDelay = new Promise(r => setTimeout(r, 1000));
            const gpuFetch = fetch(`${API}/upscale/gpu-check`).then(r => r.json());
            Promise.all([gpuFetch, minDelay]).then(([res]) => {
                cachedGpuStatus = res;
                setGpuStatus(res);
                isFetchingGpu = false;
                setGpuChecking(false);
            }).catch(() => { isFetchingGpu = false; setGpuChecking(false); });
        }

        const pollUpscale = () => {
            fetch('/api/upscale/package-state').then(r => r.json()).then(setPackageState).catch(() => { });
            fetchUpscaleSettings();
        };
        pollUpscale();
        const pkgIntv = setInterval(pollUpscale, 1500);
        return () => clearInterval(pkgIntv);
    }, []);

    useEffect(() => {
        if (packageState?.status === 'done' || packageState?.status === 'idle') {
            fetch(`${API}/upscale/settings`).then(r => r.json()).then(s => {
                setUpscaleSettings(s);
            }).catch(() => { });
        }
    }, [packageState?.status]);

    useEffect(() => {
        if (!selectedManga) { setChapters([]); setStartIdx(1); setEndIdx(1); setSelectedVersionId(null); return; }
        setLoadingChapters(true);
        setSelectedVersionId(selectedManga._versionId || null);
        const versionParam = selectedManga._versionId ? `?version=${encodeURIComponent(selectedManga._versionId)}` : '';
        fetch(`${API}/manga/${encodeURIComponent(selectedManga.id)}${versionParam}`)
            .then(r => r.json())
            .then(data => {
                // chapters can be strings or objects with .name
                const raw = data.chapters || [];
                const chs = raw.map(c => typeof c === 'string' ? c : c.name);
                setChapters(chs);
                if (chs.length > 0) { setStartIdx(1); setEndIdx(chs.length); }
            })
            .catch(() => setChapters([]))
            .finally(() => setLoadingChapters(false));
    }, [selectedManga]);

    const fetchQueue = useCallback(() => {
        fetch(`${API}/upscale/queue`).then(r => r.json()).then(setQueue).catch(() => { });
    }, []);

    useEffect(() => {
        if (upscaleSettings?.realesrganPath) {
            fetch(`${API}/upscale/realesrgan-models`)
                .then(r => r.json())
                .then(models => {
                    const detected = Array.isArray(models)
                        ? Array.from(new Set(models.map(normalizeRealEsrganModelId).filter(Boolean))).sort((a, b) => a.localeCompare(b))
                        : [];
                    setRealesrganModels(detected);
                    if (detected.length > 0) {
                        setRealesrganModel(prev => {
                            const current = normalizeRealEsrganModelId(prev || upscaleSettings?.realesrganModel || '');
                            const next = detected.includes(current) ? current : detected[0];
                            if (next && next !== current) {
                                persistUpscalePatch({ realesrganModel: next, esrganScale: 2 });
                            }
                            return next || current;
                        });
                    }
                    const targets = detected.length > 0
                        ? detected
                        : [normalizeRealEsrganModelId(upscaleSettings?.realesrganModel || 'realesrgan-x4plus-anime')];
                    targets.forEach(modelId => {
                        fetch(`${API}/upscale/check-model?model=${encodeURIComponent(modelId)}`)
                            .then(r => r.json())
                            .then(result => setEsrganModelCheck(prev => ({ ...prev, [modelId]: result })))
                            .catch(() => { });
                    });
                })
                .catch(() => { });
        }
        if (upscaleSettings?.waifu2xPath) {
            fetch(`${API}/upscale/waifu2x-models`)
                .then(r => r.json())
                .then(dirs => { if (Array.isArray(dirs) && dirs.length) setWaifu2xModelDirs(dirs); })
                .catch(() => { });
        }
    }, [upscaleSettings, persistUpscalePatch]);

    const prevUpscaleRunning = useRef(false);
    useEffect(() => {
        fetchQueue();
        const id = setInterval(() => {
            fetch(`${API}/upscale/queue`).then(r => r.json()).then(q => {
                setQueue(q);
                const wasRunning = prevUpscaleRunning.current;
                const nowRunning = Array.isArray(q) && q.some(j => j.status === 'processing' || j.status === 'pending');
                prevUpscaleRunning.current = nowRunning;
                if (wasRunning && !nowRunning && Array.isArray(q) && q.length > 0) {
                    sendUpscaleNotification('Kōdo Upscaler', 'All upscale jobs have finished!');
                }
            }).catch(() => { });
        }, 2000);
        return () => clearInterval(id);
    }, []);

    // ── Derived ──────────────────────────────────────────
    const isInvalidRange = startIdx > endIdx || startIdx < 1 || (chapters.length > 0 && endIdx > chapters.length);
    const selectedChapters = (() => {
        if (!chapters.length || isInvalidRange) return [];
        return chapters.slice(startIdx - 1, endIdx);
    })();

    // Exe status
    const waifu2xOk = upscaleSettings && upscaleSettings.waifu2xPath;
    const realesrganOk = upscaleSettings && upscaleSettings.realesrganPath;
    const exeReady = activeModel === 'waifu2x' ? waifu2xOk : activeModel === 'realesrgan' ? realesrganOk : false;

    const resolvedModel = activeModel === 'waifu2x' ? waifu2xModel : realesrganModel;
    const canSubmit = selectedManga && activeModel && (upscaleType === 'cover' || (selectedChapters.length > 0 && !isInvalidRange));
    const activeJob = queue.find(j => j.status === 'processing');
    const isProcessing = !!activeJob;

    // ── Handlers ─────────────────────────────────────────
    const addToQueue = async () => {
        if (!canSubmit) return;
        setAddingToQueue(true);
        try {
            await fetch(`${API}/upscale/add`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mangaId: selectedManga.id, mangaTitle: selectedManga.title,
                    chapters: upscaleType === 'cover' ? ['__COVER__'] : selectedChapters,
                    model: resolvedModel,
                    scale: activeModel === 'waifu2x' ? waifu2xScale : esrganScale,
                    denoiseLevel: activeModel === 'waifu2x' ? waifu2xDenoiseLevel : esrganDenoise,
                    maxWorkers: activeModel === 'waifu2x' ? waifu2xWorkers : esrganWorkers,
                    waifu2xModelDir: activeModel === 'waifu2x' ? waifu2xModelDir : undefined,
                    versionId: selectedVersionId || undefined,
                }),
            });
            fetchQueue();
        } catch { }
        setAddingToQueue(false);
    };

    const removeFromQueue = async (jobId) => {
        await fetch(`${API}/upscale/remove/${jobId}`, { method: 'DELETE' });
        fetchQueue();
    };

    const abort = async () => {
        await fetch(`${API}/upscale/abort`, { method: 'POST' });
        fetchQueue();
    };

    const removeFromQueueSeries = async (mangaId) => {
        await fetch(`${API}/upscale/remove-series/${mangaId}`, { method: 'DELETE' });
        fetchQueue();
    };

    const finalizeJob = async (jobId, action) => {
        await fetch(`${API}/upscale/finalize`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId, action })
        });
        fetchQueue();
        if (action === 'keep') {
            fetch(`${API}/upscale/archive`).then(r => r.json()).then(setArchive).catch(() => { });
        }
    };

    const discardJob = async (jobId) => {
        await fetch(`${API}/upscale/discard`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId })
        });
        fetchQueue();
    };

    const openPreview = async (job) => {
        // pick first chapter for preview
        const chapter = job.chapters[0];
        const url = `${API}/upscale/preview-images/${job.id}?chapter=${encodeURIComponent(chapter)}`;
        const images = await fetch(url).then(r => r.json()).catch(() => []);
        setPreviewJob({ job, chapter, images });
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

    const clearAll = () => {
        setSelectedManga(null);
        setActiveModel(null);
        setStartIdx(1);
        setEndIdx(1);
        sessionStorage.removeItem('kodo_upscaler_manga');
        sessionStorage.removeItem('kodo_upscaler_version');
        sessionStorage.removeItem('kodo_upscaler_model');
        sessionStorage.removeItem('kodo_upscaler_start');
        sessionStorage.removeItem('kodo_upscaler_end');
    };

    // ── Render ───────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Topbar */}
            <div className="topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
                <h2 className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lightning-fill" viewBox="0 0 16 16">
                        <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641z" />
                    </svg>
                    AI Upscaling
                    <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>
                        Integrated Upscaling Tool — Native support for CBZ and PDF files.
                    </span>
                </h2>
                <button onClick={clearAll} style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface2)', color: 'var(--text)', fontSize: 12,
                    fontWeight: 600, cursor: (selectedManga || activeModel) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                    opacity: (selectedManga || activeModel) ? 1 : 0,
                    pointerEvents: (selectedManga || activeModel) ? 'auto' : 'none',
                }} onMouseEnter={e => { if (selectedManga || activeModel) e.currentTarget.style.background = 'var(--surface)'; }} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Clear All
                </button>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: 0, padding: '0 32px', borderBottom: '1px solid var(--border)' }}>
                {['upscaler', 'archive'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: '10px 20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                        background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                        color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
                        textTransform: 'capitalize', transition: 'all 0.15s', letterSpacing: 0.5,
                    }}>
                        {tab === 'archive' ? `Archive (${archive.length})` : 'Upscaler'}
                    </button>
                ))}
            </div>

            {
                activeTab === 'upscaler' ? (
                    <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* GPU banner */}
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                            background: gpuStatus && gpuStatus.supported === false ? 'rgba(239,68,68,0.07)' : 'rgba(99,102,241,0.07)',
                            border: `1px solid ${gpuStatus && gpuStatus.supported === false ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`,
                            borderRadius: 10, fontSize: 12.5, color: 'var(--text)',
                        }}>
                            <svg style={{ flexShrink: 0, marginTop: 1 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={gpuStatus && gpuStatus.supported === false ? '#ef4444' : 'var(--accent)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                            </svg>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span><strong>GPU Required</strong> — NCNN Vulkan works with <strong>NVIDIA</strong> and <strong>AMD</strong> GPUs.</span>
                                {gpuChecking && !gpuStatus && (
                                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <svg className="spin-dynamic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4m0 12v4m-7.07-2.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4m-2.93 7.07l-2.83-2.83M6.76 6.76L3.93 3.93" /></svg>
                                        Checking GPU...
                                    </span>
                                )}
                                {gpuStatus && (
                                    <span style={{ fontSize: 11, color: gpuStatus.supported ? '#22c55e' : (gpuStatus.ok ? '#ef4444' : 'var(--muted)'), fontWeight: 600 }}>
                                        {gpuStatus.supported
                                            ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                                                        <path d="M4 8a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0m7.5-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" />
                                                        <path d="M0 1.5A.5.5 0 0 1 .5 1h1a.5.5 0 0 1 .5.5V4h13.5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H2v2.5a.5.5 0 0 1-1 0V2H.5a.5.5 0 0 1-.5-.5m5.5 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M9 8a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0" />
                                                        <path d="M3 12.5h3.5v1a.5.5 0 0 1-.5.5H3.5a.5.5 0 0 1-.5-.5zm4 1v-1h4v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5" />
                                                    </svg>
                                                    GPU Supported! {gpuStatus.gpus.join(', ')}
                                                </span>
                                            )
                                            : (gpuStatus.ok ? `No supported GPU detected (${gpuStatus.gpus.join(', ') || 'None'}). Upscaling may fail or run extremely slow!` : `Could not verify GPU status: ${gpuStatus.message || 'Error occurred'}`)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── Step 1: Series ─────────────────────── */}
                        <div className="settings-card">
                            <div style={{ padding: '14px 18px', borderBottom: selectedManga ? '1px solid var(--border)' : 'none' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>1 · Select Series</div>
                                <div
                                    onClick={() => setShowPicker(true)}
                                    style={{
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
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedManga(null); }}
                                                style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                                title="Remove Series"
                                            >
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

                            {/* ── Step 2: Target ─────────── */}
                            {selectedManga && (
                                <div style={{ padding: '14px 18px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                                        2 · Select Target
                                    </div>
                                    <div style={{ display: 'flex', background: 'var(--surface)', padding: 4, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 14 }}>
                                        <div onClick={() => setUpscaleType('chapters')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 600, background: upscaleType === 'chapters' ? 'var(--surface2)' : 'transparent', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s', color: upscaleType === 'chapters' ? 'var(--text)' : 'var(--muted)' }}>Chapters</div>
                                        <div onClick={() => setUpscaleType('cover')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 12, fontWeight: 600, background: upscaleType === 'cover' ? 'var(--surface2)' : 'transparent', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s', color: upscaleType === 'cover' ? 'var(--text)' : 'var(--muted)' }}>Cover Only</div>
                                    </div>

                                    {upscaleType === 'cover' ? (
                                        <div style={{ padding: '10px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>
                                            Upscale the main cover image of this series.
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                                                Range
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
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Start Chapter</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: `1px solid ${isInvalidRange ? '#ef4444' : 'var(--border)'}`, borderRadius: 6, overflow: 'hidden' }}>
                                                                    <button
                                                                        onClick={() => setStartIdx(v => Math.max(1, v - 1))}
                                                                        style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>-</button>
                                                                    <input
                                                                        type="number" min="1" max={chapters.length}
                                                                        value={startIdx} onChange={e => setStartIdx(parseInt(e.target.value) || 1)}
                                                                        className="hide-spin"
                                                                        style={{ ...inputStyle, width: 44, border: 'none', padding: '6px 0', borderRadius: 0, background: 'transparent' }}
                                                                    />
                                                                    <button
                                                                        onClick={() => setStartIdx(v => Math.min(chapters.length, v + 1))}
                                                                        style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>+</button>
                                                                </div>
                                                                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                                                    {formatChapterName(chapters[Math.max(0, Math.min(startIdx - 1, chapters.length - 1))])}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ width: 1, height: 32, background: 'var(--border)', alignSelf: 'center', margin: '0 4px' }} />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>End Chapter</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: `1px solid ${isInvalidRange ? '#ef4444' : 'var(--border)'}`, borderRadius: 6, overflow: 'hidden' }}>
                                                                    <button
                                                                        onClick={() => setEndIdx(v => Math.max(1, v - 1))}
                                                                        style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>-</button>
                                                                    <input
                                                                        type="number" min="1" max={chapters.length}
                                                                        value={endIdx} onChange={e => setEndIdx(parseInt(e.target.value) || 1)}
                                                                        className="hide-spin"
                                                                        style={{ ...inputStyle, width: 44, border: 'none', padding: '6px 0', borderRadius: 0, background: 'transparent' }}
                                                                    />
                                                                    <button
                                                                        onClick={() => setEndIdx(v => Math.min(chapters.length, v + 1))}
                                                                        style={{ padding: '6px 10px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: 14, fontWeight: 'bold' }}>+</button>
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
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Step 3: Model Selection (side-by-side) */}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>3 · Select Model</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                                {/* Waifu2x card */}
                                <div
                                    onClick={() => setActiveModel(prev => prev === 'waifu2x' ? null : 'waifu2x')}
                                    style={{
                                        ...modelCardStyle,
                                        border: `1.5px solid ${activeModel === 'waifu2x' ? 'var(--accent)' : 'var(--border)'}`,
                                        background: activeModel === 'waifu2x' ? 'rgba(99,102,241,0.05)' : 'var(--surface2)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>Waifu2x (Support All GPU's)</div>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#22c55e18', color: '#22c55e', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fast</span>
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
                                        Precision Manga/Manhwa Upscaling & Intelligent Noise Reduction
                                    </div>
                                    {/* Model directory dropdown */}
                                    <div onClick={e => e.stopPropagation()} style={{ marginBottom: 8 }}>
                                        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>
                                            Model
                                            <Tooltip align="left" content="The base waifu2x algorithm to use. 'cunet' is highly recommended for anime art." />
                                        </div>
                                        <CustomDropdown
                                            value={waifu2xModelDir}
                                            onChange={val => {
                                                setWaifu2xModelDir(val);
                                                setActiveModel('waifu2x');
                                                persistUpscalePatch({ waifu2xModelDir: val });
                                            }}
                                            items={waifu2xModelDirs.length > 0
                                                ? waifu2xModelDirs.map(d => ({ value: d, label: d.replace('models-', '') }))
                                                : [{ value: 'models-cunet', label: 'cunet (default)' }]}
                                            className="upscaler-setting-dropdown"
                                        />
                                    </div>
                                    {/* Settings: Scale & Denoise */}
                                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                Upscaling
                                                <Tooltip align="left" content="Multiplier for the resolution. E.g., 2× turns a 1000px wide image into 2000px." />
                                            </div>
                                            <CustomDropdown
                                                value={waifu2xScale}
                                                onChange={val => { setWaifu2xScale(val); setActiveModel('waifu2x'); }}
                                                items={[
                                                    { value: 1, label: '1×' },
                                                    { value: 2, label: '2×' },
                                                    { value: 4, label: '4×' },
                                                    { value: 8, label: '8×' }
                                                ]}
                                            />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                Denoise Strength
                                                <Tooltip align="left" content={
                                                    <>
                                                        How aggressively to remove JPEG compression/artifacts. Higher values might smooth over smaller details. <br /><br />
                                                        <strong>None</strong>: (upscale only)<br />
                                                        <strong>Weak</strong>: (image is already clean)<br />
                                                        <strong>Medium</strong>: (recommended, standard for manga)<br />
                                                        <strong>High</strong>: (noisy/grainy images)<br />
                                                        <strong>Highest</strong>: (very poor quality, heavy noise)
                                                    </>
                                                } />


                                            </div>
                                            <CustomDropdown
                                                value={waifu2xDenoiseLevel}
                                                onChange={val => { setWaifu2xDenoiseLevel(val); setActiveModel('waifu2x'); }}
                                                items={[
                                                    { value: -1, label: 'None' },
                                                    { value: 0, label: 'Weak' },
                                                    { value: 1, label: 'Medium (Default)' },
                                                    { value: 2, label: 'High' },
                                                    { value: 3, label: 'Max' }
                                                ]}
                                            />
                                        </div>
                                    </div>
                                    {/* Workers setting */}
                                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 6 }}>
                                        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>
                                            Parallel Processing
                                        </div>
                                        <CustomDropdown
                                            value={waifu2xWorkers}
                                            onChange={val => { setWaifu2xWorkers(val); setActiveModel('waifu2x'); }}
                                            items={[
                                                { value: 1, label: '1 Instances (Slow)' },
                                                { value: 3, label: '3 Instances (Fast)' },
                                                { value: 6, label: '6 Instances (Very Fast)' },
                                                { value: 10, label: '10 Instances (Extreme)' }
                                            ]}
                                        />
                                    </div>
                                    {upscaleSettings !== null && !waifu2xOk && (
                                        <div onClick={e => e.stopPropagation()} style={{
                                            position: 'absolute', inset: 0, borderRadius: 12, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 20, textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Model Not Detected</div>
                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>Waifu2x requires model files to be downloaded before it can be used.</div>
                                            {packageState && (['downloading', 'extracting'].includes(packageState.status)) ? (
                                                <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>
                                                    {packageState.status === 'extracting' ? 'Extracting...' : `Downloading ${packageState.progress}%`}
                                                </div>
                                            ) : packageState && packageState.status === 'error' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, maxWidth: '90%' }}>
                                                    <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>{packageState.error || 'Download failed.'}</div>
                                                    <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}
                                                        onClick={() => fetch(API + '/upscale/install-package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reinstall: true }) })}>
                                                        Retry Download
                                                    </button>
                                                </div>
                                            ) : (
                                                <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}
                                                    onClick={() => fetch(API + '/upscale/install-package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reinstall: true }) })}>
                                                    Download Waifu2x Models
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>


                                {/* RealESRGAN card */}
                                <div
                                    onClick={() => setActiveModel(prev => prev === 'realesrgan' ? null : 'realesrgan')}
                                    style={{
                                        ...modelCardStyle,
                                        border: `1.5px solid ${activeModel === 'realesrgan' ? 'var(--accent)' : 'var(--border)'}`,
                                        background: activeModel === 'realesrgan' ? 'rgba(99,102,241,0.05)' : 'var(--surface2)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>Real-ESRGAN</div>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#f1636318', color: '#f16363ff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Heavy</span>
                                    </div>
                                    <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 12 }}>
                                        Advanced Detail Reconstruction & AI-Powered Enhancement
                                    </div>
                                    {/* Model dropdown */}
                                    <div onClick={e => e.stopPropagation()} style={{ marginBottom: 8 }}>
                                        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>
                                            Model
                                            <Tooltip content="Model list is detected automatically from the Real-ESRGAN models folder." />
                                        </div>
                                        <CustomDropdown
                                            value={realesrganModel}
                                            onChange={val => {
                                                const normalized = normalizeRealEsrganModelId(val);
                                                setRealesrganModel(normalized);
                                                setActiveModel('realesrgan');
                                                persistUpscalePatch({ realesrganModel: normalized, esrganScale: 4 });
                                            }}
                                            items={(realesrganModels.length > 0 ? realesrganModels : [realesrganModel || 'realesrgan-x4plus-anime'])
                                                .map(m => ({ value: m, label: formatRealEsrganModelLabel(m) }))}
                                        />
                                        {realesrganModel && (
                                            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 5 }}>
                                                {REALESRGAN_MODEL_DESCRIPTIONS[normalizeRealEsrganModelId(realesrganModel)] || 'Detected from models folder.'}
                                            </div>
                                        )}
                                    </div>
                                    {/* ESRGAN Settings: Scale & Denoise */}
                                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 10 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                Upscaling
                                                <Tooltip align="right" content="Multiplier for the resolution. (Note: Output size depends on the natively supported scale of the chosen model)" />
                                            </div>
                                            <CustomDropdown
                                                value={esrganScale}
                                                onChange={() => { setEsrganScale(4); setActiveModel('realesrgan'); }}
                                                items={ESRGAN_SCALE_OPTIONS}
                                            />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                Denoise Strength
                                                <Tooltip align="right" content={
                                                    "How aggressively to remove JPEG compression/artifacts."} />
                                            </div>
                                            <CustomDropdown
                                                value={esrganDenoise}
                                                onChange={val => { setEsrganDenoise(val); setActiveModel('realesrgan'); }}
                                                items={[
                                                    { value: -1, label: 'None (Default)' },
                                                    { value: 0, label: 'Weak' },
                                                    { value: 1, label: 'Medium' },
                                                    { value: 2, label: 'High' },
                                                    { value: 3, label: 'Max' }
                                                ]}
                                            />
                                        </div>
                                    </div>
                                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 6 }}>
                                        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>
                                            Parallel Processing
                                            <Tooltip
                                                align="right"
                                                content={
                                                    <>
                                                        Number of images processed simultaneously using Real-ESRGAN.<br /><br />
                                                        <strong>1</strong>: ~1.5–2 GB VRAM (safe for most GPUs)<br />
                                                        <strong>3</strong>: ~3–4 GB VRAM (recommended)<br />
                                                        <strong>5</strong>: ~5–7 GB VRAM (high-performance GPUs)<br /><br />
                                                        Actual VRAM usage may vary depending on image resolution and model.
                                                    </>
                                                }
                                            />
                                        </div>
                                        <CustomDropdown
                                            value={esrganWorkers}
                                            onChange={val => { setEsrganWorkers(val); setActiveModel('realesrgan'); }}
                                            items={[
                                                { value: 1, label: '1 Instances (Slow)' },
                                                { value: 3, label: '3 Instances (Fast)' },
                                                { value: 5, label: '5 Instances (Extreme)' }
                                            ]}
                                        />
                                    </div>
                                    {/* Per-model file check */}
                                    {(() => {
                                        const check = esrganModelCheck[realesrganModel];
                                        if (check && !check.ok) {
                                            return (
                                                <div style={{ marginTop: 8, fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                                                    <span style={{ color: '#ef4444' }}>Missing: {check.missing.join(', ')}</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    {upscaleSettings !== null && !realesrganOk && (
                                        <div onClick={e => e.stopPropagation()} style={{
                                            position: 'absolute', inset: 0, borderRadius: 12, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 20, textAlign: 'center'
                                        }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Model Not Detected</div>
                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>RealESRGAN requires model files to be downloaded before it can be used.</div>
                                            {packageState && (['downloading', 'extracting'].includes(packageState.status)) ? (
                                                <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>
                                                    {packageState.status === 'extracting' ? 'Extracting...' : `Downloading ${packageState.progress}%`}
                                                </div>
                                            ) : packageState && packageState.status === 'error' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, maxWidth: '90%' }}>
                                                    <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>{packageState.error || 'Download failed.'}</div>
                                                    <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}
                                                        onClick={() => fetch(API + '/upscale/install-package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reinstall: true }) })}>
                                                        Retry Download
                                                    </button>
                                                </div>
                                            ) : (
                                                <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 12 }}
                                                    onClick={() => fetch(API + '/upscale/install-package', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reinstall: true }) })}>
                                                    Download RealESRGAN Models
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Exe warning */}
                        {
                            activeModel && !exeReady && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                                    borderRadius: 8, fontSize: 12, color: '#ef4444',
                                }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                                    <span>Executable path for <strong>{activeModel === 'waifu2x' ? 'Waifu2x' : 'RealESRGAN'}</strong> is not configured. Go to <strong>Settings → Upscale</strong> to set it.</span>
                                </div>
                            )
                        }

                        {/* End Setup */}

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
                                                                        Model: {(job.model === 'waifu2x'
                                                                            ? `Waifu2x (${job.waifu2xModelDir ? job.waifu2xModelDir.replace('models-', '') : 'cunet'})`
                                                                            : formatRealEsrganModelLabel(job.model))}
                                                                        {job.scale ? ` · ${job.scale}×` : ''}
                                                                    </div>
                                                                </div>
                                                                {job.status === 'processing' ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.1)', padding: '2px 10px 2px 4px', borderRadius: 99 }}>
                                                                        {(job.progress.pagesCurrent === 0 && !(job.progress.stagePercent > 0)) ? (
                                                                            /* Modern pulsing ellipse for Loading Model */
                                                                            <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                <div style={{
                                                                                    width: 10, height: 10, borderRadius: '50%',
                                                                                    background: '#6366f1',
                                                                                    animation: 'ellipsePulse 1.2s ease-in-out infinite',
                                                                                    boxShadow: '0 0 8px rgba(99,102,241,0.5)',
                                                                                }} />
                                                                            </div>
                                                                        ) : (
                                                                            /* AI-style orbital processing animation */
                                                                            <div className="ai-process-ring">
                                                                                <div className="ai-core" />
                                                                                <div className="ai-orbit" />
                                                                                <div className="ai-orbit" />
                                                                                <div className="ai-orbit" />
                                                                            </div>
                                                                        )}
                                                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1' }}>
                                                                            {(job.progress.pagesCurrent === 0 && !(job.progress.stagePercent > 0)) ? 'Loading Model' : 'Processing'}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <StatusBadge status={job.status} />
                                                                )}
                                                            </div>

                                                            {/* Dual progress bars */}
                                                            {job.status === 'processing' && (() => {
                                                                const chPct = Math.max(2, ((job.progress.current + 1) / job.progress.total) * 100);
                                                                const pgPct = job.progress.pagesTotal > 0
                                                                    ? (job.progress.pagesCurrent / job.progress.pagesTotal) * 100
                                                                    : 0;
                                                                const stagePct = Number(job.progress.stagePercent || 0);
                                                                const isWaiting = job.progress.pagesCurrent === 0 && stagePct <= 0;
                                                                return (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                        {/* Page bar (Now on top) */}
                                                                        <div>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>
                                                                                <span>{isWaiting ? 'Waiting…' : (job.progress.pagesCurrent === 0 ? `Processing (${Math.round(stagePct)}%)` : `Pages (${Math.round(pgPct)}%)`)}</span>
                                                                                {job.progress.pagesCurrent > 0 && <span>{job.progress.pagesCurrent} / {job.progress.pagesTotal}</span>}
                                                                            </div>
                                                                            <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', position: 'relative' }}>
                                                                                {isWaiting ? (
                                                                                    <div style={{
                                                                                        position: 'absolute', top: 0, height: '100%', width: '30%', borderRadius: 2,
                                                                                        background: 'linear-gradient(90deg, transparent, #6366f1aa, transparent)',
                                                                                        animation: 'scanSlide 1.4s ease-in-out infinite',
                                                                                    }} />
                                                                                ) : job.progress.pagesCurrent === 0 ? (
                                                                                    <div style={{
                                                                                        height: '100%', borderRadius: 2, background: '#6366f1',
                                                                                        width: `${Math.max(3, Math.min(99, stagePct))}%`,
                                                                                        transition: 'width 0.35s ease',
                                                                                    }} />
                                                                                ) : (
                                                                                    <div style={{
                                                                                        height: '100%', borderRadius: 2, background: '#22c55e',
                                                                                        width: `${pgPct}%`,
                                                                                        transition: 'width 0.5s ease',
                                                                                        minWidth: pgPct > 0 ? 4 : 0,
                                                                                    }} />
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {/* Overall chapter bar (Now below) */}
                                                                        <div>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>
                                                                                <span style={{ fontWeight: 600, color: 'var(--text)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                    {job.progress.currentChapter || 'Starting…'}
                                                                                </span>
                                                                                <span>Ch {job.progress.current + 1} / {job.progress.total}</span>
                                                                            </div>
                                                                            <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                                                                                <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent)', width: `${chPct}%`, transition: 'width 0.6s ease' }} />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {job.status === 'review' && (
                                                                <div style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)', padding: '12px 14px', borderRadius: 8, marginTop: 4 }}>
                                                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#eab308', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                                                        Finished
                                                                    </div>
                                                                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, paddingLeft: 24, lineHeight: 1.4 }}>
                                                                        Completed Chapters: {job.chapters.length} ({job.chapters.join(', ')})
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: 8, paddingLeft: 24 }}>
                                                                        <button onClick={() => finalizeJob(job.id, 'keep')} style={{
                                                                            flex: 1, padding: '9px 0', borderRadius: 6, background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', color: '#eab308', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                                                                        }}>Replace & Keep Original</button>
                                                                        <button onClick={() => finalizeJob(job.id, 'delete')} style={{
                                                                            flex: 1, padding: '9px 0', borderRadius: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                                                                        }}>Replace & Delete Original</button>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                                                                        <button onClick={() => discardJob(job.id)} style={{
                                                                            background: 'none', border: 'none', color: 'var(--muted)', fontSize: 10.5, cursor: 'pointer', fontWeight: 500, padding: '4px 8px', textDecoration: 'underline'
                                                                        }}>Discard Upscaled Images</button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {job.status === 'error' && job.error && (
                                                                <div style={{ fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.07)', padding: '6px 10px', borderRadius: 6 }}>
                                                                    {job.error}
                                                                </div>
                                                            )}
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
                        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                            <button
                                onClick={addToQueue} disabled={addingToQueue || !canSubmit}
                                style={{
                                    width: '100%', padding: '13px 0', borderRadius: 10,
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
                                        Processing {activeJob?.mangaTitle || ''}…
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
                                        {addingToQueue ? 'Starting…' : 'Start Upscaling'}
                                    </>
                                )}
                            </button>
                            {isProcessing && (
                                <button onClick={async () => {
                                    await fetch(`${API}/upscale/abort`, { method: 'POST' });
                                    fetchQueue();
                                }} style={{
                                    width: '100%', marginTop: 8, padding: '13px 0', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)',
                                    background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 14, fontWeight: 700,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s'
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
                                <div style={{ fontSize: 12 }}>When you upscale with "Keep Original" enabled, the originals will appear here.</div>
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
                )
            }

            {showPicker && <SeriesPickerModal library={library} onSelect={setSelectedManga} onClose={() => setShowPicker(false)} />}
            <ArchiveConfirmModal
                action={archiveAction?.type}
                seriesId={archiveAction?.seriesId}
                onClose={() => setArchiveAction(null)}
                onConfirm={() => {
                    const { type, seriesId, chapters: selectedChaptersArr } = archiveAction;
                    const opts = selectedChaptersArr ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chapters: selectedChaptersArr }) } : { method: type === 'restore' ? 'POST' : 'DELETE' };
                    if (type === 'restore') {
                        fetch(`${API}/upscale/archive/restore/${seriesId}`, opts)
                            .then(() => {
                                fetch(`${API}/upscale/archive`).then(r => r.json()).then(setArchive);
                                setArchiveSelectedChapters(prev => ({ ...prev, [seriesId]: new Set() }));
                            });
                    } else if (type === 'delete') {
                        const delOpts = selectedChaptersArr ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chapters: selectedChaptersArr, action: 'delete' }) } : { method: 'DELETE' };
                        const delUrl = selectedChaptersArr ? `${API}/upscale/archive/partial/${seriesId}` : `${API}/upscale/archive/${seriesId}`;
                        fetch(delUrl, delOpts)
                            .then(() => {
                                fetch(`${API}/upscale/archive`).then(r => r.json()).then(setArchive);
                                setArchiveSelectedChapters(prev => ({ ...prev, [seriesId]: new Set() }));
                            });
                    }
                    setArchiveAction(null);
                }}
            />
            {
                previewJob && (
                    <UpscalePreviewModal
                        previewJob={previewJob}
                        onClose={() => setPreviewJob(null)}
                        onFinalize={finalizeJob}
                        onDiscard={discardJob}
                    />
                )
            }
        </div >
    );
};

// ── Shared atoms ─────────────────────────────────────────
const RadioDot = ({ active }) => (
    <div style={{
        width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s',
    }}>
        {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />}
    </div>
);

const StatusBadge = ({ status }) => {
    const map = {
        queued: { bg: 'rgba(161,161,170,0.12)', color: 'var(--muted)', label: 'Queued' },
        processing: { bg: 'rgba(99,102,241,0.12)', color: 'var(--accent)', label: '⟳ Processing' },
        review: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: 'Review' },
        done: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: '✓ Done' },
        cancelled: { bg: 'rgba(239,68,68,0.10)', color: '#ef4444', label: 'Cancelled' },
        error: { bg: 'rgba(239,68,68,0.10)', color: '#ef4444', label: 'Error' },
    };
    const s = map[status] || map.queued;
    return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: s.bg, color: s.color, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
            {s.label}
        </span>
    );
};

const selectStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: '28px'
};

const inputStyle = {
    padding: '8px 10px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
    outline: 'none', transition: 'border-color 0.15s', textAlign: 'center',
    fontWeight: 600,
    appearance: 'textfield',
};

const modelCardStyle = {
    padding: '14px 16px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
    display: 'flex', flexDirection: 'column', position: 'relative',
};


// ── Upscale Preview Modal ─────────────────────────────
const UpscalePreviewModal = ({ previewJob, onClose, onFinalize, onDiscard }) => {
    const [page, setPage] = useState(0);
    const { job, images } = previewJob;
    const total = images.length;
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9950,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, opacity: 0.7 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
                    Back
                </button>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'center' }}>
                    Preview: {previewJob.chapter} ({job.model})
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{page + 1} / {total || '?'}</span>
            </div>

            {/* Image viewer */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px 40px' }}>
                {total === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: 80, fontSize: 14 }}>No preview images available yet.</div>
                ) : (
                    <img
                        src={`${images[page]}`}
                        alt={`Page ${page + 1}`}
                        style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', objectFit: 'contain', borderRadius: 4 }}
                        onError={e => { e.target.style.opacity = 0.3; }}
                    />
                )}
            </div>

            {/* Navigation */}
            {total > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, opacity: page === 0 ? 0.3 : 1 }}>◀ Prev</button>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, minWidth: 70, textAlign: 'center' }}>{page + 1} / {total}</span>
                    <button onClick={() => setPage(p => Math.min(total - 1, p + 1))} disabled={page >= total - 1} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13, opacity: page >= total - 1 ? 0.3 : 1 }}>Next ▶</button>
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => { onFinalize(job.id, 'keep'); onClose(); }} style={{ flex: 1, padding: '11px 0', borderRadius: 8, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ Replace &amp; Keep Original
                </button>
                <button onClick={() => { onFinalize(job.id, 'delete'); onClose(); }} style={{ flex: 1, padding: '11px 0', borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Replace &amp; Delete Original
                </button>
                <button onClick={() => { onDiscard(job.id); onClose(); }} style={{ padding: '11px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    Discard
                </button>
            </div>
        </div>
    );
};

export default Upscaler;
