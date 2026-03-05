import React, { useState, useEffect, useRef } from 'react';
import CustomDropdown from './CustomDropdown';
import BackupPasswordModal from './BackupPasswordModal';
import GDriveRestoreModal from './GDriveRestoreModal';
import paypalLogo from '../assets/PayPal.svg';
import kofiLogo from '../assets/ko-fi-logo.svg';
import kodo500Logo from '../assets/kodo_500.svg';
import { apiUrl } from '../runtime';

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Icons = {
    General: () => (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
    ),
    Library: () => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M8.67239 7.54199H15.3276C18.7024 7.54199 20.3898 7.54199 21.3377 8.52882C22.2855 9.51565 22.0625 11.0403 21.6165 14.0895L21.1935 16.9811C20.8437 19.3723 20.6689 20.5679 19.7717 21.2839C18.8745 21.9999 17.5512 21.9999 14.9046 21.9999H9.09536C6.44881 21.9999 5.12553 21.9999 4.22834 21.2839C3.33115 20.5679 3.15626 19.3723 2.80648 16.9811L2.38351 14.0895C1.93748 11.0403 1.71447 9.51565 2.66232 8.52882C3.61017 7.54199 5.29758 7.54199 8.67239 7.54199ZM8 18.0001C8 17.5859 8.3731 17.2501 8.83333 17.2501H15.1667C15.6269 17.2501 16 17.5859 16 18.0001C16 18.4143 15.6269 18.7501 15.1667 18.7501H8.83333C8.3731 18.7501 8 18.4143 8 18.0001Z" fill="currentColor"></path> <g opacity="0.4"> <path d="M8.51005 2.00001H15.4901C15.7226 1.99995 15.9009 1.99991 16.0567 2.01515C17.1645 2.12352 18.0712 2.78958 18.4558 3.68678H5.54443C5.92895 2.78958 6.8357 2.12352 7.94352 2.01515C8.09933 1.99991 8.27757 1.99995 8.51005 2.00001Z" fill="currentColor"></path> </g> <g opacity="0.7"> <path d="M6.31069 4.72266C4.92007 4.72266 3.7798 5.56241 3.39927 6.67645C3.39134 6.69967 3.38374 6.72302 3.37646 6.74647C3.77461 6.6259 4.18898 6.54713 4.60845 6.49336C5.68882 6.35485 7.05416 6.35492 8.64019 6.35501L8.75863 6.35501L15.5323 6.35501C17.1183 6.35492 18.4837 6.35485 19.564 6.49336C19.9835 6.54713 20.3979 6.6259 20.796 6.74647C20.7887 6.72302 20.7811 6.69967 20.7732 6.67645C20.3927 5.56241 19.2524 4.72266 17.8618 4.72266H6.31069Z" fill="currentColor"></path> </g> </g></svg>
    ),
    Reading: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" class="bi bi-book-half" viewBox="0 0 16 16">
            <path d="M8.5 2.687c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783" />
        </svg>
    ),
    Support: () => (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
    ),
    About: () => (
        <svg width="14" height="14" viewBox="0 0 122.88 122.88" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M61.44,0c33.926,0,61.44,27.514,61.44,61.44c0,33.926-27.514,61.439-61.44,61.439 C27.513,122.88,0,95.366,0,61.44C0,27.514,27.513,0,61.44,0L61.44,0z M79.42,98.215H43.46v-6.053h6.757v-36.96H43.46v-4.816h16.808 c4.245,0,8.422-0.51,12.549-1.551v43.328h6.604V98.215L79.42,98.215z M63.859,21.078c2.785,0,4.975,0.805,6.571,2.396 c1.579,1.59,2.377,3.771,2.377,6.581c0,2.848-1.358,5.381-4.093,7.601c-2.751,2.22-5.941,3.338-9.577,3.338 c-2.733,0-4.905-0.765-6.569-2.297c-1.665-1.551-2.497-3.556-2.497-6.05c0-3.143,1.358-5.853,4.059-8.152 C56.83,22.219,60.072,21.078,63.859,21.078L63.859,21.078z" /></svg>
    ),
    Upscale: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="currentColor" className="bi bi-lightning-fill" viewBox="0 0 16 16">
            <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641z" />
        </svg>
    ),
    Backup: () => (
        <svg viewBox="0 0 20 20" width="18" height="18" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="none" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"><g id="SVGRepo_bgCarrier"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <rect x="0" fill="none" width="20" height="20"></rect> <g> <path d="M13.65 2.88c3.93 2.01 5.48 6.84 3.47 10.77s-6.83 5.48-10.77 3.47c-1.87-.96-3.2-2.56-3.86-4.4l1.64-1.03c.45 1.57 1.52 2.95 3.08 3.76 3.01 1.54 6.69.35 8.23-2.66 1.55-3.01.36-6.69-2.65-8.24C9.78 3.01 6.1 4.2 4.56 7.21l1.88.97-4.95 3.08-.39-5.82 1.78.91C4.9 2.4 9.75.89 13.65 2.88zm-4.36 7.83C9.11 10.53 9 10.28 9 10c0-.07.03-.12.04-.19h-.01L10 5l.97 4.81L14 13l-4.5-2.12.02-.02c-.08-.04-.16-.09-.23-.15z"></path> </g> </g></svg>
    ),
    Compressor: () => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M9 4V9H4M15 4V9H20M4 15H9V20M15 20V15H20" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
    ),
    Bookmarks: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-bookmark" viewBox="0 0 16 16">
            <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.101l-5.223 2.815A.5.5 0 0 1 2 15.5zm2-1a1 1 0 0 0-1 1v12.566l4.723-2.482a.5.5 0 0 1 .554 0L13 14.566V2a1 1 0 0 0-1-1z" />
        </svg>
    ),
    Changelog: () => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
    )
};

const SECTIONS = [
    { id: 'general', label: 'General', Icon: Icons.General },
    { id: 'library', label: 'Library', Icon: Icons.Library },
    { id: 'readmode', label: 'Reading', Icon: Icons.Reading },
    { id: 'bookmarks', label: 'Bookmarks', Icon: Icons.Bookmarks },
    { id: 'compressor', label: 'Compressor', Icon: Icons.Compressor },
    { id: 'upscale', label: 'AI Upscaling', Icon: Icons.Upscale },
    { id: 'backup', label: 'Smart Backup', Icon: Icons.Backup },
    { id: 'changelog', label: 'Changelog', Icon: Icons.Changelog },
    { id: 'support', label: 'Support', Icon: Icons.Support },
    { id: 'about', label: 'About', Icon: Icons.About },
];

