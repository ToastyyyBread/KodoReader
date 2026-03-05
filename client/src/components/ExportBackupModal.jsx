import React, { useState, useEffect, useRef } from 'react';

/**
 * ExportBackupModal
 *
 * Props:
 *   mode          – 'export' | 'restore'
 *   includeFiles  – (export only) whether full-library backup is selected
 *   onClose       – () => void
 *   onSubmit      – (password: string) => void
 */
const ExportBackupModal = ({ mode = 'export', includeFiles = false, onClose, onSubmit }) => {
    const isRestore = mode === 'restore';

    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const passwordRef = useRef(null);

    // Auto-focus password field when encryption is toggled on
    useEffect(() => {
        if (usePassword && passwordRef.current) {
            passwordRef.current.focus();
        }
    }, [usePassword]);

    // Close on Escape
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (usePassword) {
            if (!password) { setError('Please enter a password.'); return; }
            if (!isRestore && password.length < 4) { setError('Password must be at least 4 characters.'); return; }
            if (!isRestore && password !== confirmPassword) { setError('Passwords do not match.'); return; }
        }

        onSubmit(usePassword ? password : '');
    };

    /* ── Derived display ─────────────────────────────────── */
    const title = isRestore ? 'Restore Backup' : 'Export Backup';
    const submitLabel = isRestore ? 'Restore' : (includeFiles ? 'Export Full Backup' : 'Export Backup');
    const toggleLabel = isRestore
        ? 'This backup is password-protected'
        : 'Encrypt with a password';
    const toggleDesc = isRestore
        ? 'Enable if you set a password when creating this backup.'
        : 'Protects your backup with AES-256-GCM encryption.';

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 100000,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
                animation: 'fadeIn 0.12s ease',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 420,
                    background: 'var(--surface)',
                    borderRadius: 20,
                    border: '1px solid var(--border)',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
                    overflow: 'hidden',
                    animation: 'modalPopIn 0.18s cubic-bezier(.34,1.56,.64,1)',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px 16px',
                    borderBottom: '1px solid var(--border)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: isRestore
                                ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))'
                                : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
                            border: `1px solid ${isRestore ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {isRestore ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isRestore ? '#10b981' : '#818cf8'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                </svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
                            {!isRestore && (
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>
                                    {includeFiles ? 'Full library + metadata (.kdba)' : 'Metadata only (.kdba)'}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', color: 'var(--muted)',
                            cursor: 'pointer', padding: 6, borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted)'; }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Encrypt toggle */}
                    <div
                        onClick={() => { setUsePassword(v => !v); setError(''); setPassword(''); setConfirmPassword(''); }}
                        style={{
                            display: 'flex', alignItems: 'flex-start', gap: 14,
                            padding: '14px 16px',
                            borderRadius: 12,
                            border: `1px solid ${usePassword ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
                            background: usePassword ? 'rgba(99,102,241,0.06)' : 'var(--surface2)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        {/* Custom checkbox */}
                        <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                            border: `2px solid ${usePassword ? '#818cf8' : 'var(--border)'}`,
                            background: usePassword ? '#818cf8' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}>
                            {usePassword && (
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{toggleLabel}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{toggleDesc}</div>
                        </div>
                    </div>

                    {/* Password inputs – only shown when toggled on */}
                    {usePassword && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeSlideUp 0.18s ease' }}>
                            {/* Password field */}
                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                                    {isRestore ? 'Decryption Password' : 'Password'}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        ref={passwordRef}
                                        type={showPw ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setError(''); }}
                                        placeholder={isRestore ? 'Enter the backup password...' : 'Enter a strong password...'}
                                        style={{
                                            width: '100%', padding: '10px 40px 10px 14px',
                                            borderRadius: 10, border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                                            background: 'var(--input-bg)', color: 'var(--text)',
                                            fontSize: 13, outline: 'none', fontFamily: 'inherit',
                                            transition: 'border-color 0.15s',
                                        }}
                                        onFocus={e => { if (!error) e.target.style.borderColor = '#818cf8'; }}
                                        onBlur={e => { if (!error) e.target.style.borderColor = 'var(--border)'; }}
                                    />
                                    {/* Show/hide toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(v => !v)}
                                        style={{
                                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', color: 'var(--muted)',
                                            cursor: 'pointer', padding: 4, display: 'flex',
                                        }}
                                    >
                                        {showPw ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm password – only for export */}
                            {!isRestore && (
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                                        Confirm Password
                                    </label>
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                                        placeholder="Re-enter password..."
                                        style={{
                                            width: '100%', padding: '10px 14px',
                                            borderRadius: 10, border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                                            background: 'var(--input-bg)', color: 'var(--text)',
                                            fontSize: 13, outline: 'none', fontFamily: 'inherit',
                                            transition: 'border-color 0.15s',
                                        }}
                                        onFocus={e => { if (!error) e.target.style.borderColor = '#818cf8'; }}
                                        onBlur={e => { if (!error) e.target.style.borderColor = 'var(--border)'; }}
                                    />
                                </div>
                            )}

                            {/* Warning */}
                            {!isRestore && (
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 8,
                                    padding: '10px 12px', borderRadius: 8,
                                    background: 'rgba(245,158,11,0.08)',
                                    border: '1px solid rgba(245,158,11,0.2)',
                                }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                    </svg>
                                    <span style={{ fontSize: 11.5, color: '#f59e0b', lineHeight: 1.5 }}>
                                        Do not lose your password. Encrypted backups <strong>cannot be recovered</strong> without it.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 12px', borderRadius: 8,
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: '#ef4444', fontSize: 12, fontWeight: 500,
                        }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '9px 18px', borderRadius: 10,
                                background: 'var(--surface2)', border: '1px solid var(--border)',
                                color: 'var(--text)', fontWeight: 600, fontSize: 13,
                                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface2)'}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                padding: '9px 20px', borderRadius: 10,
                                background: isRestore
                                    ? 'linear-gradient(135deg, #10b981, #059669)'
                                    : 'linear-gradient(135deg, #6366f1, #818cf8)',
                                border: 'none', color: '#fff',
                                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 7,
                                boxShadow: isRestore ? '0 4px 14px rgba(16,185,129,0.3)' : '0 4px 14px rgba(99,102,241,0.3)',
                                transition: 'all 0.15s', fontFamily: 'inherit',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            {isRestore ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                </svg>
                            ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                                </svg>
                            )}
                            {submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExportBackupModal;
