import React, { useEffect, useState, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import CustomDropdown from './CustomDropdown';
import { apiUrl } from '../runtime';

const LANGUAGES = ['English', 'Japanese', 'Korean', 'Chinese', 'Indonesian', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Russian', 'Vietnamese', 'Thai', 'Italian', 'Polish'];
const STATUSES = ['Ongoing', 'Completed', 'Cancelled', 'Hiatus'];

const FolderBrowser = ({ onSelect, onCancel }) => {
    const [currentPath, setCurrentPath] = useState('');
    const [dirs, setDirs] = useState([]);
    const [cbzCount, setCbzCount] = useState(0);
    const [parent, setParent] = useState('');
    const [loading, setLoading] = useState(false);
    const [inputPath, setInputPath] = useState('');

    const browse = async (folderPath) => {
        setLoading(true);
        try {
            const res = await fetch(apiUrl('/api/browse-folder'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: folderPath || undefined })
            });
            const data = await res.json();
            setCurrentPath(data.path);
            setDirs(data.dirs);
            setCbzCount(data.cbzCount);
            setParent(data.parent);
            setInputPath(data.path);
        } catch { }
        setLoading(false);
    };

    const handleGo = () => {
        if (inputPath.trim()) browse(inputPath.trim());
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
                <input
                    className="form-input"
                    placeholder="Enter folder path, e.g. D:\Manga\Series"
                    value={inputPath}
                    onChange={e => setInputPath(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGo()}
                    style={{ flex: 1, fontSize: '12px' }}
                />
                <button className="btn btn-ghost" onClick={handleGo} style={{ flexShrink: 0, fontSize: '11px' }}>Go</button>
            </div>

            {currentPath && (
                <div style={{
                    background: 'var(--input-bg)', border: '1px solid var(--border)',
                    borderRadius: '8px', maxHeight: '180px', overflowY: 'auto'
                }}>
                    {/* Go up */}
                    {parent && parent !== currentPath && (
                        <button
                            onClick={() => browse(parent)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '7px 12px', width: '100%', textAlign: 'left',
                                background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                                color: 'var(--muted)', fontSize: '12px', cursor: 'pointer'
                            }}
                        >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            ..
                        </button>
                    )}
                    {dirs.map(d => (
                        <button
                            key={d}
                            onClick={() => browse(currentPath + '\\' + d)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '7px 12px', width: '100%', textAlign: 'left',
                                background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                                color: 'var(--text)', fontSize: '12px', cursor: 'pointer'
                            }}
                        >
                            📁 {d}
                        </button>
                    ))}
                    {dirs.length === 0 && cbzCount === 0 && (
                        <div style={{ padding: '12px', color: 'var(--muted)', fontSize: '11px', textAlign: 'center' }}>Empty folder</div>
                    )}
                </div>
            )}

            {currentPath && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {cbzCount > 0 ? `${cbzCount} CBZ files found` : dirs.length > 0 ? `${dirs.length} subfolders` : 'No manga content'}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-ghost" onClick={onCancel} style={{ fontSize: '11px', padding: '6px 12px' }}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={() => onSelect(currentPath)}
                            style={{ fontSize: '11px', padding: '6px 12px' }}
                        >Select This Folder</button>
                    </div>
                </div>
            )}

            {!currentPath && (
                <button className="btn btn-ghost" onClick={() => browse('')} style={{ fontSize: '11px' }}>
                    Browse from manga directory
                </button>
            )}
        </div>
    );
};

