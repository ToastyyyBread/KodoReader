import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { apiUrl, isTauriRuntime } from '../runtime';

const normalizeVersion = (value) => String(value || '').trim().replace(/^v/i, '');
const parseVersion = (value) => normalizeVersion(value)
    .split('.')
    .map((part) => {
        const parsed = Number.parseInt(String(part).replace(/[^\d].*$/, ''), 10);
        return Number.isFinite(parsed) ? parsed : 0;
    });

const compareVersions = (a, b) => {
    const av = parseVersion(a);
    const bv = parseVersion(b);
    const len = Math.max(av.length, bv.length);
    for (let i = 0; i < len; i += 1) {
        const ai = av[i] || 0;
        const bi = bv[i] || 0;
        if (ai > bi) return 1;
        if (ai < bi) return -1;
    }
    return 0;
};

const getRuntimeVersion = async () => {
    if (!isTauriRuntime()) return '';
    try {
        const { getVersion } = await import('@tauri-apps/api/app');
        return normalizeVersion(await getVersion());
    } catch {
        return '';
    }
};

const formatReleaseDate = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    try {
        return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
};

const TitleBar = () => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isUpdateOpen, setIsUpdateOpen] = useState(false);
    const [updateState, setUpdateState] = useState({
        checking: false,
        configured: true,
        hasUpdate: false,
        currentVersion: '',
        latestVersion: '',
        releaseName: '',
        releaseUrl: '',
        publishedAt: '',
        error: '',
    });
    const appWindow = isTauriRuntime() ? getCurrentWindow() : null;
    const maximizeBtnRef = useRef(null);
    const updateWrapRef = useRef(null);
    const didInitialUpdateCheckRef = useRef(false);

    const checkForUpdates = useCallback(async () => {
        setUpdateState((prev) => ({ ...prev, checking: true, error: '' }));
        try {
            const response = await fetch(apiUrl('/api/app/update/check'), { cache: 'no-store' });
            let payload = {};
            try {
                payload = await response.json();
            } catch {
                payload = {};
            }

            const currentVersion = normalizeVersion((await getRuntimeVersion()) || payload.currentVersion);
            if (!payload.configured) {
                setUpdateState({
                    checking: false,
                    configured: false,
                    hasUpdate: false,
                    currentVersion,
                    latestVersion: '',
                    releaseName: '',
                    releaseUrl: '',
                    publishedAt: '',
                    error: payload.error || '',
                });
                return;
            }

            const latestVersionRaw = String(payload.latestVersion || '').trim();
            const latestVersion = normalizeVersion(latestVersionRaw);
            const hasUpdate = Boolean(latestVersion && currentVersion && compareVersions(latestVersion, currentVersion) > 0);
            setUpdateState({
                checking: false,
                configured: true,
                hasUpdate,
                currentVersion,
                latestVersion: latestVersionRaw,
                releaseName: String(payload.releaseName || ''),
                releaseUrl: String(payload.releaseUrl || ''),
                publishedAt: String(payload.publishedAt || ''),
                error: response.ok ? '' : (payload.error || `Update check failed (HTTP ${response.status}).`),
            });
        } catch (err) {
            setUpdateState((prev) => ({
                ...prev,
                checking: false,
                error: `Failed to check update: ${err?.message || 'unknown error'}`,
            }));
        }
    }, []);

    useEffect(() => {
        if (!appWindow) return;
        let disposed = false;

        const syncMaxState = () => {
            appWindow.isMaximized().then(v => { if (!disposed) setIsMaximized(v); }).catch(() => { });
        };
        syncMaxState();

        // Listen to resize events for instant state sync (catches snap layouts, Win+Arrow, etc.)
        let unlisten;
        appWindow.onResized(() => {
            if (!disposed) syncMaxState();
        }).then(fn => { unlisten = fn; });

        return () => {
            disposed = true;
            if (unlisten) unlisten();
        };
    }, [appWindow]);

    useEffect(() => {
        if (didInitialUpdateCheckRef.current) return;
        didInitialUpdateCheckRef.current = true;
        checkForUpdates();
    }, [checkForUpdates]);

    useEffect(() => {
        if (!isUpdateOpen) return undefined;
        const onPointerDown = (event) => {
            if (!updateWrapRef.current || updateWrapRef.current.contains(event.target)) return;
            setIsUpdateOpen(false);
        };
        window.addEventListener('mousedown', onPointerDown);
        return () => window.removeEventListener('mousedown', onPointerDown);
    }, [isUpdateOpen]);

    const sendAction = async (action) => {
        if (!appWindow) return;
        try {
            if (action === 'minimize') await appWindow.minimize();
            if (action === 'maximize') await appWindow.toggleMaximize();
            if (action === 'close') await appWindow.close();
        } catch { }
    };

    const handleMinimize = () => sendAction('minimize');
    const handleMaximize = () => {
        sendAction('maximize');
        setIsMaximized(m => !m);
    };
    const handleClose = () => sendAction('close');

    return (
        <div className="custom-titlebar" data-tauri-drag-region>
            <div className="titlebar-title" data-tauri-drag-region>
                <svg data-tauri-drag-region width="16" height="16" viewBox="0 0 32 32" style={{ marginRight: '6px' }}>
                    <path fill="#b6adf5" d="M2.6,20v-8.3h2.3v4.2s0,1.1,0,1.1v3h-2.3ZM4.3,18.6v-2.1c.2-.3.3-.6.5-.9.2-.3.3-.5.5-.8s.4-.6.7-.9l1.6-2.1h2.7l-3.5,4.3h-.2c0,0-2.3,2.6-2.3,2.6h0ZM7.8,20l-2-3.3,1.4-1.7,3.2,5h-2.7,0Z" />
                    <path fill="#b6adf5" d="M12.9,20.3c-.7,0-1.2-.1-1.7-.4-.5-.3-.9-.6-1.1-1.1-.3-.5-.4-1-.4-1.7s.1-1.2.4-1.7c.3-.5.6-.8,1.1-1.1.5-.3,1.1-.4,1.7-.4s1.2.1,1.7.4c.5.3.9.6,1.1,1.1s.4,1,.4,1.7-.1,1.2-.4,1.7-.6.8-1.1,1.1c-.5.3-1.1.4-1.7.4ZM12.9,18.6c.2,0,.4,0,.5-.2.1-.1.2-.3.3-.5s.1-.5.1-.8,0-.6-.1-.8c0-.2-.2-.4-.3-.5-.1-.1-.3-.2-.5-.2s-.4,0-.5.2-.2.3-.3.5-.1.5-.1.8,0,.6.1.8c0,.2.2.4.3.5s.3.2.5.2Z" />
                    <path fill="#fff" d="M18.8,20.2c-.5,0-.9-.1-1.2-.4-.4-.2-.7-.6-.9-1.1s-.3-1-.3-1.8.1-1.3.3-1.8.5-.8.9-1c.4-.2.8-.3,1.2-.3s.6,0,.8.1c.2.1.4.2.6.4.2.2.3.4.4.6h0v-3.2h2.2v8.3h-2.2v-1h0c0,.2-.2.4-.4.6-.2.2-.4.3-.6.4s-.5.1-.8.1h0ZM19.6,18.5c.2,0,.4,0,.5-.2.1-.1.3-.3.4-.5,0-.2.1-.5.1-.8s0-.6-.1-.8c0-.2-.2-.4-.4-.5s-.3-.2-.5-.2-.4,0-.5.2-.2.3-.3.5c0,.2-.1.5-.1.8s0,.5.1.8c0,.2.2.4.3.5s.3.2.5.2Z" />
                    <path fill="#fff" d="M26.2,20.3c-.7,0-1.2-.1-1.7-.4-.5-.3-.9-.6-1.1-1.1s-.4-1-.4-1.7.1-1.2.4-1.7.6-.8,1.1-1.1c.5-.3,1.1-.4,1.7-.4s1.2.1,1.7.4c.5.3.9.6,1.1,1.1s.4,1,.4,1.7-.1,1.2-.4,1.7-.6.8-1.1,1.1-1,.4-1.7.4ZM26.2,18.6c.2,0,.4,0,.5-.2.1-.1.2-.3.3-.5s.1-.5.1-.8,0-.6-.1-.8-.2-.4-.3-.5-.3-.2-.5-.2-.4,0-.5.2-.2.3-.3.5-.1.5-.1.8,0,.6.1.8c0,.2.2.4.3.5s.3.2.5.2Z" />
                    <rect fill="#b6adf5" x="11.2" y="12.2" width="3.3" height="1.3" />
                </svg>
                <span data-tauri-drag-region>Kōdo</span>
            </div>
            <div className="titlebar-controls">
                <div className="titlebar-update-wrap" ref={updateWrapRef}>
                    <button
                        className={`titlebar-btn titlebar-update${updateState.hasUpdate ? ' has-update' : ''}`}
                        onClick={() => setIsUpdateOpen((prev) => !prev)}
                        aria-label="Open update inbox"
                        title={updateState.hasUpdate ? 'Update available' : 'Check updates'}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 5.5H20C20.5523 5.5 21 5.94772 21 6.5V17.5C21 18.0523 20.5523 18.5 20 18.5H4C3.44772 18.5 3 18.0523 3 17.5V6.5C3 5.94772 3.44772 5.5 4 5.5Z" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M3 7L11.2191 12.3713C11.6973 12.6837 12.3027 12.6837 12.7809 12.3713L21 7" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                        {updateState.hasUpdate && <span className="titlebar-update-dot" />}
                    </button>
                    {isUpdateOpen && (
                        <div className="titlebar-update-popover">
                            <div className="titlebar-update-head">
                                <span className="titlebar-update-title">App Updates</span>
                                <button
                                    className="titlebar-update-check-btn"
                                    onClick={checkForUpdates}
                                    disabled={updateState.checking}
                                >
                                    {updateState.checking ? 'Checking...' : 'Check'}
                                </button>
                            </div>

                            {updateState.checking && (
                                <div className="titlebar-update-text">Checking latest release...</div>
                            )}

                            {!updateState.checking && !updateState.configured && (
                                <div className="titlebar-update-text">
                                    Update checker belum aktif. Set <code>appUpdateRepo</code> atau <code>appUpdateApiUrl</code> di <code>config.json</code>.
                                </div>
                            )}

                            {!updateState.checking && updateState.configured && updateState.error && (
                                <div className="titlebar-update-text titlebar-update-error">{updateState.error}</div>
                            )}

                            {!updateState.checking && updateState.configured && !updateState.error && updateState.hasUpdate && (
                                <div className="titlebar-update-info">
                                    <div className="titlebar-update-badge">Update available</div>
                                    <div className="titlebar-update-meta">Current: {updateState.currentVersion || '-'}</div>
                                    <div className="titlebar-update-meta">Latest: {updateState.latestVersion || '-'}</div>
                                    {updateState.releaseName ? (
                                        <div className="titlebar-update-meta">Release: {updateState.releaseName}</div>
                                    ) : null}
                                    {formatReleaseDate(updateState.publishedAt) ? (
                                        <div className="titlebar-update-meta">Published: {formatReleaseDate(updateState.publishedAt)}</div>
                                    ) : null}
                                    {updateState.releaseUrl ? (
                                        <a className="titlebar-update-link" href={updateState.releaseUrl} target="_blank" rel="noreferrer">
                                            Open Release
                                        </a>
                                    ) : null}
                                </div>
                            )}

                            {!updateState.checking && updateState.configured && !updateState.error && !updateState.hasUpdate && (
                                <div className="titlebar-update-info">
                                    <div className="titlebar-update-badge ok">Up to date</div>
                                    <div className="titlebar-update-meta">Version: {updateState.currentVersion || '-'}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <button
                    className="titlebar-btn titlebar-minimize"
                    onClick={handleMinimize}
                >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 5.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <button
                    ref={maximizeBtnRef}
                    className="titlebar-btn titlebar-maximize"
                    onClick={handleMaximize}
                >
                    {isMaximized ? (
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 3H9V9H3V3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                            <path d="M3 3L3 2C3 1.44772 3.44772 1 4 1L10 1C10.5523 1 11 1.44772 11 2L11 8C11 8.55228 10.5523 9 10 9L9 9" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                    ) : (
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1.5 1.5H9.5V9.5H1.5V1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                    )}
                </button>
                <button
                    className="titlebar-btn titlebar-close"
                    onClick={handleClose}
                >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
