import React, { useState, useEffect, useRef } from 'react';
import { apiUrl } from '../runtime';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const ModelSetupScreen = ({ onReady }) => {
    const [pkgState, setPkgState] = useState(null);
    const [triggered, setTriggered] = useState(false);
    const hasAutoTriggered = useRef(false);
    const [canDismiss, setCanDismiss] = useState(false);

    // Poll package state
    useEffect(() => {
        const fetchState = () =>
            fetch(apiUrl('/api/upscale/package-state'))
                .then(r => r.json())
                .then(setPkgState)
                .catch(() => { });
        fetchState();
        const intv = setInterval(fetchState, 800);
        return () => clearInterval(intv);
    }, []);

    // Auto-trigger download on mount (once)
    useEffect(() => {
        if (hasAutoTriggered.current) return;
        if (!pkgState) return;

        // If already done or already downloading, don't re-trigger
        if (pkgState.status === 'done') {
            onReady();
            return;
        }
        if (['downloading', 'extracting'].includes(pkgState.status)) {
            setTriggered(true);
            return;
        }

        // Auto-trigger download
        hasAutoTriggered.current = true;
        setTriggered(true);
        fetch(apiUrl('/api/upscale/install-package'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reinstall: false })
        }).catch(() => { });
    }, [pkgState]);

    // When package becomes 'done', call onReady after brief delay
    useEffect(() => {
        if (pkgState?.status === 'done') {
            const t = setTimeout(() => onReady(), 600);
            return () => clearTimeout(t);
        }
    }, [pkgState?.status]);

    // Allow dismissal after error or after 3 seconds (for impatient users)
    useEffect(() => {
        const t = setTimeout(() => setCanDismiss(true), 3000);
        return () => clearTimeout(t);
    }, []);

    const status = pkgState?.status || 'idle';
    const progress = pkgState?.progress || 0;
    const isError = status === 'error';
    const isDownloading = status === 'downloading';
    const isExtracting = status === 'extracting';
    const isDone = status === 'done';

    const handleRetry = (e) => {
        e.stopPropagation(); // Prevent dismiss
        setTriggered(true);
        fetch(apiUrl('/api/upscale/install-package'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reinstall: false })
        }).catch(() => { });
    };

    const handleDismiss = () => {
        if (canDismiss) onReady();
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'var(--bg, #0a0a0f)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                color: 'var(--text, #e4e4e7)',
                overflow: 'hidden',
                cursor: canDismiss ? 'pointer' : 'default',
            }}
            onClick={handleDismiss}
        >
            {/* Subtle animated background gradient */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(139,92,246,0.06) 0%, transparent 50%)',
                animation: 'setupBgPulse 6s ease-in-out infinite alternate',
            }} />

            {/* Content */}
            <div
                style={{
                    position: 'relative', zIndex: 1,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 32,
                    maxWidth: 420, width: '90%',
                    textAlign: 'center',
                    cursor: 'default',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Logo / Icon */}
                <div style={{
                    width: 72, height: 72, borderRadius: 20,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                    border: '1px solid rgba(99,102,241,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 40px rgba(99,102,241,0.15)',
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="rgba(99,102,241,0.9)" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                </div>

                {/* Title */}
                <div>
                    <div style={{
                        fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em',
                        marginBottom: 8,
                        background: 'linear-gradient(135deg, #e4e4e7, #a1a1aa)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                        Setting up AI Models
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted, #71717a)', lineHeight: 1.5 }}>
                        {isError
                            ? 'Download failed. Please check your internet connection.'
                            : isExtracting
                                ? 'Extracting model files...'
                                : isDone
                                    ? 'Models installed successfully!'
                                    : isDownloading
                                        ? 'Downloading Waifu2x & Real-ESRGAN models...'
                                        : 'Preparing to download AI upscaling models...'}
                    </div>
                </div>

                {/* Progress section */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Progress bar */}
                    <div style={{
                        width: '100%', height: 6, borderRadius: 3,
                        background: 'rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                        position: 'relative',
                    }}>
                        {(isDownloading || isExtracting) && progress === 0 ? (
                            <div style={{
                                position: 'absolute', top: 0, height: '100%', width: '30%', borderRadius: 3,
                                background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7), transparent)',
                                animation: 'scanSlide 1.4s ease-in-out infinite',
                            }} />
                        ) : (
                            <div style={{
                                height: '100%', borderRadius: 3,
                                width: `${isError ? 100 : isDone ? 100 : progress}%`,
                                background: isError
                                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                                    : isDone
                                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                        : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                transition: 'width 0.4s ease',
                                boxShadow: isError ? '0 0 12px rgba(239,68,68,0.3)' : isDone ? '0 0 12px rgba(34,197,94,0.3)' : '0 0 12px rgba(99,102,241,0.3)',
                            }} />
                        )}
                    </div>

                    {/* Stats */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 11, color: 'var(--muted, #71717a)', fontWeight: 500,
                    }}>
                        {isError ? (
                            <span style={{ color: '#ef4444', fontSize: 12, flex: 1, textAlign: 'center' }}>
                                {pkgState?.error || 'Download failed'}
                            </span>
                        ) : isExtracting ? (
                            <>
                                <span>Extracting...</span>
                                <span style={{ color: 'var(--accent, #6366f1)', fontWeight: 700 }}>97%</span>
                            </>
                        ) : isDone ? (
                            <span style={{ color: '#22c55e', fontWeight: 700, flex: 1, textAlign: 'center' }}>
                                ✓ Ready
                            </span>
                        ) : isDownloading ? (
                            <>
                                <span>
                                    {formatBytes(pkgState?.downloadedBytes || 0)} / {formatBytes(pkgState?.totalBytes || 0)}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {pkgState?.speedBytesPerSec > 0 && (
                                        <span>{formatBytes(pkgState.speedBytesPerSec)}/s</span>
                                    )}
                                    <span style={{ color: 'var(--accent, #6366f1)', fontWeight: 700 }}>{progress}%</span>
                                </span>
                            </>
                        ) : (
                            <span style={{ flex: 1, textAlign: 'center' }}>Connecting...</span>
                        )}
                    </div>
                </div>

                {/* Error retry button */}
                {isError && (
                    <button
                        onClick={handleRetry}
                        style={{
                            padding: '10px 32px', fontSize: 13, fontWeight: 700,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            border: 'none', borderRadius: 10, color: '#fff',
                            cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.4)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)'; }}
                    >
                        Retry Download
                    </button>
                )}
            </div>

            {/* Tap to dismiss hint */}
            {canDismiss && (
                <div style={{
                    position: 'absolute', bottom: 32,
                    fontSize: 12, color: 'rgba(161,161,170,0.5)',
                    animation: 'fadeIn 0.5s ease',
                    pointerEvents: 'none',
                }}>
                    Tap anywhere to dismiss
                </div>
            )}

            {/* CSS animations */}
            <style>{`
                @keyframes setupBgPulse {
                    0% { opacity: 0.6; }
                    100% { opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default ModelSetupScreen;
