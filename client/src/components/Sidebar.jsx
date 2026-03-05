import React, { useState, useEffect } from 'react';
import kodoLogo from '../assets/Kōdo-01.svg';

const Sidebar = ({ view, activeCategory, onNavigate, onSelectCategory, onAddSeries, onOpenSettings, libraryOpen, onToggleLibrary, collapsed, onToggleCollapse }) => {
    const [categories, setCategories] = useState([]);
    const [showCatPrompt, setShowCatPrompt] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [contextMenu, setContextMenu] = useState(null);
    const [editCatName, setEditCatName] = useState(null);
    const [deleteCatName, setDeleteCatName] = useState(null);

    useEffect(() => {
        fetch('/api/categories')
            .then(res => res.json())
            .then(cats => setCategories(cats))
            .catch(err => console.error('Failed to load categories', err));

        const closeCtx = () => setContextMenu(null);
        window.addEventListener('click', closeCtx);
        return () => window.removeEventListener('click', closeCtx);
    }, []);

    const handleAddCategory = () => {
        if (!newCatName.trim()) return;
        if (editCatName) {
            fetch(`/api/categories/${encodeURIComponent(editCatName)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newName: newCatName.trim() })
            }).then(r => r.json()).then(cats => {
                setCategories(cats);
                setShowCatPrompt(false);
                setNewCatName('');
                setEditCatName(null);
            });
        } else {
            fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCatName.trim() })
            }).then(r => r.json()).then(cats => {
                setCategories(cats);
                setShowCatPrompt(false);
                setNewCatName('');
            });
        }
    };

    const handleDeleteCategory = (catName, e) => {
        if (e) e.stopPropagation();
        setDeleteCatName(catName);
    };

    const confirmDeleteCategory = () => {
        if (!deleteCatName) return;
        fetch(`/api/categories/${encodeURIComponent(deleteCatName)}`, {
            method: 'DELETE'
        }).then(r => r.json()).then(cats => {
            setCategories(cats);
            if (activeCategory === deleteCatName) onNavigate('library');
            setDeleteCatName(null);
        });
    };

    return (
        <>
            <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
                {/* Logo */}
                <div className="sidebar-logo" style={{ justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '24px 0 16px' : '24px 16px 16px 20px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', ... (collapsed ? { opacity: 0, width: 0, overflow: 'hidden' } : { transition: 'opacity 0.2s' }) }}>
                        <img src={kodoLogo} alt="Kōdo" style={{ height: 28, width: 'auto' }} />
                    </div>
                    <button
                        onClick={onToggleCollapse}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 6, borderRadius: 8, flexShrink: 0,
                            border: '1px solid transparent', background: 'transparent',
                            color: 'var(--muted)', cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                            <path d="M11 19l-7-7 7-7" /><path d="M18 19l-7-7 7-7" />
                        </svg>
                    </button>
                </div>

                {/* Library section */}
                <div className="sidebar-section">
                    {!collapsed && <div className="sidebar-section-label">Navigate</div>}

                    {/* Library toggle */}
                    <button
                        className={`sidebar-item ${(view === 'library' || view === 'detail') ? 'active' : ''}`}
                        onClick={collapsed ? () => onNavigate('library') : onToggleLibrary}
                        style={!collapsed ? { justifyContent: 'space-between' } : {}}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : '10px' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M8.67239 7.54199H15.3276C18.7024 7.54199 20.3898 7.54199 21.3377 8.52882C22.2855 9.51565 22.0625 11.0403 21.6165 14.0895L21.1935 16.9811C20.8437 19.3723 20.6689 20.5679 19.7717 21.2839C18.8745 21.9999 17.5512 21.9999 14.9046 21.9999H9.09536C6.44881 21.9999 5.12553 21.9999 4.22834 21.2839C3.33115 20.5679 3.15626 19.3723 2.80648 16.9811L2.38351 14.0895C1.93748 11.0403 1.71447 9.51565 2.66232 8.52882C3.61017 7.54199 5.29758 7.54199 8.67239 7.54199ZM8 18.0001C8 17.5859 8.3731 17.2501 8.83333 17.2501H15.1667C15.6269 17.2501 16 17.5859 16 18.0001C16 18.4143 15.6269 18.7501 15.1667 18.7501H8.83333C8.3731 18.7501 8 18.4143 8 18.0001Z" fill="currentColor"></path> <g opacity="0.4"> <path d="M8.51005 2.00001H15.4901C15.7226 1.99995 15.9009 1.99991 16.0567 2.01515C17.1645 2.12352 18.0712 2.78958 18.4558 3.68678H5.54443C5.92895 2.78958 6.8357 2.12352 7.94352 2.01515C8.09933 1.99991 8.27757 1.99995 8.51005 2.00001Z" fill="currentColor"></path> </g> <g opacity="0.7"> <path d="M6.31069 4.72266C4.92007 4.72266 3.7798 5.56241 3.39927 6.67645C3.39134 6.69967 3.38374 6.72302 3.37646 6.74647C3.77461 6.6259 4.18898 6.54713 4.60845 6.49336C5.68882 6.35485 7.05416 6.35492 8.64019 6.35501L8.75863 6.35501L15.5323 6.35501C17.1183 6.35492 18.4837 6.35485 19.564 6.49336C19.9835 6.54713 20.3979 6.6259 20.796 6.74647C20.7887 6.72302 20.7811 6.69967 20.7732 6.67645C20.3927 5.56241 19.2524 4.72266 17.8618 4.72266H6.31069Z" fill="currentColor"></path> </g> </g></svg>
                            <span className="sidebar-text">Library</span>
                        </span>
                        {!collapsed && <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                            style={{ transform: libraryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>}
                    </button>

                    {/* Library Dropdown */}
                    <div className="sidebar-dropdown" style={{
                        maxHeight: (libraryOpen && !collapsed) ? (120 + categories.length * 30) + 'px' : '0',
                        opacity: (libraryOpen && !collapsed) ? 1 : 0,
                        transition: collapsed ? 'none' : 'max-height 0.25s ease, opacity 0.2s ease'
                    }}>
                        <button
                            className={`sidebar-dropdown-item ${view === 'library' && !activeCategory ? 'active' : ''}`}
                            onClick={() => onNavigate('library')}
                        >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            All Series
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`sidebar-dropdown-item ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => onSelectCategory(cat)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ catName: cat, x: e.clientX, y: e.clientY });
                                }}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{cat}</span>
                                </span>
                            </button>
                        ))}
                        <button
                            className="sidebar-dropdown-item"
                            onClick={() => { setShowCatPrompt(true); setEditCatName(null); setNewCatName(''); }}
                        >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                            </svg>
                            New Category
                        </button>
                    </div>

                    {/* Bookmarks */}
                    <button
                        className={`sidebar-item ${view === 'bookmarks' ? 'active' : ''}`}
                        onClick={() => onNavigate('bookmarks')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-bookmark" viewBox="0 0 16 16">
                            <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v13.5a.5.5 0 0 1-.777.416L8 13.101l-5.223 2.815A.5.5 0 0 1 2 15.5zm2-1a1 1 0 0 0-1 1v12.566l4.723-2.482a.5.5 0 0 1 .554 0L13 14.566V2a1 1 0 0 0-1-1z" />
                        </svg>
                        <span className="sidebar-text">Bookmarks</span>
                    </button>

                </div>

                <div className="sidebar-divider" />

                {/* Add Series */}
                <button className="sidebar-add-btn" onClick={onAddSeries}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="sidebar-text">Add Series</span>
                </button>

                <div className="sidebar-divider" />

                <div className="sidebar-section">
                    {!collapsed && <div className="sidebar-section-label">Tools</div>}

                    {/* Upscaler */}
                    <button
                        className={`sidebar-item ${view === 'upscaler' ? 'active' : ''}`}
                        onClick={() => onNavigate('upscaler')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-lightning-fill" viewBox="0 0 16 16">
                            <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641z" />
                        </svg>
                        <span className="sidebar-text">AI Upscaling</span>
                    </button>

                    {/* Compressor */}
                    <button
                        className={`sidebar-item ${view === 'compressor' ? 'active' : ''}`}
                        onClick={() => onNavigate('compressor')}
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M9 4V9H4M15 4V9H20M4 15H9V20M15 20V15H20" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"></path> </g></svg>
                        <span className="sidebar-text">Series Compressor</span>
                    </button>

                    {/* Renamer */}
                    <button
                        className={`sidebar-item ${view === 'renamer' ? 'active' : ''}`}
                        onClick={() => onNavigate('renamer')}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span className="sidebar-text">Chapter Renamer</span>
                    </button>

                    {/* OCR Translate */}
                    <button
                        className="sidebar-item"
                        style={{ opacity: 0.5, cursor: 'not-allowed' }}
                        onClick={(e) => e.preventDefault()}
                        title="Coming soon..."
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-translate" viewBox="0 0 16 16">
                            <path d="M4.545 6.714 4.11 8H3l1.862-5h1.284L8 8H6.833l-.435-1.286zm1.634-.736L5.5 3.956h-.049l-.679 2.022z" />
                            <path d="M0 2a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v3h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zm7.138 9.995q.289.451.63.846c-.748.575-1.673 1.001-2.768 1.292.178.217.451.635.555.867 1.125-.359 2.08-.844 2.886-1.494.777.665 1.739 1.165 2.93 1.472.133-.254.414-.673.629-.89-1.125-.253-2.057-.694-2.82-1.284.681-.747 1.222-1.651 1.621-2.757H14V8h-3v1.047h.765c-.318.844-.74 1.546-1.272 2.13a6 6 0 0 1-.415-.492 2 2 0 0 1-.94.31" />
                        </svg>
                        {!collapsed && (
                            <>
                                <span className="sidebar-text" style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden' }}>OCR Translate</span>
                                <span className="sidebar-text" style={{
                                    marginLeft: 'auto', fontSize: 10, fontWeight: 800,
                                    padding: '2px 6px', background: 'var(--surface2)',
                                    borderRadius: 4, letterSpacing: 0.5, color: 'var(--muted)'
                                }}>SOON</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="sidebar-divider" />

                {/* Settings */}
                <div className="sidebar-section">
                    {!collapsed && <div className="sidebar-section-label">System</div>}
                    <button
                        className="sidebar-item"
                        onClick={() => onOpenSettings()}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="sidebar-text">Settings</span>
                    </button>
                </div>

                {/* Footer */}
                <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 10, ... (collapsed ? { opacity: 0, pointerEvents: 'none' } : {}) }}>

                    <button
                        onClick={() => onOpenSettings('support')}
                        className="sidebar-text"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 12.5, color: '#f43f5e',
                            background: 'rgba(244, 63, 94, 0.05)',
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: '1px solid rgba(244, 63, 94, 0.1)',
                            textDecoration: 'none', transition: 'all 0.2s',
                            marginTop: 0, overflow: 'hidden',
                            cursor: 'pointer',
                            justifyContent: 'center',
                            width: 'fit-content'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(244, 63, 112, 0.2)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(244, 63, 94, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        <span style={{ fontWeight: 800 }}>Support Project</span>
                    </button>
                </div>

            </aside>

            {showCatPrompt && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => { setShowCatPrompt(false); setEditCatName(null); setNewCatName(''); }}>
                    <div style={{
                        width: '400px', maxWidth: '94vw',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)', borderRadius: 16,
                        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                        animation: 'modalPopIn 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editCatName ? 'Edit Category' : 'New Category'}</h2>
                            <button
                                onClick={() => { setShowCatPrompt(false); setEditCatName(null); setNewCatName(''); }}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6 }}
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <input
                                autoFocus
                                value={newCatName}
                                onChange={e => setNewCatName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleAddCategory();
                                    if (e.key === 'Escape') { setShowCatPrompt(false); setEditCatName(null); setNewCatName(''); }
                                }}
                                placeholder="Category name"
                                className="form-input"
                                style={{ width: '100%', marginBottom: 20, padding: '10px 14px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button
                                    onClick={() => { setShowCatPrompt(false); setEditCatName(null); setNewCatName(''); }}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8, background: 'transparent',
                                        border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >Cancel</button>
                                <button
                                    onClick={handleAddCategory}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8,
                                        background: 'var(--accent)', border: 'none',
                                        color: 'var(--bg)', fontSize: 13, fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >{editCatName ? 'Save Category' : 'Add Category'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {contextMenu && (
                <div style={{
                    position: 'fixed',
                    left: contextMenu.x,
                    top: contextMenu.y,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 4,
                    minWidth: 150
                }} onClick={e => e.stopPropagation()}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditCatName(contextMenu.catName);
                            setNewCatName(contextMenu.catName);
                            setShowCatPrompt(true);
                            setContextMenu(null);
                        }}
                        style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', borderRadius: 4, fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                        Edit Category
                    </button>
                    <button
                        onClick={(e) => {
                            handleDeleteCategory(contextMenu.catName, e);
                            setContextMenu(null);
                        }}
                        style={{ padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: 4, fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                        Delete Category
                    </button>
                </div>
            )}

            {deleteCatName && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setDeleteCatName(null)}>
                    <div style={{
                        width: '400px', maxWidth: '94vw',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)', borderRadius: 16,
                        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                        animation: 'modalPopIn 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ef4444' }}>Delete Category</h2>
                            <button
                                onClick={() => setDeleteCatName(null)}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6 }}
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                                Are you sure you want to delete the category <strong style={{ color: 'var(--text)' }}>"{deleteCatName}"</strong>? This will remove the category from all associated series.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button
                                    onClick={() => setDeleteCatName(null)}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8, background: 'transparent',
                                        border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >Cancel</button>
                                <button
                                    onClick={confirmDeleteCategory}
                                    style={{
                                        padding: '8px 16px', borderRadius: 8,
                                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                        color: '#ef4444', fontSize: 13, fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