const SettingsPage = ({ theme, onToggleTheme, activeSectionProp, modal }) => {
    const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem('kodo-auto-refresh') !== 'false');
    const [gridSize, setGridSize] = useState(() => parseInt(localStorage.getItem('kodo-grid-size')) || 220);
    const [defaultReadMode, setDefaultReadMode] = useState(() => localStorage.getItem('kodo-default-readmode') || 'Vertical');
    const [defaultFitMode, setDefaultFitMode] = useState(() => localStorage.getItem('kodo-default-fitmode') || 'Original');
    const [optimizeImages, setOptimizeImages] = useState(() => localStorage.getItem('kodo-optimize-images') !== 'false');
    const [fixJaggedCovers, setFixJaggedCovers] = useState(() => localStorage.getItem('kodo-jagged-covers') !== 'false');
    const [rotatingCovers, setRotatingCovers] = useState(() => localStorage.getItem('kodo-rotating-covers') !== 'false');
    const [rotatingCoversInterval, setRotatingCoversInterval] = useState(() => parseInt(localStorage.getItem('kodo-rotating-covers-interval')) || 3500);
    const [bookmarkQuality, setBookmarkQuality] = useState(() => {
        const val = localStorage.getItem('kodo-bookmark-quality');
        return val !== null ? parseInt(val) : 45;
    });
    const [nsfwDisplay, setNsfwDisplay] = useState(() => localStorage.getItem('kodo-nsfw-display') || 'blur');
    const [showProgressBar, setShowProgressBar] = useState(() => localStorage.getItem('kodo-show-progressbar') !== 'false');
    const [barTimeout, setBarTimeout] = useState(() => parseInt(localStorage.getItem('kodo-bar-timeout')) || 3000);
    const [barMinOpacity, setBarMinOpacity] = useState(() => parseFloat(localStorage.getItem('kodo-bar-opacity')) || 0);

    const [bmCropW, setBmCropW] = useState(() => parseInt(localStorage.getItem('kodo-bm-crop-w')) || 100);
    const [bmCropH, setBmCropH] = useState(() => parseInt(localStorage.getItem('kodo-bm-crop-h')) || 110);
    const [bmCropX, setBmCropX] = useState(() => parseInt(localStorage.getItem('kodo-bm-crop-x')) || 0);
    const [bmCropY, setBmCropY] = useState(() => parseInt(localStorage.getItem('kodo-bm-crop-y')) || 0);

    const [activeSection, setActiveSection] = useState(activeSectionProp || 'general');

    useEffect(() => {
        if (activeSectionProp) {
            setActiveSection(activeSectionProp);
            setTimeout(() => {
                const btn = tabBtnRefs.current[activeSectionProp];
                if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }, 100);
        }
    }, [activeSectionProp]);

    // Upscale settings (fetched from backend)
    const [upscaleSettings, setUpscaleSettings] = useState({ waifu2xPath: '', realesrganPath: '', afterUpscale: 'keep' });
    const [packageState, setPackageState] = useState(null);

    // Compressor settings
    const [compressorSettings, setCompressorSettings] = useState({ quality: 82, preset: 'manhwa', sharpen: true, grayscale: false, afterCompress: 'review' });

    // Backup state
    const [backupModalOpen, setBackupModalOpen] = useState(false);
    const [backupIsRestore, setBackupIsRestore] = useState(false);
    const [backupExportMode, setBackupExportMode] = useState('local'); // 'local' or 'gdrive'
    const [backupStateMsg, setBackupStateMsg] = useState('');
    const [backupFile, setBackupFile] = useState(null);
    const [includeFiles, setIncludeFiles] = useState(false);
    const [mangaSize, setMangaSize] = useState(null);
    const [backupJobId, setBackupJobId] = useState(null);
    const [backupProgress, setBackupProgress] = useState(0);
    const [backupSpeed, setBackupSpeed] = useState(0);
    const [backupRunning, setBackupRunning] = useState(false);
    const backupIntervalRef = useRef(null);

    // GDrive state
    const [gdriveConnected, setGdriveConnected] = useState(false);
    const [gdriveClientId, setGdriveClientId] = useState('');
    const [gdriveRestoreModalOpen, setGdriveRestoreModalOpen] = useState(false);

    // AI Models Delete modal state
    const [showDeleteUpscalerModal, setShowDeleteUpscalerModal] = useState(false);

    // System Cache Clear modal states
    const [showDeleteTempModal, setShowDeleteTempModal] = useState(false);
    const [showDeleteKodoModal, setShowDeleteKodoModal] = useState(false);
    const [showDeleteMetadataModal, setShowDeleteMetadataModal] = useState(false);

    // Tab Bar state and logic
    const tabsRef = useRef(null);
    const tabBtnRefs = useRef({});
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const checkScroll = () => {
        const el = tabsRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 2);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
    };

    useEffect(() => {
        checkScroll();
        const el = tabsRef.current;
        if (el) el.addEventListener('scroll', checkScroll, { passive: true });
        window.addEventListener('resize', checkScroll);
        return () => { if (el) el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll); };
    }, []);

    useEffect(() => {
        const el = tabsRef.current;
        if (!el) return;
        const onWheel = (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const contentRef = useRef(null);
    const selectSection = (id) => {
        setActiveSection(id);
        const btn = tabBtnRefs.current[id];
        if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        if (contentRef.current) contentRef.current.scrollTop = 0;
    };

    const scrollTabArrows = (dir) => { tabsRef.current?.scrollBy({ left: dir * 120, behavior: 'smooth' }); };
    const tabArrowStyle = (visible) => ({
        background: 'none', border: 'none', color: 'var(--muted)',
        cursor: visible ? 'pointer' : 'default',
        padding: '0 6px', display: 'flex', alignItems: 'center', flexShrink: 0, zIndex: 2,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.15s',
    });

    useEffect(() => {
        const fetchUpscaleSettings = () => fetch('/api/upscale/settings').then(r => r.json()).then(setUpscaleSettings).catch(() => { });
        fetchUpscaleSettings();
        fetch('/api/compress/settings').then(r => r.json()).then(setCompressorSettings).catch(() => { });

        fetch('/api/gdrive/status')
            .then(r => r.json())
            .then(data => {
                setGdriveConnected(data.isConnected);
                if (data.clientId) setGdriveClientId(data.clientId);
            }).catch(() => { });

        const handleMsg = (e) => {
            if (e.data === 'kodo_gdrive_auth_success') setGdriveConnected(true);
        };
        window.addEventListener('message', handleMsg);

        const pollUpscale = () => {
            fetch('/api/upscale/package-state').then(r => r.json()).then(setPackageState).catch(() => { });
            fetchUpscaleSettings();
        };
        pollUpscale();
        const pkgIntv = setInterval(pollUpscale, 1500);

        return () => {
            window.removeEventListener('message', handleMsg);
            clearInterval(pkgIntv);
        };
    }, []);

    useEffect(() => {
        if (packageState?.status === 'done' || packageState?.status === 'idle') {
            fetch('/api/upscale/settings').then(r => r.json()).then(setUpscaleSettings).catch(() => { });
        }
    }, [packageState?.status]);

    useEffect(() => {
        fetch('/api/backup/size').then(r => r.json()).then(setMangaSize).catch(() => { });

        // Initialize active backup background state
        fetch('/api/backup/job/active')
            .then(r => r.json())
            .then(data => {
                if (data.jobId) {
                    setBackupJobId(data.jobId);
                    setBackupProgress(data.progress);
                    if (data.status === 'done' || data.status === 'downloaded') {
                        setBackupStateMsg('Backup is ready to be saved!');
                        setBackupRunning(false);
                        setBackupProgress(100);
                    } else {
                        setBackupStateMsg('Backup running in background...');
                        setBackupRunning(true);
                        pollBackupJob(data.jobId);
                    }
                }
            }).catch(() => { });
    }, []);

    const handleOpenBackup = (isRestore, mode = 'local') => {
        setBackupExportMode(mode);
        setBackupIsRestore(isRestore);
        setBackupModalOpen(true);
        setBackupStateMsg('');
    };

    const pollBackupJob = (jobId) => {
        if (backupIntervalRef.current) clearInterval(backupIntervalRef.current);
        backupIntervalRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/backup/job/progress/${jobId}`);
                const data = await res.json();
                setBackupProgress(data.progress || 0);
                setBackupSpeed(data.speed || 0);
                if (data.status === 'encrypting') setBackupStateMsg('Encrypting backup...');
                else if (data.status === 'zipping') {
                    const mb = (data.processedBytes / 1024 / 1024).toFixed(0);
                    const total = (data.totalBytes / 1024 / 1024).toFixed(0);
                    setBackupStateMsg(`Packing files... ${mb}/${total} MB`);
                }
                if (data.status === 'done') {
                    clearInterval(backupIntervalRef.current);
                    setBackupStateMsg('Backup is ready to be saved!');
                    setBackupRunning(false);
                    setBackupProgress(100); setBackupSpeed(0);
                } else if (data.status === 'error') {
                    clearInterval(backupIntervalRef.current);
                    setBackupStateMsg('Backup failed: ' + (data.error || 'Unknown error'));
                    setBackupRunning(false); setBackupJobId(null);
                    setTimeout(() => setBackupStateMsg(''), 5000);
                } else if (data.status === 'cancelled') {
                    clearInterval(backupIntervalRef.current);
                    setBackupStateMsg('Backup cancelled.');
                    setBackupRunning(false); setBackupJobId(null); setBackupProgress(0); setBackupSpeed(0);
                    setTimeout(() => setBackupStateMsg(''), 3000);
                }
            } catch { clearInterval(backupIntervalRef.current); setBackupRunning(false); }
        }, 400);
    };

    const handleCancelBackup = async () => {
        if (backupJobId) await fetch(`/api/backup/job/cancel/${backupJobId}`, { method: 'POST' });
    };

    const handleBackupSubmit = async (password) => {
        setBackupModalOpen(false);
        setBackupStateMsg(backupIsRestore ? 'Restoring...' : 'Creating backup...');

        if (!backupIsRestore) {
            if (backupExportMode === 'local') {
                if (includeFiles) {
                    try {
                        setBackupRunning(true); setBackupProgress(0); setBackupSpeed(0);
                        const res = await fetch('/api/backup/job/start', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ password })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setBackupJobId(data.jobId);
                        setBackupStateMsg('Starting full backup...');
                        pollBackupJob(data.jobId);
                    } catch (err) {
                        setBackupStateMsg('Backup failed: ' + err.message);
                        setBackupRunning(false);
                        setTimeout(() => setBackupStateMsg(''), 5000);
                    }
                } else {
                    try {
                        const res = await fetch('/api/backup/export', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ password })
                        });
                        if (!res.ok) throw new Error(await res.text());
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `kodo_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.kdba`;
                        document.body.appendChild(a); a.click(); a.remove();
                        setBackupStateMsg('Backup saved successfully!');
                    } catch (err) {
                        setBackupStateMsg('Backup failed: ' + err.message);
                        setTimeout(() => setBackupStateMsg(''), 5000);
                    }
                }
            } else if (backupExportMode === 'gdrive') {
                try {
                    const res = await fetch('/api/backup/gdrive/export', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to upload to Google Drive');
                    setBackupStateMsg('Backup uploaded to Google Drive successfully!');
                    setTimeout(() => setBackupStateMsg(''), 5000);
                } catch (err) {
                    setBackupStateMsg('GDrive Backup failed: ' + err.message);
                    setTimeout(() => setBackupStateMsg(''), 5000);
                }
            }
        } else {
            if (!backupFile) return;
            const fd = new FormData();
            fd.append('backupFile', backupFile);
            fd.append('password', password);
            try {
                const endpoint = backupFile.name?.includes('full')
                    ? '/api/backup/full-import'
                    : '/api/backup/import';
                const res = await fetch(endpoint, { method: 'POST', body: fd });
                const data = await res.json();
                if (!res.ok) {
                    if (endpoint.includes('full-import') && data.error?.includes('not a full backup')) {
                        const fd2 = new FormData();
                        fd2.append('backupFile', backupFile);
                        fd2.append('password', password);
                        const res2 = await fetch('/api/backup/import', { method: 'POST', body: fd2 });
                        const data2 = await res2.json();
                        if (!res2.ok) throw new Error(data2.error || 'Restore failed');
                        setBackupStateMsg('Restore successful! Please refresh Kodo.');
                    } else throw new Error(data.error || 'Restore failed');
                } else setBackupStateMsg('Restore successful! Please refresh Kodo.');
            } catch (err) {
                setBackupStateMsg('Restore failed: ' + err.message);
                setTimeout(() => setBackupStateMsg(''), 5000);
            }
        }
    };

    const handleRestoreClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.kdba';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                setBackupFile(file);
                handleOpenBackup(true, 'local');
            }
        };
        input.click();
    };

    const handleGDriveConnectSubmit = async () => {
        try {
            const res = await fetch('/api/gdrive/auth-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: gdriveClientId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setBackupStateMsg('Waiting for Google login...');

            // Use Tauri's shell open to break out of the webview and spawn the user's default browser
            if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
                try {
                    await window.__TAURI_INTERNALS__.invoke('plugin:shell|open', { path: data.url });
                } catch (e) {
                    console.error('Tauri shell open failed:', e);
                    const a = document.createElement('a'); a.href = data.url; a.target = '_blank'; a.rel = 'noreferrer';
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                }
            } else {
                const a = document.createElement('a'); a.href = data.url; a.target = '_blank'; a.rel = 'noreferrer';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }

            // Poll for status because postMessage doesn't work back from external browser to Tauri app
            let attempts = 0;
            const pollId = setInterval(async () => {
                attempts++;
                if (attempts > 60) {
                    clearInterval(pollId);
                    setBackupStateMsg('Google login timed out. Please try again.');
                    setTimeout(() => setBackupStateMsg(''), 5000);
                    return;
                }
                try {
                    const statusRes = await fetch('/api/gdrive/status');
                    const statusData = await statusRes.json();
                    if (statusData.isConnected) {
                        clearInterval(pollId);
                        setGdriveConnected(true);
                        setBackupStateMsg('Connected to Google Drive successfully!');
                        setTimeout(() => setBackupStateMsg(''), 5000);
                    }
                } catch (e) { }
            }, 2000);
        } catch (err) {
            setBackupStateMsg('Failed to connect: ' + err.message);
        }
    };

    const handleGDriveDisconnect = async () => {
        await fetch('/api/gdrive/disconnect', { method: 'POST' });
        setGdriveConnected(false);
    };

    const handleGDriveRestoreSubmit = async (fileId, password) => {
        setGdriveRestoreModalOpen(false);
        setBackupStateMsg('Downloading and restoring from Google Drive...');

        try {
            const res = await fetch('/api/backup/gdrive/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setBackupStateMsg('Restore from Google Drive successful! Please refresh Kodo.');
        } catch (err) {
            setBackupStateMsg('Restore failed: ' + err.message);
            setTimeout(() => setBackupStateMsg(''), 5000);
        }
    };

    const updateUpscaleSetting = (key, value) => {
        const updated = { ...upscaleSettings, [key]: value };
        setUpscaleSettings(updated);
        fetch('/api/upscale/settings', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
        }).catch(() => { });
    };

    const updateCompressorSetting = (key, value) => {
        const updated = { ...compressorSettings, [key]: value };
        setCompressorSettings(updated);
        fetch('/api/compress/settings', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
        }).catch(() => { });
    };

    const startUpscalerModelInstall = async (reinstall = true) => {
        if (packageState && ['downloading', 'extracting'].includes(packageState.status)) return;

        setPackageState(prev => ({
            ...(prev || {}),
            status: 'downloading',
            progress: typeof prev?.progress === 'number' ? Math.max(0, prev.progress) : 0,
            downloadedBytes: prev?.downloadedBytes || 0,
            totalBytes: prev?.totalBytes || 0,
            speedBytesPerSec: 0,
            error: '',
            updatedAt: Date.now(),
        }));

        try {
            const res = await fetch(apiUrl('/api/upscale/install-package'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reinstall }),
            });

            if (!res.ok) {
                let message = 'Failed to start model download.';
                try {
                    const data = await res.json();
                    if (data?.error) message = data.error;
                } catch {
                    // Ignore non-JSON error payloads.
                }
                throw new Error(message);
            }
        } catch (err) {
            setPackageState(prev => ({
                ...(prev || {}),
                status: 'error',
                speedBytesPerSec: 0,
                error: err?.message || 'Failed to start model download.',
            }));
        }
    };

    const cancelUpscalerModelInstall = async () => {
        if (!packageState || !['downloading', 'extracting'].includes(packageState.status)) return;
        try {
            await fetch(apiUrl('/api/upscale/cancel-install'), { method: 'POST' });
        } catch {
            // Ignore cancellation request transport errors and reset local UI state.
        }
        setPackageState(prev => ({
            ...(prev || {}),
            status: 'idle',
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            speedBytesPerSec: 0,
            error: '',
            updatedAt: Date.now(),
        }));
    };

    const openAppCacheFolder = async () => {
        try {
            await fetch(apiUrl('/api/cache/open-folder'), { method: 'POST' });
        } catch { }
    };

    const openUpscalerModelFolder = async () => {
        try {
            const res = await fetch(apiUrl('/api/upscale/open-model-folder'), { method: 'POST' });
            if (!res.ok) {
                let message = 'Failed to open model folder.';
                try {
                    const data = await res.json();
                    if (data?.error) message = data.error;
                } catch {
                    // Ignore non-JSON error payloads.
                }
                throw new Error(message);
            }
        } catch (err) {
            window.alert(err?.message || 'Failed to open model folder.');
        }
    };

    const dispatch = () => window.dispatchEvent(new Event('kodo-settings-changed'));

    const handleAutoRefresh = (val) => { setAutoRefresh(val); localStorage.setItem('kodo-auto-refresh', val); };
    const handleGridSize = (val) => { setGridSize(val); localStorage.setItem('kodo-grid-size', val); dispatch(); };
    const handleDefaultReadMode = (val) => { setDefaultReadMode(val); localStorage.setItem('kodo-default-readmode', val); };
    const handleDefaultFitMode = (val) => { setDefaultFitMode(val); localStorage.setItem('kodo-default-fitmode', val); };
    const handleOptimizeImages = (val) => { setOptimizeImages(val); localStorage.setItem('kodo-optimize-images', val); };
    const handleFixJaggedCovers = (val) => { setFixJaggedCovers(val); localStorage.setItem('kodo-jagged-covers', val); dispatch(); };
    const handleRotatingCovers = (val) => { setRotatingCovers(val); localStorage.setItem('kodo-rotating-covers', val); dispatch(); };
    const handleNsfwDisplay = (val) => { setNsfwDisplay(val); localStorage.setItem('kodo-nsfw-display', val); dispatch(); };
    const handleShowProgressBar = (val) => { setShowProgressBar(val); localStorage.setItem('kodo-show-progressbar', val); };
    const handleBarTimeout = (val) => { setBarTimeout(val); localStorage.setItem('kodo-bar-timeout', val); };
    const handleBarMinOpacity = (val) => { setBarMinOpacity(val); localStorage.setItem('kodo-bar-opacity', val); };

    // Set 55% as our new minimum, up to 100%. 160=55%, 190=65%, 220=75%, 260=85%, 300=100%
    const gridOptions = [
        { label: '55%', value: 160 },
        { label: '65%', value: 190 },
        { label: '75%', value: 220 },
        { label: '85%', value: 260 },
        { label: '100%', value: 300 },
    ];

    const readModes = [
        { value: 'Vertical', label: 'Vertical Scroll', desc: 'Scroll through all pages continuously' },
        { value: 'Single', label: 'Single Page', desc: 'One page at a time' },
        { value: 'Double', label: 'Double Page', desc: 'Two pages side by side' },
    ];

    const fitModes = [
        { value: 'Width', label: 'Contain to Width', desc: 'Scale to fill the width of the viewport' },
        { value: 'Height', label: 'Contain to Height', desc: 'Scale to fill the height of the viewport' },
        { value: 'Original', label: 'Original Size', desc: 'Display at natural resolution' },
    ];

    const radioStyle = (active) => ({
        width: 16, height: 16, borderRadius: '50%',
        border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'border-color 0.15s', cursor: 'pointer',
    });

    const radioDot = { width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' };

    return (
        <div className={modal ? '' : 'main-content'} style={modal ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } : { overflowY: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {!modal && (
                <div className="topbar">
                    <h2 className="topbar-title">Settings</h2>
                </div>
            )}

            {/* Section tab pills — with scroll arrows */}
            <div style={{
                display: 'flex', alignItems: 'stretch',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
                position: 'sticky', top: 0,
                background: 'var(--surface)',
                zIndex: 10,
                borderRadius: modal ? 0 : undefined,
            }}>
                <button onClick={() => scrollTabArrows(-1)} style={tabArrowStyle(canScrollLeft)}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div ref={tabsRef} className="hide-scroll" style={{
                    display: 'flex', gap: 4, padding: '10px 20px 0',
                    overflowX: 'auto', flex: 1,
                }}>
                    {SECTIONS.map(s => (
                        <button
                            key={s.id}
                            ref={el => tabBtnRefs.current[s.id] = el}
                            onClick={() => selectSection(s.id)}
                            style={{
                                background: 'none',
                                border: 'none',
                                borderBottom: `2px solid ${activeSection === s.id ? (s.id === 'upscale' ? '#f59e0b' : s.id === 'backup' ? '#3b82f6' : s.id === 'compressor' ? '#22c55e' : s.id === 'support' ? '#f43f5e' : 'var(--accent)') : 'transparent'}`,
                                color: activeSection === s.id ? (s.id === 'upscale' ? '#f59e0b' : s.id === 'backup' ? '#3b82f6' : s.id === 'compressor' ? '#22c55e' : s.id === 'support' ? '#f43f5e' : 'var(--accent)') : 'var(--muted)',
                                fontWeight: activeSection === s.id ? 700 : 500,
                                fontSize: 12.5,
                                padding: '6px 14px 8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                                borderRadius: 0,
                                marginBottom: -1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            {s.Icon && <s.Icon />}
                            {s.label}
                        </button>
                    ))}
                </div>
                <button onClick={() => scrollTabArrows(1)} style={tabArrowStyle(canScrollRight)}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>





            {/* Persistent backup status bar - visible across all sections */}
            {backupStateMsg && (
                <div style={{
                    margin: '0 0 0', padding: '10px 16px', flexShrink: 0,
                    borderBottom: '1px solid var(--border)',
                    background: backupStateMsg.toLowerCase().includes('fail') || backupStateMsg.toLowerCase().includes('error')
                        ? 'rgba(225,29,72,0.08)' : backupStateMsg.toLowerCase().includes('cancel')
                            ? 'rgba(245,158,11,0.08)' : backupRunning ? 'rgba(99,102,241,0.06)' : 'rgba(16,185,129,0.08)',
                    color: backupStateMsg.toLowerCase().includes('fail') || backupStateMsg.toLowerCase().includes('error')
                        ? '#e11d48' : backupStateMsg.toLowerCase().includes('cancel')
                            ? '#f59e0b' : backupRunning ? 'var(--accent)' : '#10b981',
                    fontSize: 12.5, fontWeight: 600,
                    display: 'flex', flexDirection: 'column', gap: 6
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {backupStateMsg.toLowerCase().includes('fail') || backupStateMsg.toLowerCase().includes('error')
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                            : backupRunning
                                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                                : backupStateMsg.toLowerCase().includes('restor')
                                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                        }
                        <span style={{ flex: 1 }}>{backupStateMsg}</span>
                        {backupRunning && backupSpeed > 0 && (
                            <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 500 }}>
                                {(backupSpeed / 1024 / 1024).toFixed(1)} MB/s
                            </span>
                        )}
                        {backupRunning && (
                            <button onClick={handleCancelBackup} style={{
                                background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.3)',
                                color: '#e11d48', fontSize: 10, fontWeight: 700,
                                padding: '2px 10px', borderRadius: 5, cursor: 'pointer',
                            }}>Cancel</button>
                        )}
                        {backupJobId && !backupRunning && backupProgress === 100 && (
                            <a href={apiUrl(`/api/backup/job/download/${backupJobId}`)} download style={{
                                background: '#10b981', color: '#fff', fontSize: 10, padding: '3px 10px', borderRadius: 5, fontWeight: 700, textDecoration: 'none'
                            }} onClick={() => {
                                setBackupStateMsg('Backup saved successfully!');
                                setBackupJobId(null);
                            }}>
                                Save Backup
                            </a>
                        )}
                    </div>
                    {(backupRunning || backupStateMsg.toLowerCase().includes('restor')) && (
                        <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                            <div style={{
                                width: backupRunning ? `${backupProgress}%` : '100%', height: '100%', borderRadius: 2,
                                background: backupRunning ? 'linear-gradient(90deg, var(--accent), #818cf8)' : 'linear-gradient(90deg, #10b981, #34d399)',
                                transition: 'width 0.3s ease',
                                animation: !backupRunning && backupStateMsg.toLowerCase().includes('restor') ? 'pulse 1.5s ease-in-out infinite' : 'none',
                            }} />
                        </div>
                    )}
                </div>
            )}
            <div ref={contentRef} className={`settings-page hide-scroll ${modal ? 'custom-scrollbar' : ''}`} style={modal ? { flex: 1, overflowY: 'auto', padding: '20px 24px 80px', maxWidth: 'none' } : { flex: 1, overflowY: 'auto', paddingBottom: 80 }}>

                {/* ── GENERAL ─────────────────────────────────── */}
                {activeSection === 'general' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="settings-card">
                            <div className="settings-row">
                                <div>
                                    <div className="settings-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        Theme
                                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontWeight: 700, border: '1px solid rgba(99,102,241,0.2)' }}>BETA</span>
                                    </div>
                                    <div className="settings-desc">Switch between Dark and Light mode</div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={theme === 'light'} onChange={onToggleTheme} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        </div>

                        <div className="settings-card">
                            <div className="settings-row" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div className="settings-label">Clear Processing & Kōdo Caches</div>
                                    <div className="settings-desc">Deletes residual Upscaler files and extracted CBZ pages from memory to free up disk space.</div>
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={() => setShowDeleteTempModal(true)} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: 12.5, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}>Clear Temp</button>

                                    <button onClick={() => setShowDeleteKodoModal(true)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: 12.5, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}>Clear Kōdo</button>
                                </div>
                            </div>
                            <div className="settings-row" style={{ paddingTop: 16, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <div className="settings-label" style={{ color: '#ef4444' }}>Clear Library Metadata</div>
                                    <div className="settings-desc">Wipes all saved series metadata (this will remove all series from your library, but keep your files safe).</div>
                                </div>
                                <button onClick={() => setShowDeleteMetadataModal(true)} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: 12.5, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}>Clear Metadata</button>
                            </div>

                            <div className="settings-row" style={{ paddingTop: 16, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
                                <div style={{ flex: 1 }}>
                                    <div className="settings-label">Open AppData Folder</div>
                                    <div className="settings-desc">View internally generated cache, database files, and system settings.</div>
                                </div>
                                <button onClick={openAppCacheFolder} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: 12.5, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}>Open Folder</button>
                            </div>

                            <div className="settings-row" style={{ paddingTop: 16 }}>
                                <div>
                                    <div className="settings-label">Auto Clear App Cache on Exit</div>
                                    <div className="settings-desc">Automatically run Clear Kodo Cache every time you close the application</div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={localStorage.getItem('kodo-auto-clear-exit') === 'true'} onChange={(e) => {
                                        localStorage.setItem('kodo-auto-clear-exit', e.target.checked);
                                        window.dispatchEvent(new Event('kodo-settings-changed'));
                                    }} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── BOOKMARKS ─────────────────────────────────── */}
                {activeSection === 'bookmarks' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="settings-card">
                            <div className="settings-row" style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                                <div>
                                    <div className="settings-label">Bookmark Screenshot Quality</div>
                                    <div className="settings-desc">From standard preview up to full resolution (100%). Watch out for large file sizes!</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 12, color: 'var(--muted)', width: 40, display: 'inline-block', textAlign: 'right', flexShrink: 0 }}>
                                        {bookmarkQuality}%
                                    </span>
                                    <input type="range" min="35" max="100" step="5" value={bookmarkQuality}
                                        onChange={e => {
                                            const v = parseInt(e.target.value);
                                            setBookmarkQuality(v);
                                            localStorage.setItem('kodo-bookmark-quality', v);
                                        }}
                                        style={{ width: 100, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                </div>
                            </div>

                            <div className="settings-row" style={{ paddingTop: 16, alignItems: 'flex-start' }}>
                                <div style={{ flex: 1, paddingRight: 24 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                        <div className="settings-label">Capture Area</div>
                                        <button
                                            className="btn btn-ghost"
                                            style={{ fontSize: '11px', padding: '4px 8px', height: 'auto', minHeight: 0 }}
                                            onClick={() => {
                                                setBmCropW(100); localStorage.setItem('kodo-bm-crop-w', 100);
                                                setBmCropH(110); localStorage.setItem('kodo-bm-crop-h', 110);
                                                setBmCropY(0); localStorage.setItem('kodo-bm-crop-y', 0);
                                            }}
                                        >
                                            Reset Defaults
                                        </button>
                                    </div>
                                    <div className="settings-desc" style={{ marginBottom: 20 }}>Adjust the width, height, and vertical offset of the screenshot capture area when adding a bookmark.</div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text)', marginBottom: 8, fontWeight: 500 }}>
                                                <span>Box Width</span>
                                                <span style={{ color: 'var(--muted)', display: 'inline-block', width: 40, textAlign: 'right', flexShrink: 0 }}>{bmCropW}%</span>
                                            </div>
                                            <input type="range" min="30" max="100" step="5" value={bmCropW}
                                                onChange={e => {
                                                    const v = parseInt(e.target.value);
                                                    setBmCropW(v);
                                                    localStorage.setItem('kodo-bm-crop-w', v);
                                                }}
                                                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                        </div>

                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text)', marginBottom: 8, fontWeight: 500 }}>
                                                <span>Box Height</span>
                                                <span style={{ color: 'var(--muted)', display: 'inline-block', width: 40, textAlign: 'right', flexShrink: 0 }}>{bmCropH}%</span>
                                            </div>
                                            <input type="range" min="30" max="200" step="5" value={bmCropH}
                                                onChange={e => {
                                                    const v = parseInt(e.target.value);
                                                    setBmCropH(v);
                                                    localStorage.setItem('kodo-bm-crop-h', v);
                                                }}
                                                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                        </div>

                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text)', marginBottom: 8, fontWeight: 500 }}>
                                                <span>Vertical Offset</span>
                                                <span style={{ color: 'var(--muted)', display: 'inline-block', width: 40, textAlign: 'right', flexShrink: 0 }}>{bmCropY > 0 ? '+' : ''}{bmCropY}%</span>
                                            </div>
                                            <input type="range" min="-100" max="100" step="5" value={bmCropY}
                                                onChange={e => {
                                                    const v = parseInt(e.target.value);
                                                    setBmCropY(v);
                                                    localStorage.setItem('kodo-bm-crop-y', v);
                                                }}
                                                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ width: 220, flexShrink: 0 }}>
                                    <div className="settings-label" style={{ marginBottom: 16, fontSize: 12, textAlign: 'center' }}>Crop Box Preview</div>
                                    <div style={{ width: '100%', height: 280, background: 'var(--surface)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        {/* Mock Manga Image Area */}
                                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 140, background: theme === 'dark' ? '#1e293b' : '#e2e8f0', transform: 'translateX(-50%)', borderRadius: 0, opacity: 0.8 }} />

                                        {/* Center Horizon Line (Representing Screen Center) */}
                                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(56, 189, 248, 0.4)', zIndex: 1 }} />
                                        <div style={{ position: 'absolute', top: 'calc(49% - 10px)', left: 8, fontSize: 10, color: '#38bdf8', fontWeight: 600, zIndex: 1 }}>Screen Center</div>

                                        {/* Crop Box */}
                                        <div style={{
                                            position: 'absolute',
                                            border: '2px dashed #ef4444',
                                            width: `${(bmCropW / 100) * 140}px`,
                                            height: `${(bmCropH / 100) * 140}px`,
                                            top: '50%', left: '50%',
                                            transform: `translate(-50%, calc(-50% + ${(bmCropY / 100) * 140}px))`,
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            zIndex: 2,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, padding: '2px 6px', textAlign: 'center', background: 'rgba(255,255,255,0.9)', borderRadius: 4, whiteSpace: 'nowrap' }}>Capture Area</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── LIBRARY ─────────────────────────────────── */}
                {activeSection === 'library' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="settings-card">
                            <div className="settings-row">
                                <div>
                                    <div className="settings-label">Library Card Size</div>
                                    <div className="settings-desc">Adjust the size of cover cards displayed in the library grid.</div>
                                </div>
                                <CustomDropdown
                                    items={gridOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                                    value={gridSize}
                                    onChange={(val) => handleGridSize(parseInt(val))}
                                />
                            </div>
                        </div>

                        <div className="settings-card">
                            <div className="settings-row">
                                <div>
                                    <div className="settings-label">Auto-Refresh Library</div>
                                    <div className="settings-desc">Rescan and update your library on launch.</div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={autoRefresh} onChange={(e) => handleAutoRefresh(e.target.checked)} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-row">
                                <div>
                                    <div className="settings-label">Smooth Cover Edges</div>
                                    <div className="settings-desc">Apply anti-aliasing to reduce jagged edges on high resolution cover images.</div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={fixJaggedCovers} onChange={(e) => handleFixJaggedCovers(e.target.checked)} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div className="settings-label">Multiple Series Cover Preview</div>
                                        <div className="settings-desc">Automatically crossfade between edition covers for entries that contain multiple series.</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={rotatingCovers} onChange={(e) => handleRotatingCovers(e.target.checked)} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                                {rotatingCovers && (
                                    <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                        <div className="settings-desc" style={{ color: 'var(--text)' }}>Interval between images</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: 12, color: 'var(--muted)', width: 44, textAlign: 'right' }}>
                                                {rotatingCoversInterval / 1000}s
                                            </span>
                                            <input type="range" min="1000" max="10000" step="500" value={rotatingCoversInterval}
                                                onChange={e => {
                                                    const v = parseInt(e.target.value);
                                                    setRotatingCoversInterval(v);
                                                    localStorage.setItem('kodo-rotating-covers-interval', v);
                                                    window.dispatchEvent(new Event('kodo-settings-changed'));
                                                }}
                                                style={{ width: 140, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-row" style={{ alignItems: 'flex-start' }}>
                                <div>
                                    <div className="settings-label" style={{ color: '#e11d48', fontWeight: 700 }}>Hide NSFW Content</div>
                                    <div className="settings-desc">Manage visibility of 18+ series in your library.</div>
                                    <div style={{ marginTop: 12, minWidth: 200 }}>
                                        <CustomDropdown
                                            items={[
                                                { value: 'blur', label: 'Blur' },
                                                { value: 'hide', label: 'Hide From Library' }
                                            ]}
                                            value={nsfwDisplay === 'show' ? 'blur' : nsfwDisplay}
                                            onChange={(val) => handleNsfwDisplay(val)}
                                        />
                                    </div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={nsfwDisplay !== 'show'} onChange={(e) => handleNsfwDisplay(e.target.checked ? 'blur' : 'show')} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── READ MODE ────────────────────────────────── */}
                {activeSection === 'readmode' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="settings-card">
                            <div className="settings-row">
                                <div>
                                    <div className="settings-label">Image Optimization</div>
                                    <div className="settings-desc">Enable GPU-accelerated rendering to improve visual smoothness and reduce jagged edges on high-resolution Series covers.</div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={optimizeImages} onChange={(e) => handleOptimizeImages(e.target.checked)} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        </div>

                        <div className="settings-card">
                            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                                <div>
                                    <div className="settings-label">Reading Mode</div>
                                    <div className="settings-desc">Choose the default layout when opening a chapter for the first time</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {readModes.map(m => (
                                        <div
                                            key={m.value}
                                            onClick={() => handleDefaultReadMode(m.value)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '10px 14px', borderRadius: 10,
                                                background: defaultReadMode === m.value ? 'rgba(var(--accent-rgb, 99,102,241), 0.08)' : 'transparent',
                                                border: `1px solid ${defaultReadMode === m.value ? 'var(--accent)' : 'transparent'}`,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                            }}
                                        >
                                            <div style={radioStyle(defaultReadMode === m.value)}>
                                                {defaultReadMode === m.value && <div style={radioDot} />}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.label}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{m.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                                <div>
                                    <div className="settings-label">Image Sizing</div>
                                    <div className="settings-desc">Default image fit mode for Single &amp; Double page modes</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {fitModes.map(m => (
                                        <div
                                            key={m.value}
                                            onClick={() => handleDefaultFitMode(m.value)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '10px 14px', borderRadius: 10,
                                                background: defaultFitMode === m.value ? 'rgba(var(--accent-rgb, 99,102,241), 0.08)' : 'transparent',
                                                border: `1px solid ${defaultFitMode === m.value ? 'var(--accent)' : 'transparent'}`,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                            }}
                                        >
                                            <div style={radioStyle(defaultFitMode === m.value)}>
                                                {defaultFitMode === m.value && <div style={radioDot} />}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.label}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{m.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-row">
                                <div>
                                    <div className="settings-label">Show Progress Bar</div>
                                    <div className="settings-desc">Display a reading progress indicator at the bottom of the screen.</div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={showProgressBar} onChange={(e) => handleShowProgressBar(e.target.checked)} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-row">
                                <div>
                                    <div className="settings-label">Toolbar Timeout</div>
                                    <div className="settings-desc">{barTimeout / 1000}s before fading out the reader toolbar</div>
                                </div>
                                <input type="range" min="1000" max="5000" step="500" value={barTimeout}
                                    onChange={e => handleBarTimeout(+e.target.value)}
                                    style={{ width: 120, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                            </div>

                            <div className="settings-divider" />

                            <div className="settings-row">
                                <div>
                                    <div className="settings-label">Toolbar Faded Opacity</div>
                                    <div className="settings-desc">{Math.round(barMinOpacity * 100)}% opacity when reader toolbar is inactive</div>
                                </div>
                                <input type="range" min="0" max="3" step="1"
                                    value={[0, 0.2, 0.4, 0.5].findIndex(v => v >= barMinOpacity) >= 0 ? [0, 0.2, 0.4, 0.5].findIndex(v => v >= barMinOpacity) : 0}
                                    onChange={e => handleBarMinOpacity([0, 0.2, 0.4, 0.5][+e.target.value])}
                                    style={{ width: 120, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── COMPRESSOR ─────────────────────────────────── */}
                {activeSection === 'compressor' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="settings-card" style={{ overflow: 'hidden' }}>
                            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#22c55e" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M9 4V9H4M15 4V9H20M4 15H9V20M15 20V15H20" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 800 }}>CBZ Compressor</div>
                                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>Manage compression behavior</div>
                                    </div>
                                </div>
                            </div>
                            <div className="settings-row">
                                <div style={{ flex: 1 }}>
                                    <div className="settings-label">Replace Mode</div>
                                    <div className="settings-desc">Choose what to do after files are compressed</div>
                                </div>
                                <div style={{ width: 280 }}>
                                    <CustomDropdown
                                        items={[
                                            { value: 'review', label: 'Always Ask (Review before overwrite)' },
                                            { value: 'delete', label: 'Auto Replace & Delete Original' }
                                        ]}
                                        value={compressorSettings.afterCompress || 'review'}
                                        onChange={(v) => updateCompressorSetting('afterCompress', v)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── UPSCALE ──────────────────────────────────── */}
                {activeSection === 'upscale' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* PACKAGE DOWNLOAD */}
                        <div className="settings-card upscale-package-card" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                            <div style={{ padding: '16px 20px' }}>
                                <div className="upscale-package-head" style={{ marginBottom: (packageState && ['downloading', 'extracting', 'error'].includes(packageState.status)) ? 16 : 0 }}>
                                    <div className="upscale-package-title">
                                        <div style={{
                                            width: 34, height: 34, borderRadius: 10,
                                            background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                                            border: '1px solid rgba(99,102,241,0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <svg width="20" height="20" fill="var(--accent)" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 512 342.06"><path d="M271.14 2.64c50.45 8.83 86.48 38.5 110.54 83.1l4.51-.45c18.95-1.39 38.61 1.62 56.18 8.84 34.63 14.2 55.57 42.42 64.44 77.79 6.76 26.89 7.34 56.62-.79 83.27-12.47 41.01-42.09 62.32-81.01 75.68l-.42.13c-8.15 2.76-16.46 5.06-24.56 6.93-39.29 6.93-249.08 3.73-296.18.56l-2.4-.26c-8.02-1.07-15.95-2.77-23.54-5.15-35.34-11.01-60.51-35.03-72.13-70.51-7.96-24.36-7.56-50.6.37-74.93 6.68-20.46 16.3-34.33 29.63-44.85 15.76-12.45 37.62-20.69 57.19-26.21C115.68 34.94 187.54-11.94 271.14 2.64zm55.11 186.93c5.19.22 8.87 1.94 11 5.17 5.77 8.66-2.11 17.21-7.58 23.23l-67.7 59.77c-5.8 6.41-14.06 6.41-19.86 0l-61.25-61.4c-5.11-5.77-11.43-13.62-6.12-21.6 2.19-3.23 5.83-4.95 11.01-5.17h34.9v-55.43c0-7.86 6.47-14.37 14.36-14.37h41.98c7.89 0 14.35 6.7 14.35 14.37v55.43h34.91z" /></svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>AI Models Packages</div>
                                            <div className="settings-desc">Download and manage the required AI models for Waifu2x and Real-ESRGAN. Models are installed locally.</div>
                                        </div>
                                    </div>
                                    {packageState && (['downloading', 'extracting'].includes(packageState.status)) ? (
                                        <div className="upscale-package-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                            <div style={{ flexShrink: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 2, textAlign: 'right' }}>
                                                    {packageState.status === 'extracting' ? 'Extracting models...' : `${packageState.progress}%`}
                                                </div>
                                                {packageState.status === 'downloading' && (
                                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                        {formatBytes(packageState.downloadedBytes)} / {formatBytes(packageState.totalBytes)}
                                                        {packageState.speedBytesPerSec > 0 && ` • ${formatBytes(packageState.speedBytesPerSec)}/s`}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                className="btn btn-ghost"
                                                style={{ fontSize: 11, padding: '4px 10px' }}
                                                onClick={openUpscalerModelFolder}
                                            >
                                                Open Folder
                                            </button>
                                            <button
                                                className="btn btn-ghost"
                                                style={{ fontSize: 11, padding: '4px 10px', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' }}
                                                onClick={cancelUpscalerModelInstall}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="upscale-package-actions">
                                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '6px 12px' }}
                                                onClick={openUpscalerModelFolder}>
                                                Open Folder
                                            </button>
                                            {(packageState?.status === 'done' || (upscaleSettings.waifu2xPath && upscaleSettings.realesrganPath)) && (
                                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '6px 12px', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                                    onClick={() => setShowDeleteUpscalerModal(true)}>
                                                    Delete
                                                </button>
                                            )}
                                            <button className="btn btn-primary" style={{ fontSize: 11, padding: '6px 12px' }}
                                                onClick={() => startUpscalerModelInstall(true)}>
                                                {(packageState?.status === 'done' || (upscaleSettings.waifu2xPath && upscaleSettings.realesrganPath)) ? 'Reinstall' : 'Download Models'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {packageState && packageState.status === 'error' && (
                                    <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                        <span style={{ flex: 1 }}>{packageState.error || 'Download failed.'}</span>
                                        <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px', flexShrink: 0 }}
                                            onClick={() => startUpscalerModelInstall(true)}>
                                            Retry
                                        </button>
                                    </div>
                                )}
                                {packageState && (['downloading', 'extracting', 'error'].includes(packageState.status)) && (
                                    <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: (packageState.status === 'error' ? 100 : packageState.progress) + '%', background: packageState.status === 'error' ? '#ef4444' : 'var(--accent)', transition: 'width 0.3s ease' }} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* WAIFU2X CONFIG */}
                        <div className="settings-card" style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.15)' }}>
                            <div style={{ padding: '16px 20px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 10,
                                        background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.1))',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18   " height="18" fill="#10b981" class="bi bi-lightning-fill" viewBox="0 0 16 16">
                                            <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641z" />
                                        </svg>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Waifu2x</div>
                                        <div className="settings-desc">Anime-style art upscaler configuration</div>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-divider" style={{ background: 'rgba(16,185,129,0.1)' }} />

                            <div style={{ padding: '16px 20px', display: 'flex', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="settings-label" style={{ marginBottom: 6 }}>Default Scale</div>
                                    <CustomDropdown
                                        value={upscaleSettings.waifu2xScale ?? 2}
                                        onChange={val => updateUpscaleSetting('waifu2xScale', val)}
                                        items={[
                                            { value: 1, label: '1×' },
                                            { value: 2, label: '2×' },
                                            { value: 4, label: '4×' },
                                            { value: 8, label: '8×' }
                                        ]}
                                    />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="settings-label" style={{ marginBottom: 6 }}>Default Denoise</div>
                                    <CustomDropdown
                                        value={upscaleSettings.waifu2xDenoiseLevel ?? 1}
                                        onChange={val => updateUpscaleSetting('waifu2xDenoiseLevel', val)}
                                        items={[
                                            { value: -1, label: 'None' },
                                            { value: 0, label: 'Weak' },
                                            { value: 1, label: 'Medium' },
                                            { value: 2, label: 'High' },
                                            { value: 3, label: 'Max' }
                                        ]}
                                    />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="settings-label" style={{ marginBottom: 6 }}>Parallel Tasks</div>
                                    <CustomDropdown
                                        value={upscaleSettings.waifu2xWorkers ?? 3}
                                        onChange={val => updateUpscaleSetting('waifu2xWorkers', val)}
                                        items={[
                                            { value: 1, label: '1 Instance' },
                                            { value: 3, label: '3 Instances' },
                                            { value: 6, label: '6 Instances' },
                                            { value: 10, label: '10 Instances' }
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* REAL-ESRGAN CONFIG */}
                        <div className="settings-card" style={{ background: 'rgba(99,102,241,0.04)', borderColor: 'rgba(99,102,241,0.15)' }}>
                            <div style={{ padding: '16px 20px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 10,
                                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                                        border: '1px solid rgba(99,102,241,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <svg fill="#818cf8" stroke="#818cf8" width="18" height="18" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="3.5"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M 26.6875 12.6602 C 26.9687 12.6602 27.1094 12.4961 27.1797 12.2383 C 27.9062 8.3242 27.8594 8.2305 31.9375 7.4570 C 32.2187 7.4102 32.3828 7.2461 32.3828 6.9648 C 32.3828 6.6836 32.2187 6.5195 31.9375 6.4726 C 27.8828 5.6524 28.0000 5.5586 27.1797 1.6914 C 27.1094 1.4336 26.9687 1.2695 26.6875 1.2695 C 26.4062 1.2695 26.2656 1.4336 26.1953 1.6914 C 25.3750 5.5586 25.5156 5.6524 21.4375 6.4726 C 21.1797 6.5195 20.9922 6.6836 20.9922 6.9648 C 20.9922 7.2461 21.1797 7.4102 21.4375 7.4570 C 25.5156 8.2774 25.4687 8.3242 26.1953 12.2383 C 26.2656 12.4961 26.4062 12.6602 26.6875 12.6602 Z M 15.3438 28.7852 C 15.7891 28.7852 16.0938 28.5039 16.1406 28.0821 C 16.9844 21.8242 17.1953 21.8242 23.6641 20.5821 C 24.0860 20.5117 24.3906 20.2305 24.3906 19.7852 C 24.3906 19.3633 24.0860 19.0586 23.6641 18.9883 C 17.1953 18.0977 16.9609 17.8867 16.1406 11.5117 C 16.0938 11.0899 15.7891 10.7852 15.3438 10.7852 C 14.9219 10.7852 14.6172 11.0899 14.5703 11.5352 C 13.7969 17.8164 13.4687 17.7930 7.0469 18.9883 C 6.6250 19.0821 6.3203 19.3633 6.3203 19.7852 C 6.3203 20.2539 6.6250 20.5117 7.1406 20.5821 C 13.5156 21.6133 13.7969 21.7774 14.5703 28.0352 C 14.6172 28.5039 14.9219 28.7852 15.3438 28.7852 Z M 31.2344 54.7305 C 31.8438 54.7305 32.2891 54.2852 32.4062 53.6524 C 34.0703 40.8086 35.8750 38.8633 48.5781 37.4570 C 49.2344 37.3867 49.6797 36.8945 49.6797 36.2852 C 49.6797 35.6758 49.2344 35.2070 48.5781 35.1133 C 35.8750 33.7070 34.0703 31.7617 32.4062 18.9180 C 32.2891 18.2852 31.8438 17.8633 31.2344 17.8633 C 30.6250 17.8633 30.1797 18.2852 30.0860 18.9180 C 28.4219 31.7617 26.5938 33.7070 13.9140 35.1133 C 13.2344 35.2070 12.7891 35.6758 12.7891 36.2852 C 12.7891 36.8945 13.2344 37.3867 13.9140 37.4570 C 26.5703 39.1211 28.3281 40.8321 30.0860 53.6524 C 30.1797 54.2852 30.6250 54.7305 31.2344 54.7305 Z"></path></g></svg>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Real-ESRGAN</div>
                                        <div className="settings-desc">General purpose & photos upscaler</div>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-divider" style={{ background: 'rgba(99,102,241,0.1)' }} />

                            <div style={{ padding: '16px 20px', display: 'flex', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="settings-label" style={{ marginBottom: 6 }}>Default Scale</div>
                                    <CustomDropdown
                                        value={upscaleSettings.esrganScale ?? 4}
                                        onChange={val => updateUpscaleSetting('esrganScale', parseInt(val))}
                                        items={[
                                            { value: 2, label: '2×' },
                                            { value: 3, label: '3×' },
                                            { value: 4, label: '4×' },
                                            { value: 8, label: '8×' }
                                        ]}
                                    />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="settings-label" style={{ marginBottom: 6 }}>Default Denoise</div>
                                    <CustomDropdown
                                        value={upscaleSettings.esrganDenoise ?? -1}
                                        onChange={val => updateUpscaleSetting('esrganDenoise', val)}
                                        items={[
                                            { value: -1, label: 'None' },
                                            { value: 0, label: 'Weak' },
                                            { value: 1, label: 'Medium' },
                                            { value: 2, label: 'High' },
                                            { value: 3, label: 'Max' }
                                        ]}
                                    />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="settings-label" style={{ marginBottom: 6 }}>Parallel Tasks</div>
                                    <CustomDropdown
                                        value={upscaleSettings.esrganWorkers ?? 1}
                                        onChange={val => updateUpscaleSetting('esrganWorkers', val)}
                                        items={[
                                            { value: 1, label: '1 Instance' },
                                            { value: 3, label: '3 Instances' },
                                            { value: 6, label: '6 Instances' },
                                            { value: 10, label: '10 Instances' }
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* ── BACKUP & SYNC ──────────────────────────────────── */}
                {activeSection === 'backup' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>


                        {/* What Gets Backed Up + Include Files Toggle */}
                        <div className="settings-card">
                            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                                <div className="settings-label" style={{ fontSize: 13 }}>What's included in backups?</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {['Metadata', 'Read Progress', 'Series Editions', 'Bookmarks', 'NSFW Flags', 'Cover', 'Categories', ...(includeFiles ? ['Manga Files (CBZ)'] : [])].map(item => (
                                        <span key={item} style={{
                                            fontSize: 11, padding: '3px 10px', borderRadius: 20,
                                            background: item === 'Manga Files (CBZ)' ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.1)',
                                            color: item === 'Manga Files (CBZ)' ? '#f59e0b' : '#818cf8',
                                            border: `1px solid ${item === 'Manga Files (CBZ)' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.15)'}`,
                                            fontWeight: 600
                                        }}>{item}</span>
                                    ))}
                                </div>
                                <div className="settings-desc" style={{ marginTop: 2 }}>
                                    Encrypted with <b>AES-256-GCM</b>. Without the correct password, the file cannot be read.
                                </div>
                            </div>

                            <div className="settings-divider" style={{ margin: '0' }} />

                            <div className="settings-row">
                                <div>
                                    <div className="settings-label" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        Include Manga Files
                                        {mangaSize && (
                                            <span style={{ fontSize: 10, padding: '1px 8px', borderRadius: 12, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.15)', fontWeight: 600 }}>
                                                ~{mangaSize.totalMB > 1024 ? (mangaSize.totalMB / 1024).toFixed(1) + ' GB' : mangaSize.totalMB + ' MB'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="settings-desc">Include all chapter folders and CBZ files in the backup. File will be much larger.</div>
                                </div>
                                <label className="toggle">
                                    <input type="checkbox" checked={includeFiles} onChange={(e) => setIncludeFiles(e.target.checked)} />
                                    <span className="toggle-slider" />
                                </label>
                            </div>
                        </div>

                        {/* Local Backup Card */}
                        <div className="settings-card">
                            <div style={{ padding: '16px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 10,
                                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                                        border: '1px solid rgba(99,102,241,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Local Backup</div>
                                        <div className="settings-desc">Save backups .kdba file to your PC</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }} onClick={() => handleOpenBackup(false, 'local')}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                        Export
                                    </button>
                                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 16px', border: '1px solid var(--border)' }} onClick={handleRestoreClick}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                                        Restore
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Google Drive Card */}
                        <div className="settings-card">
                            <div style={{ padding: '16px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 10,
                                        background: 'linear-gradient(135deg, rgba(66,133,244,0.15), rgba(52,168,83,0.1))',
                                        border: '1px solid rgba(66,133,244,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <svg
                                            role="img"
                                            viewBox="0 0 24 24"
                                            width="20"
                                            height="20"
                                            fill="#4285f4"
                                            xmlns="http://www.w3.org/2000/svg">
                                            <title>Google Drive</title>
                                            <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
                                        </svg>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            Google Drive
                                            {gdriveConnected && (
                                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.12)', color: '#10b981', fontWeight: 700, border: '1px solid rgba(16,185,129,0.2)' }}>Connected</span>
                                            )}
                                        </div>
                                        <div className="settings-desc">Sync series & metadata backups to your Personal Google Drive cloud storage</div>
                                    </div>
                                </div>

                                {!gdriveConnected ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                            <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Setup Guide (one-time only)</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <span style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'rgba(66,133,244,0.15)', color: '#4285f4', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                                                    <span>Go to <b><a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{ color: '#4285f4', textDecoration: 'none' }}>console.cloud.google.com</a></b></span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <span style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'rgba(66,133,244,0.15)', color: '#4285f4', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                                                    <span>Create a new Project (any name)</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <span style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'rgba(66,133,244,0.15)', color: '#4285f4', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
                                                    <span>Go to <b>APIs & Services</b> → Enable <b>Google Drive API</b></span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <span style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'rgba(66,133,244,0.15)', color: '#4285f4', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>4</span>
                                                    <span>Go to <b>Credentials</b> → Create <b>OAuth Client ID</b> (Web Application)</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <span style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'rgba(66,133,244,0.15)', color: '#4285f4', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>5</span>
                                                    <span>Add Authorized JavaScript origin: <code style={{ fontSize: 11, background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>http://localhost:5000</code></span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <span style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'rgba(66,133,244,0.15)', color: '#4285f4', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>6</span>
                                                    <span>Add Authorized redirect URI: <code style={{ fontSize: 11, background: 'var(--bg)', padding: '1px 6px', borderRadius: 4 }}>http://localhost:5000/api/gdrive/callback</code></span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <span style={{ minWidth: 20, height: 20, borderRadius: '50%', background: 'rgba(66,133,244,0.15)', color: '#4285f4', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>7</span>
                                                    <span>Copy the <b>Client ID</b> and paste it below:</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                value={gdriveClientId}
                                                onChange={(e) => setGdriveClientId(e.target.value)}
                                                placeholder="Paste your Google Client ID here..."
                                                style={{
                                                    flex: 1, padding: '8px 12px', borderRadius: 8,
                                                    border: '1px solid var(--border)', background: 'var(--surface2)',
                                                    color: 'var(--text)', fontSize: 12, fontFamily: 'monospace',
                                                }}
                                            />
                                            <button
                                                className="btn btn-primary"
                                                style={{ fontSize: 12, padding: '8px 16px', whiteSpace: 'nowrap' }}
                                                disabled={!gdriveClientId}
                                                onClick={handleGDriveConnectSubmit}
                                            >
                                                <svg
                                                    role="img"
                                                    viewBox="0 0 24 24"
                                                    width="16"
                                                    height="16"
                                                    fill="currentfill"
                                                    xmlns="http://www.w3.org/2000/svg">
                                                    <title>Google Drive</title>
                                                    <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
                                                </svg>
                                                Login with Google
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }} onClick={() => handleOpenBackup(false, 'gdrive')}>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                                Backup to Drive
                                            </button>
                                            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 16px', border: '1px solid var(--border)' }} onClick={() => setGdriveRestoreModalOpen(true)}>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                                                Restore from Drive
                                            </button>
                                        </div>
                                        <button className="btn btn-ghost" style={{ color: '#e11d48', fontSize: 11, padding: 0, alignSelf: 'flex-start', opacity: 0.7 }} onClick={handleGDriveDisconnect}>
                                            Disconnect Google Account
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── ABOUT ────────────────────────────────────── */}
                {activeSection === 'about' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                            padding: '32px 20px', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
                            position: 'relative', overflow: 'hidden'
                        }}>
                            {/* Decorative background blur */}
                            <div style={{
                                position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)',
                                width: 200, height: 200, background: 'var(--accent)', filter: 'blur(100px)', opacity: 0.15, pointerEvents: 'none'
                            }} />

                            <div style={{
                                width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, var(--surface2) 0%, rgba(255,255,255,0.05) 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.2)', marginBottom: 16, position: 'relative', zIndex: 1
                            }}>
                                <img src={kodo500Logo} alt="Kōdo" style={{ width: 72, height: 72 }} />
                            </div>

                            <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4, color: 'var(--text)', position: 'relative', zIndex: 1 }}>Kōdo</h2>
                            <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 20, letterSpacing: 0.3, position: 'relative', zIndex: 1 }}>Latest Modern & Simple Local Manga & Manhwa Reader
                                <br />Built-in AI Tools · Smart Backup · Advanced Optimization</p>

                            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, maxWidth: 360, margin: '0 0 24px', opacity: 0.85, position: 'relative', zIndex: 1 }}>
                                Open-source high performance local reader designed to provide the best reading experience without clutter.
                            </p>

                            <div style={{ display: 'flex', gap: 12, position: 'relative', zIndex: 1 }}>
                                <a href="https://github.com/ToastyyyBread" target="_blank" rel="noopener noreferrer" style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20,
                                    background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, fontWeight: 600,
                                    textDecoration: 'none', border: '1px solid var(--border)', transition: 'all 0.2s'
                                }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                                    </svg>
                                    GitHub
                                </a>
                            </div>
                        </div>

                        {/* Credits Section */}
                        <div style={{ padding: '0 8px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', margin: '4px 0 12px 12px' }}>Powered By</div>

                            <div className="settings-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 20, border: '1px solid var(--border)', padding: '20px' }}>
                                {[
                                    { name: 'Waifu2x', desc: 'Anime AI Upscaler', color: '#10b981' },
                                    { name: 'Real-ESRGAN', desc: 'Advanced AI Upscaler', color: '#8b5cf6' },
                                    { name: 'Sharp', desc: 'Image Processing Engine', color: '#0ea5e9' },
                                    { name: 'MozJPEG', desc: 'Advanced JPEG Encoder', color: '#f59e0b' },
                                    { name: 'Pngquant', desc: 'Lossy PNG Compressor', color: '#ef4444' },
                                    { name: 'React', desc: 'Frontend UI Library', color: '#61dafb' },
                                    { name: 'Vite', desc: 'Next Generation Frontend Tooling', color: '#bd34fe' },
                                    { name: 'Express', desc: 'Fast Node.js Framework', color: '#22c55e' }
                                ].map(tool => (
                                    <div key={tool.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: `linear-gradient(135deg, ${tool.color}, ${tool.color}aa)` }} />
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{tool.name}</div>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{tool.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Copyright */}
                        <div style={{ textAlign: 'center', margin: '8px 0', fontSize: 12, color: 'var(--muted)', opacity: 0.7, fontWeight: 500 }}>
                            &copy; {new Date().getFullYear()} ToastyyyBread. All rights reserved.
                        </div>
                    </div>
                )}
                {/* ── CHANGELOG ─────────────────────────────────── */}
                {activeSection === 'changelog' && (
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 16,
                        animation: 'slideUp 0.35s ease both'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: 8, marginTop: 16 }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(14, 165, 233, 0.2))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid rgba(14, 165, 233, 0.3)'
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            </div>
                            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Changelog Kōdo</h2>
                            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
                                A look back at the journey and major features built to bring Kōdo to its first major release.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                            {[
                                { date: 'March 2026', version: 'v1.1.2 (Current Release)', features: ['Ported core engine components to Rust for enhanced stability and performance.', 'Optimized AI Upscaler processing logic, resolving the "waiting" state hang bugs.', 'Restructured AI Models architecture to support dynamic, isolated folder installations.', 'Enhanced process lifecycle management to prevent orphaned background tasks.', 'Refined UI navigation with persistent state caching for a smoother experience.'] },
                                { date: 'Early March 2026', version: 'v1.1.0', features: ['Official release of v1.1.0!', 'Added interactive AI Upscaler tool with real-time UI.', 'Implemented Smart Backup System (Local & Cloud via GDrive).', 'Streamlined image optimization via Compressor tool.', 'Added Custom Changelog, Settings Polish, and "About" screen credits.'] },
                                { date: 'Late February 2026', version: 'Beta 0.9', features: ['Chapter Renamer feature implemented with scrolling limits.', 'Library UI redesigned with elegant layout and animations.', 'Reader mode fixed to preserve smooth scrolling alongside zooming.', 'Introduced precise 0% Last Read Tracker inside MandaDetail page.'] },
                                { date: 'Mid February 2026', version: 'Beta 0.7', features: ['Added NSFW tagging and blurred covers support.', 'Implemented custom Sidebar category management system with custom popups.', 'UI styling revamp: glassmorphism, accent colors, custom context menus.', 'Support for filtering Library entries by specific user categories.'] },
                                { date: 'January 2026', version: 'Beta 0.5', features: ['App infrastructure moved to React with scalable folder architecture.', 'Custom Python backend scraper configurations mapped with Node.', 'Implemented sorting logic for chapters and library entries.', 'Initial integrations for Waifu2x and Real-ESRGAN dependencies.'] },
                                { date: 'Late 2025', version: 'Alpha 0.1', features: ['Initial core reader foundation built.', 'First basic test of reading Manga from local folder storage.', 'Database structure mapping constructed with SQLite.'] }
                            ].map((log, i) => (
                                <div key={i} className="settings-card" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
                                    {/* Highlighting badge for newest version */}
                                    {i === 0 && (
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#f59e0b' }} />
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? '#f59e0b' : 'var(--text)' }}>{log.version}</div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', background: 'var(--surface2)', padding: '4px 10px', borderRadius: 8 }}>{log.date}</div>
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7, opacity: 0.9 }}>
                                        {log.features.map((feat, j) => <li key={j} style={{ marginBottom: 6 }}>{feat}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* ── SUPPORT THE PROJECT ─────────────────────────────── */}
                {activeSection === 'support' && (
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640,
                        margin: '0 auto', width: '100%', padding: '0 8px',
                        animation: 'slideUp 0.35s ease both'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: 8, marginTop: 16 }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(244, 63, 94, 0.2))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid rgba(244, 63, 94, 0.3)'
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            </div>
                            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Support The Project</h2>
                            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
                                Kōdo is developed entirely for free in my spare time. If you enjoy using it, consider making a small donation to help ensure its continued maintanence and future improvements!
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* PayPal */}
                            <a href="https://paypal.me/mhmtsyd" target="_blank" rel="noopener noreferrer" style={{
                                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 16,
                                background: 'var(--surface)', border: '1.5px solid var(--border)', textDecoration: 'none', transition: 'all 0.2s',
                                cursor: 'pointer', position: 'relative', overflow: 'hidden'
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(0, 112, 186, 0.4)'; e.currentTarget.style.background = 'linear-gradient(145deg, rgba(0, 112, 186, 0.05) 0%, var(--surface) 100%)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0, 112, 186, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={paypalLogo} alt="PayPal" style={{ width: 24, height: 24 }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>PayPal</div>
                                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Ideal for international users</div>
                                </div>
                                <div style={{ color: 'var(--muted)', opacity: 0.5 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </div>
                            </a>

                            {/* Ko-fi */}
                            <a href="https://ko-fi.com/toastyyybread" target="_blank" rel="noopener noreferrer" style={{
                                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 16,
                                background: 'var(--surface)', border: '1.5px solid var(--border)', textDecoration: 'none', transition: 'all 0.2s',
                                cursor: 'pointer', position: 'relative', overflow: 'hidden'
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(41, 143, 246, 0.4)'; e.currentTarget.style.background = 'linear-gradient(145deg, rgba(41, 143, 246, 0.05) 0%, var(--surface) 100%)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(41, 143, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <img src={kofiLogo} alt="Ko-fi" style={{ width: 26, height: 26 }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Ko-fi</div>
                                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Support me with a cup of coffee</div>
                                </div>
                                <div style={{ color: 'var(--muted)', opacity: 0.5 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </div>
                            </a>

                            {/* Trakteer */}
                            <a href="https://trakteer.id/mhmtsyd" target="_blank" rel="noopener noreferrer" style={{
                                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 16,
                                background: 'var(--surface)', border: '1.5px solid var(--border)', textDecoration: 'none', transition: 'all 0.2s',
                                cursor: 'pointer', position: 'relative', overflow: 'hidden'
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'rgba(193, 27, 46, 0.4)'; e.currentTarget.style.background = 'linear-gradient(145deg, rgba(193, 27, 46, 0.05) 0%, var(--surface) 100%)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(193, 27, 46, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C11B2E' }}>
                                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20.2 6.8c-1.6-1.6-4.1-1.6-5.7 0L12 9.3 9.5 6.8c-1.6-1.6-4.1-1.6-5.7 0-1.6 1.6-1.6 4.1 0 5.7L12 20.7l8.2-8.2c1.6-1.6 1.6-4.2 0-5.7z" /></svg>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Trakteer</div>
                                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>For Indonesian users (GOPAY, OVO, etc.)</div>
                                </div>
                                <div style={{ color: 'var(--muted)', opacity: 0.5 }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </div>
                            </a>
                        </div>
                    </div>
                )}

            </div>

            {/* Modals */}
            {modal}

            {backupModalOpen && (
                <BackupPasswordModal
                    isRestore={backupIsRestore}
                    onClose={() => setBackupModalOpen(false)}
                    onSubmit={handleBackupSubmit}
                />
            )}

            {gdriveRestoreModalOpen && (
                <GDriveRestoreModal
                    onClose={() => setGdriveRestoreModalOpen(false)}
                    onRestore={handleGDriveRestoreSubmit}
                />
            )}

            {/* AI Models Custom Delete Confirm Modal */}
            {showDeleteUpscalerModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'modalFadeIn 0.2s ease forwards'
                }}>
                    <div style={{
                        background: 'var(--surface)',
                        width: '100%', maxWidth: 400,
                        borderRadius: 20,
                        padding: '24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        border: '1px solid var(--border)',
                        animation: 'modalPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Delete AI Models</h3>
                                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>This action cannot be undone.</div>
                            </div>
                        </div>

                        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, marginBottom: 24, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            Are you sure you want to delete all downloaded Upscaler Models? You will not be able to use the AI Upscale feature until you re-download them.
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setShowDeleteUpscalerModal(false)}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: 10,
                                    background: 'var(--surface2)', border: '1px solid var(--border)',
                                    color: 'var(--text)', fontSize: 14, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    fetch(apiUrl('/api/upscale/delete-package'), { method: 'DELETE' }).then(() => setPackageState(prev => ({ ...prev, status: 'idle' })));
                                    setShowDeleteUpscalerModal(false);
                                }}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: 10,
                                    background: '#ef4444', border: 'none',
                                    color: '#fff', fontSize: 14, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                                onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                            >
                                Yes, Delete Models
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Modal for Clear Temp */}
            {showDeleteTempModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'modalFadeIn 0.2s ease forwards'
                }}>
                    <div style={{
                        background: 'var(--surface)',
                        width: '100%', maxWidth: 400,
                        borderRadius: 20,
                        padding: '24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        border: '1px solid var(--border)',
                        animation: 'modalPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Clear Temp Caches</h3>
                                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>This will delete processing files.</div>
                            </div>
                        </div>

                        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, marginBottom: 24, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            Clear all temporary processing caches? This action will free up disk space used by temporary upscaler and extraction tasks.
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setShowDeleteTempModal(false)}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: 10,
                                    background: 'var(--surface2)', border: '1px solid var(--border)',
                                    color: 'var(--text)', fontSize: 14, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    fetch('/api/cache/clear-temp', { method: 'POST' }).then(() => {
                                        dispatch();
                                    });
                                    setShowDeleteTempModal(false);
                                }}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: 10,
                                    background: '#f59e0b', border: 'none',
                                    color: '#fff', fontSize: 14, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#d97706'}
                                onMouseLeave={e => e.currentTarget.style.background = '#f59e0b'}
                            >
                                Clear Temp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Modal for Clear Kodo */}
            {showDeleteKodoModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'modalFadeIn 0.2s ease forwards'
                }}>
                    <div style={{
                        background: 'var(--surface)',
                        width: '100%', maxWidth: 400,
                        borderRadius: 20,
                        padding: '24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        border: '1px solid var(--border)',
                        animation: 'modalPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Clear Kōdo Caches</h3>
                                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>This will delete page caches and bookmarks.</div>
                            </div>
                        </div>

                        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, marginBottom: 24, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            Are you sure you want to clear all Kōdo caches? This will delete all cached pages and also delete all of your saved bookmarks and bookmark screenshots.
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setShowDeleteKodoModal(false)}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: 10,
                                    background: 'var(--surface2)', border: '1px solid var(--border)',
                                    color: 'var(--text)', fontSize: 14, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    fetch('/api/cache/clear-kodo', { method: 'POST' }).then(() => {
                                        dispatch();
                                    });
                                    setShowDeleteKodoModal(false);
                                }}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: 10,
                                    background: '#ef4444', border: 'none',
                                    color: '#fff', fontSize: 14, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                                onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                            >
                                Clear Kōdo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Modal for Clear Metadata */}
            {showDeleteMetadataModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'modalFadeIn 0.2s ease forwards'
                }}>
                    <div style={{
                        background: 'var(--surface)',
                        width: '100%', maxWidth: 400,
                        borderRadius: 20,
                        padding: '24px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        border: '1px solid var(--border)',
                        animation: 'modalPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>Clear Library Metadata</h3>
                                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>This will wipe all series info.</div>
                            </div>
                        </div>

                        <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, marginBottom: 24, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            Are you absolutely sure you want to clear ALL library metadata? This will empty your library completely and wipe all saved bookmarks. Your manga files will not be deleted.
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                onClick={() => setShowDeleteMetadataModal(false)}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: 10,
                                    background: 'var(--surface2)', border: '1px solid var(--border)',
                                    color: 'var(--text)', fontSize: 14, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    fetch('/api/meta/clear', { method: 'POST' })
                                        .then(() => {
                                            window.location.reload();
                                        });
                                    setShowDeleteMetadataModal(false);
                                }}
                                style={{
                                    flex: 1, padding: '10px 0', borderRadius: 10,
                                    background: '#ef4444', border: 'none',
                                    color: '#fff', fontSize: 14, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                                onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                            >
                                Clear Metadata
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
