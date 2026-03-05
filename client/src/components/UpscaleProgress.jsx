import React, { useState, useEffect } from 'react';

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const UpscaleProgress = ({ onNavigate, currentView }) => {
    const [queue, setQueue] = useState([]);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const fetchQueue = () => {
            fetch('/api/upscale/queue')
                .then(r => r.json())
                .then(data => setQueue(data))
                .catch(() => { });
        };

        fetchQueue();
        const intv = setInterval(fetchQueue, 1500);

        return () => clearInterval(intv);
    }, []);

    // Re-expand whenever a new active job starts
    useEffect(() => {
        const activeJob = queue.find(j => j.status === 'processing');
        if (activeJob) setCollapsed(false);
    }, [queue.find(j => j.status === 'processing')?.id]);

    const [pkgState, setPkgState] = useState(null);
    useEffect(() => {
        const fetchPkg = () => fetch('/api/upscale/package-state').then(r => r.json()).then(setPkgState).catch(() => { });
        fetchPkg();
        const intv = setInterval(fetchPkg, 1500);
        return () => clearInterval(intv);
    }, []);

    const activeJob = queue.find(j => j.status === 'processing');
    const waitingJobs = queue.filter(j => j.status === 'queued');
    const isPkgDownloading = pkgState && ['downloading', 'extracting'].includes(pkgState.status);

    // Hide if nothing is going on, or user is already on the Upscaler page
    if ((!activeJob && waitingJobs.length === 0 && !isPkgDownloading) || currentView === 'upscaler') return null;

    const isWaiting = activeJob && activeJob.progress.pagesCurrent === 0 && activeJob.progress.pagesTotal === 0;
    const pgPct = activeJob && activeJob.progress.pagesTotal > 0
        ? Math.round((activeJob.progress.pagesCurrent / activeJob.progress.pagesTotal) * 100)
        : 0;
    const chPct = activeJob
        ? Math.max(2, Math.round(((activeJob.progress.current + 1) / activeJob.progress.total) * 100))
        : 0;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 8999,
                width: 300,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                overflow: 'hidden',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: activeJob ? 'rgba(99,102,241,0.06)' : 'var(--surface2)',
                    borderBottom: collapsed ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                }}
                onClick={() => setCollapsed(c => !c)}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Animated lightning icon */}
                    <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: activeJob ? 'rgba(99,102,241,0.15)' : 'var(--surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill={activeJob ? 'var(--accent)' : 'var(--muted)'} viewBox="0 0 16 16">
                            <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641z" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                            {isPkgDownloading ? 'AI Models setup…' : activeJob ? 'Upscaling…' : 'Queue Ready'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                            {isPkgDownloading
                                ? (pkgState.status === 'extracting' ? 'Extracting package...' : `${pkgState.progress}% Downloaded`)
                                : activeJob
                                    ? (isWaiting ? 'Loading model…' : `${pgPct}% · Ch ${activeJob.progress.current + 1}/${activeJob.progress.total}`)
                                    : `${waitingJobs.length} job${waitingJobs.length !== 1 ? 's' : ''} queued`
                            }
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {waitingJobs.length > 0 && (
                        <span style={{
                            fontSize: 9.5, fontWeight: 700,
                            background: 'rgba(99,102,241,0.15)', color: 'var(--accent)',
                            padding: '2px 7px', borderRadius: 99,
                        }}>
                            +{waitingJobs.length}
                        </span>
                    )}
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                        style={{ color: 'var(--muted)', transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {/* Body — collapsible */}
            {!collapsed && (
                <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {activeJob && (
                        <>
                            {/* Chapter progress bar */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {activeJob.progress.currentChapter || 'Starting…'}
                                    </span>
                                    <span>Ch {activeJob.progress.current + 1} / {activeJob.progress.total}</span>
                                </div>
                                <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 2, background: 'var(--accent)',
                                        width: `${chPct}%`, transition: 'width 0.6s ease',
                                    }} />
                                </div>
                            </div>

                            {/* Page progress bar */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                                    <span>{isWaiting ? 'Loading model…' : `Images (${pgPct}%)`}</span>
                                    {!isWaiting && (
                                        <span>{activeJob.progress.pagesCurrent} / {activeJob.progress.pagesTotal}</span>
                                    )}
                                </div>
                                <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', position: 'relative' }}>
                                    {isWaiting ? (
                                        <div style={{
                                            position: 'absolute', top: 0, height: '100%', width: '35%', borderRadius: 2,
                                            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8), transparent)',
                                            animation: 'scanSlide 1.4s ease-in-out infinite',
                                        }} />
                                    ) : (
                                        <div style={{
                                            height: '100%', borderRadius: 2, background: '#22c55e',
                                            width: `${pgPct}%`, transition: 'width 0.5s ease',
                                        }} />
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {isPkgDownloading && !activeJob && (
                        <div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text)' }}>
                                    <span>{pkgState.status === 'extracting' ? 'Extracting upscaler-models.zip…' : 'upscaler-models.zip'}</span>
                                    <span style={{ color: 'var(--accent)' }}>{pkgState.progress}%</span>
                                </div>
                                {pkgState.status === 'downloading' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5 }}>
                                        <span>{formatBytes(pkgState.downloadedBytes)} / {formatBytes(pkgState.totalBytes)}</span>
                                        <span>{pkgState.speedBytesPerSec > 0 ? `${formatBytes(pkgState.speedBytesPerSec)}/s` : ''}</span>
                                    </div>
                                )}
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', borderRadius: 2, background: 'var(--accent)',
                                    width: `${pkgState.progress}%`, transition: 'width 0.3s ease',
                                }} />
                            </div>
                        </div>
                    )}

                    {!activeJob && waitingJobs.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {waitingJobs[0].mangaTitle} — {waitingJobs[0].chapters.length} chapter{waitingJobs[0].chapters.length !== 1 ? 's' : ''}
                        </div>
                    )}

                    {/* Go to Upscaler button */}
                    <button
                        onClick={() => onNavigate('upscaler')}
                        style={{
                            marginTop: 2, padding: '7px 0',
                            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                            borderRadius: 8, color: 'var(--accent)', fontSize: 11.5, fontWeight: 600,
                            cursor: 'pointer', width: '100%', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.18)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                    >
                        Open Upscaler →
                    </button>
                </div>
            )}
        </div>
    );
};

export default UpscaleProgress;