const AddSeriesModal = ({ onClose, onAdd, onDelete, editManga = null, activeCategory = null }) => {
    const [coverSrc, setCoverSrc] = useState(editManga?.cover ? apiUrl(editManga.cover) : null);
    const [coverFile, setCoverFile] = useState(null);
    const [tags, setTags] = useState(editManga?.tags || []);
    const [categories, setCategories] = useState(editManga?.categories || (activeCategory ? [activeCategory] : []));
    const [tagInput, setTagInput] = useState('');
    const [showBrowser, setShowBrowser] = useState(false);
    const [showVersionBrowser, setShowVersionBrowser] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState(editManga?.sourcePath || '');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [form, setForm] = useState({
        title: editManga?.title || '',
        description: editManga?.description || '',
        authors: editManga?.authors || '',
        artists: editManga?.artists || '',
        language: editManga?.language || 'English',
        status: editManga?.status || 'Ongoing',
        releaseYear: editManga?.releaseYear || '',
        isNsfw: editManga?.isNsfw || false
    });
    const [showVersionForm, setShowVersionForm] = useState(false);
    const [versionForm, setVersionForm] = useState({ id: null, name: '', title: '', description: '', type: 'tl', folderPath: '', authors: '', artists: '' });
    const [versionTags, setVersionTags] = useState([]);
    const [versionTagInput, setVersionTagInput] = useState('');
    const [versionCoverFile, setVersionCoverFile] = useState(null);
    const [versionCoverSrc, setVersionCoverSrc] = useState(null);
    const [pendingVersions, setPendingVersions] = useState([]);
    const fileRef = useRef();
    const versionFileRef = useRef();

    useEffect(() => {
        setSelectedFolder(editManga?.sourcePath || '');
        setCoverSrc(editManga?.cover ? apiUrl(editManga.cover) : null);
    }, [editManga]);

    const handleCover = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setCoverFile(file);
        setCoverSrc(URL.createObjectURL(file));
    };

    const handleVersionCover = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setVersionCoverFile(file);
        setVersionCoverSrc(URL.createObjectURL(file));
    };

    const handleChange = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleTagKey = (e) => {
        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
            e.preventDefault();
            // Strip commas, leading #, and whitespace — store tags clean without #
            const tag = tagInput.trim().replace(/,$/, '').replace(/^#/, '');
            if (tag && !tags.includes(tag)) setTags(p => [...p, tag]);
            setTagInput('');
        } else if (e.key === 'Backspace' && !tagInput && tags.length) {
            setTags(p => p.slice(0, -1));
        }
    };

    const handleVersionTagKey = (e) => {
        if ((e.key === 'Enter' || e.key === ',') && versionTagInput.trim()) {
            e.preventDefault();
            const tag = versionTagInput.trim().replace(/,$/, '').replace(/^#/, '');
            if (tag && !versionTags.includes(tag)) setVersionTags(p => [...p, tag]);
            setVersionTagInput('');
        } else if (e.key === 'Backspace' && !versionTagInput && versionTags.length) {
            setVersionTags(p => p.slice(0, -1));
        }
    };

    const removeTag = (tag) => setTags(p => p.filter(t => t !== tag));
    const removeVersionTag = (tag) => setVersionTags(p => p.filter(t => t !== tag));

    const handleBrowseFolderOs = async (target = 'series') => {
        try {
            let folder = '';
            let tauriAvailable = false;

            // Prefer native Tauri dialog via IPC.
            try {
                const selected = await open({ directory: true, multiple: false });
                tauriAvailable = true; // Tauri dialog opened successfully
                if (typeof selected === 'string') {
                    folder = selected;
                }
                // If selected is null, user cancelled — do NOT fall through to server dialog
            } catch {
                // Tauri not available (web mode) — will fall through to server fallback
            }

            // Fallback: server-side dialog for standalone web mode ONLY when Tauri is not available.
            if (!folder && !tauriAvailable) {
                const res = await fetch(apiUrl('/api/browse-os-folder'));
                const data = await res.json();
                folder = data.folder || '';
            }

            if (folder) {
                if (target === 'version') {
                    setVersionForm(p => ({ ...p, folderPath: folder }));
                } else {
                    setSelectedFolder(folder);
                    if (!form.title) {
                        const folderName = folder.split('\\').pop().split('/').pop();
                        handleChange('title', folderName);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to open OS folder browser:', err);
        }
    };

    const handleSubmit = async () => {
        if (!form.title.trim()) return;

        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        fd.append('tags', JSON.stringify(tags));
        fd.append('categories', JSON.stringify(categories));
        if (coverFile) {
            fd.append('cover', coverFile);
        } else if (coverSrc === null && editManga?.cover) {
            fd.append('deleteCover', 'true'); // Pass a flag to delete cover if backend supports it
        }
        if (editManga) {
            fd.append('folderPath', selectedFolder || '');
        } else if (selectedFolder) {
            fd.append('folderPath', selectedFolder);
        }

        try {
            const url = editManga
                ? apiUrl(`/api/manga/${encodeURIComponent(editManga.id)}`)
                : apiUrl('/api/manga');
            const method = editManga ? 'PUT' : 'POST';

            const res = await fetch(url, { method, body: fd });
            if (!res.ok) {
                let message = 'API failed';
                try {
                    const err = await res.json();
                    message = err.error || message;
                } catch { }
                throw new Error(message);
            }
            const data = await res.json();

            if (pendingVersions.length > 0) {
                for (const v of pendingVersions) {
                    const vFd = new FormData();
                    vFd.append('name', v.name);
                    vFd.append('title', v.title || v.name);
                    vFd.append('description', v.description);
                    vFd.append('type', v.type);
                    vFd.append('folderPath', v.folderPath);
                    vFd.append('authors', v.authors);
                    vFd.append('artists', v.artists);
                    vFd.append('status', v.status || 'Ongoing');
                    vFd.append('tags', JSON.stringify(v.tags));
                    if (v.coverFile) vFd.append('cover', v.coverFile);

                    await fetch(apiUrl(`/api/manga/${encodeURIComponent(data.id || data.meta?.id)}/versions`), { method: 'POST', body: vFd });
                }
            }

            onAdd(data.meta || data);
            onClose();
        } catch (err) {
            const fetchHint = err?.message === 'Failed to fetch'
                ? '\nBackend belum terhubung. Coba restart aplikasi Kodo.'
                : '';
            alert(`Failed to save series: ${err.message}${fetchHint}`);
        }
    };

    const handleDelete = async () => {
        if (!editManga || deleteConfirmText !== 'DELETE') return;
        try {
            const res = await fetch(apiUrl(`/api/manga/${encodeURIComponent(editManga.id)}`), {
                method: 'DELETE',
            });
            if (res.ok) {
                if (onDelete) onDelete();
            } else {
                const err = await res.json();
                alert(`Error deleting manga: ${err.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error(e);
            alert(`Failed to delete manga: ${e.message}`);
        }
    };

    const handleSaveVersion = async () => {
        if (!versionForm.name.trim()) { alert('Version name required'); return; }

        if (!editManga) {
            const newVersion = {
                id: versionForm.id || ('local_' + Date.now()),
                ...versionForm,
                tags: [...versionTags],
                coverFile: versionCoverFile,
                coverSrc: versionCoverSrc
            };
            if (versionForm.id) {
                setPendingVersions(p => p.map(v => v.id === versionForm.id ? newVersion : v));
            } else {
                setPendingVersions(p => [...p, newVersion]);
            }
            setShowVersionForm(false);
            setVersionForm({ id: null, name: '', title: '', description: '', type: 'tl', folderPath: '', authors: '', artists: '', status: 'Ongoing' });
            setVersionTags([]);
            setVersionCoverFile(null);
            setVersionCoverSrc(null);
            return;
        }

        try {
            const isEdit = !!versionForm.id;
            const url = isEdit
                ? apiUrl(`/api/manga/${encodeURIComponent(editManga.id)}/versions/${encodeURIComponent(versionForm.id)}`)
                : apiUrl(`/api/manga/${encodeURIComponent(editManga.id)}/versions`);
            const method = isEdit ? 'PUT' : 'POST';

            const fd = new FormData();
            fd.append('name', versionForm.name);
            fd.append('title', versionForm.title || versionForm.name);
            fd.append('description', versionForm.description);
            fd.append('type', versionForm.type);
            fd.append('folderPath', versionForm.folderPath);
            fd.append('authors', versionForm.authors);
            fd.append('artists', versionForm.artists);
            fd.append('status', versionForm.status || 'Ongoing');
            fd.append('tags', JSON.stringify(versionTags));
            if (versionCoverFile) fd.append('cover', versionCoverFile);

            const res = await fetch(url, { method, body: fd });
            if (!res.ok) {
                const err = await res.json();
                alert(`Error saving version: ${err.error || 'Unknown error'}`);
                return;
            }
            alert(`Version ${isEdit ? 'updated' : 'added'} successfully. Refresh the series to see it.`);
            setShowVersionForm(false);
            setVersionForm({ id: null, name: '', title: '', description: '', type: 'tl', folderPath: '', authors: '', artists: '', status: 'Ongoing' });
            setVersionTags([]);
            setVersionCoverFile(null);
            setVersionCoverSrc(null);
            onAdd(); // trigger refresh
        } catch (e) {
            console.error(e);
            alert(`Failed to save version: ${e.message}`);
        }
    };

    const handleDeleteVersion = async (vId) => {
        if (!editManga) {
            setPendingVersions(p => p.filter(v => v.id !== vId));
            return;
        }
        if (!confirm('Are you sure you want to delete this version? The files will also be deleted if they are not linked.')) return;
        try {
            const res = await fetch(apiUrl(`/api/manga/${encodeURIComponent(editManga.id)}/versions/${encodeURIComponent(vId)}`), {
                method: 'DELETE'
            });
            if (!res.ok) {
                const err = await res.json();
                alert(`Error deleting version: ${err.error || 'Unknown error'}`);
                return;
            }
            alert('Version deleted.');
            onAdd(); // trigger refresh
        } catch (e) {
            console.error(e);
            alert(`Failed to delete version: ${e.message}`);
        }
    };

    const openEditVersion = (v) => {
        setVersionForm({
            id: v.id,
            name: v.name,
            title: v.title || v.name,
            description: v.description || '',
            type: v.type || 'tl',
            folderPath: v.folderPath || '',
            authors: v.authors || '',
            artists: v.artists || '',
            status: v.status || 'Ongoing'
        });
        setVersionTags(v.tags || []);
        setVersionCoverFile(v.coverFile || null);
        setVersionCoverSrc(v.coverSrc || (v.cover ? apiUrl(v.cover) : null));
        setShowVersionForm(true);
    };

    return (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal fade-slide-up">
                <div className="modal-header">
                    <h2 className="modal-title">{editManga ? 'Edit Series' : 'Add Series'}</h2>
                    <button className="modal-close" onClick={onClose}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="modal-body">
                    {/* Left: Cover */}
                    <div className="modal-cover-col">
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCover} />
                        <div className="cover-preview" style={{ position: 'relative' }}>
                            {coverSrc ? (
                                <>
                                    <img src={coverSrc} alt="cover" onClick={() => fileRef.current.click()} />
                                    <button
                                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={(e) => { e.stopPropagation(); setCoverSrc(null); setCoverFile(null); }}
                                        title="Discard Cover"
                                    >✕</button>
                                </>
                            ) : (
                                <div onClick={() => fileRef.current.click()} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                                        <rect x="3" y="3" width="18" height="18" rx="3" />
                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                        <path strokeLinecap="round" d="M21 15l-5-5L5 21" />
                                    </svg>
                                    <span className="cover-preview-label">No Cover<br />Click to Browse</span>
                                </div>
                            )}
                        </div>
                        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }} onClick={() => fileRef.current.click()}>
                            {coverSrc ? 'Change Cover' : 'Browse Image'}
                        </button>
                    </div>

                    {/* Right: Form */}
                    <div className="modal-form-col">
                        <div className="form-group">
                            <label className="form-label">{editManga ? 'Series Source Folder' : 'Manga Folder'}</label>
                            {selectedFolder ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="form-input" style={{ flex: 1, fontSize: '12px', color: editManga ? 'var(--text)' : 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        📁 {selectedFolder}
                                    </div>
                                    {editManga ? (
                                        <button className="btn btn-primary" style={{ fontSize: '11px', padding: '6px 12px', flexShrink: 0 }} onClick={(e) => { e.preventDefault(); handleBrowseFolderOs('series'); }} title="If your folder moved or was lost, select the new location here.">
                                            Migrate Path
                                        </button>
                                    ) : (
                                        <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '6px 10px', flexShrink: 0 }} onClick={() => { setSelectedFolder(''); setShowBrowser(false); }}>
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
                                    onClick={(e) => { e.preventDefault(); handleBrowseFolderOs('series'); }}
                                >
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                    Browse Folder
                                </button>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input className="form-input" placeholder="Series title" value={form.title} onChange={e => handleChange('title', e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-input textarea" placeholder="Synopsis..." value={form.description} onChange={e => handleChange('description', e.target.value)} rows={3} />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Author(s)</label>
                                <input className="form-input" placeholder="e.g. Hajime Isayama" value={form.authors} onChange={e => handleChange('authors', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Artist(s)</label>
                                <input className="form-input" placeholder="e.g. Studio XYZ" value={form.artists} onChange={e => handleChange('artists', e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Tags</label>
                            <div className="tags-input-container" onClick={(e) => e.currentTarget.querySelector('input').focus()}>
                                {tags.map(t => (
                                    <span key={t} className="tag-pill">
                                        #{t}
                                        <button onClick={() => removeTag(t)}>✕</button>
                                    </span>
                                ))}
                                <input
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKey}
                                    placeholder={tags.length ? '' : 'Action, Romance... (Enter to add)'}
                                />
                            </div>
                        </div>

                        <div className="form-row" style={{ alignItems: 'center' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Language</label>
                                <CustomDropdown
                                    items={LANGUAGES.map(l => ({ value: l, label: l }))}
                                    value={form.language}
                                    onChange={(val) => handleChange('language', val)}
                                    direction="up"
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Status</label>
                                <CustomDropdown
                                    items={STATUSES.map(s => ({ value: s, label: s }))}
                                    value={form.status}
                                    onChange={(val) => handleChange('status', val)}
                                    direction="up"
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Release Year</label>
                                <input
                                    className="form-input hide-spin"
                                    type="number"
                                    placeholder="YYYY"
                                    value={form.releaseYear}
                                    onChange={e => handleChange('releaseYear', e.target.value)}
                                    style={{ padding: '8px 12px' }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#e11d48' }}>18+ Content</span>
                                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>This series contains mature content</span>
                            </div>
                            <label className="toggle">
                                <input type="checkbox" checked={form.isNsfw} onChange={(e) => handleChange('isNsfw', e.target.checked)} />
                                <span className="toggle-slider" />
                            </label>
                        </div>

                        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showVersionForm || ((editManga?.versions?.length > 1) || pendingVersions.length > 0) ? '12px' : '0' }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Series Editions</h3>
                                <button
                                    className="btn btn-ghost"
                                    style={{ fontSize: '11px', padding: '6px 12px', border: '1px solid var(--border)' }}
                                    onClick={() => {
                                        if (showVersionForm) {
                                            setShowVersionForm(false);
                                        } else {
                                            setVersionForm({ id: null, name: '', title: '', description: '', type: 'tl', folderPath: '', authors: '', artists: '', status: 'Ongoing' });
                                            setVersionTags([]);
                                            setVersionCoverFile(null);
                                            setVersionCoverSrc(null);
                                            setShowVersionForm(true);
                                        }
                                    }}
                                >
                                    {showVersionForm ? 'Cancel' : '+ Add New Editions'}
                                </button>
                            </div>

                            {(() => {
                                const displayVersions = editManga ? (editManga.versions || []).filter(v => v.id !== 'default') : pendingVersions;
                                return displayVersions.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: showVersionForm ? '16px' : '0' }}>
                                        {displayVersions.map(v => (
                                            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                <div>
                                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{v.name}</span>
                                                    {v.title && v.title !== v.name && <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: 8 }}>({v.title})</span>}
                                                    {v.description && <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginTop: 2 }}>{v.description}</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => openEditVersion(v)}>Edit</button>
                                                    <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 8px', color: '#ff5555' }} onClick={() => handleDeleteVersion(v.id)}>Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}

                            {showVersionForm && (
                                <div style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px dashed var(--border)' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        {versionForm.id ? 'Edit Editions' : 'New Editions'}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Status:</span>
                                            <div style={{ width: 100 }}>
                                                <CustomDropdown
                                                    items={STATUSES.map(s => ({ value: s, label: s }))}
                                                    value={versionForm.status || 'Ongoing'}
                                                    onChange={(val) => setVersionForm(p => ({ ...p, status: val }))}
                                                    direction="down"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Version Cover */}
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        <div style={{ flexShrink: 0 }}>
                                            <input ref={versionFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleVersionCover} />
                                            <div
                                                onClick={() => versionFileRef.current.click()}
                                                style={{
                                                    width: '80px', height: '110px', borderRadius: '8px', cursor: 'pointer',
                                                    border: '1px dashed var(--border)', background: 'var(--input-bg)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    overflow: 'hidden', flexDirection: 'column', gap: 4, position: 'relative'
                                                }}
                                            >
                                                {versionCoverSrc
                                                    ? <>
                                                        <img src={versionCoverSrc} alt="ver cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <button
                                                            style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}
                                                            onClick={(e) => { e.stopPropagation(); setVersionCoverSrc(null); setVersionCoverFile(null); }}
                                                            title="Discard Cover"
                                                        >✕</button>
                                                    </>
                                                    : <>
                                                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--muted)" strokeWidth="1.5">
                                                            <rect x="3" y="3" width="18" height="18" rx="3" />
                                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                                            <path strokeLinecap="round" d="M21 15l-5-5L5 21" />
                                                        </svg>
                                                        <span style={{ fontSize: 9, color: 'var(--muted)' }}>Cover</span>
                                                    </>
                                                }
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '11px' }}>Version Name *</label>
                                                <input className="form-input" placeholder="e.g. Official, Fan TL, Raw..." value={versionForm.name} onChange={e => setVersionForm({ ...versionForm, name: e.target.value })} style={{ fontSize: '12px', padding: '8px 12px' }} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '11px' }}>Display Title</label>
                                                <input className="form-input" placeholder="Title shown in hero (defaults to Editions name)" value={versionForm.title} onChange={e => setVersionForm({ ...versionForm, title: e.target.value })} style={{ fontSize: '12px', padding: '8px 12px' }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '11px' }}>Description</label>
                                        <textarea className="form-input textarea" placeholder="Synopsis for this editions..." value={versionForm.description} onChange={e => setVersionForm({ ...versionForm, description: e.target.value })} rows={2} style={{ fontSize: '12px', padding: '8px 12px' }} />
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '11px' }}>Author(s)</label>
                                            <input className="form-input" placeholder="e.g. Author name" value={versionForm.authors} onChange={e => setVersionForm({ ...versionForm, authors: e.target.value })} style={{ fontSize: '12px', padding: '8px 12px' }} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '11px' }}>Artist(s)</label>
                                            <input className="form-input" placeholder="e.g. Artist name" value={versionForm.artists} onChange={e => setVersionForm({ ...versionForm, artists: e.target.value })} style={{ fontSize: '12px', padding: '8px 12px' }} />
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '11px' }}>Tags</label>
                                        <div className="tags-input-container" onClick={(e) => e.currentTarget.querySelector('input').focus()} style={{ padding: '4px 8px' }}>
                                            {versionTags.map(t => (
                                                <span key={t} className="tag-pill" style={{ fontSize: '10px' }}>
                                                    #{t}
                                                    <button onClick={() => removeVersionTag(t)}>✕</button>
                                                </span>
                                            ))}
                                            <input
                                                value={versionTagInput}
                                                onChange={e => setVersionTagInput(e.target.value)}
                                                onKeyDown={handleVersionTagKey}
                                                placeholder={versionTags.length ? '' : 'Tags (Enter to add)'}
                                                style={{ fontSize: '11px' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '11px' }}>Folder Path</label>
                                        {versionForm.folderPath && !showVersionBrowser ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="form-input" style={{ flex: 1, fontSize: '12px', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '8px 12px' }}>
                                                    📁 {versionForm.folderPath}
                                                </div>
                                                <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '6px 10px', flexShrink: 0 }} onClick={() => { setVersionForm({ ...versionForm, folderPath: '' }); setShowVersionBrowser(false); }}>
                                                    ✕
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn btn-ghost"
                                                style={{ width: '100%', justifyContent: 'center', fontSize: '11px' }}
                                                onClick={(e) => { e.preventDefault(); handleBrowseFolderOs('version'); }}
                                            >
                                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                    <path strokeLinecap="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                </svg>
                                                Browse Editions Folder
                                            </button>
                                        )}
                                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: 4 }}>Leaving this empty will create an empty directory inside the editions folder.</div>
                                    </div>
                                    <button className="btn btn-primary" onClick={handleSaveVersion} style={{ fontSize: '12px', marginTop: '4px' }}>{versionForm.id ? 'Save Changes' : (editManga ? 'Save New Editions' : 'Save New Editions')}</button>
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                <div className="modal-footer">
                    {/* Delete button — left side, edit mode only */}
                    <div>
                        {editManga && !deleteConfirmOpen && (
                            <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => setDeleteConfirmOpen(true)}
                                style={{ color: '#ff5555', border: '1px solid rgba(255,85,85,0.3)', background: 'rgba(255,85,85,0.05)' }}
                            >
                                Delete Series
                            </button>
                        )}
                        {editManga && deleteConfirmOpen && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                    className="form-input"
                                    placeholder='Type "DELETE" to confirm'
                                    value={deleteConfirmText}
                                    onChange={e => setDeleteConfirmText(e.target.value)}
                                    style={{ borderColor: 'rgba(255,85,85,0.4)', background: 'rgba(0,0,0,0.2)', fontSize: 12, padding: '6px 10px', width: 200 }}
                                />
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={handleDelete}
                                    disabled={deleteConfirmText !== 'DELETE'}
                                    style={{ background: '#ff5555', color: '#fff', opacity: deleteConfirmText === 'DELETE' ? 1 : 0.5, border: 'none', padding: '6px 14px' }}
                                >
                                    Confirm
                                </button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 14px' }} onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmText(''); }}>Cancel</button>
                            </div>
                        )}
                    </div>
                    {/* Right side actions */}
                    <div className="modal-footer-actions">
                        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSubmit}>
                            {editManga ? 'Save Changes' : (
                                <>
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Series
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddSeriesModal;
