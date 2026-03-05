import React, { useState } from 'react';

const BackupPasswordModal = ({ isRestore, onClose, onSubmit }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!password) {
            setError('Password is required');
            return;
        }
        if (password.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }
        onSubmit(password);
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100000 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                    <h2>{isRestore ? 'Restore Backup' : 'Create Local Backup'}</h2>
                    <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
                </div>
                <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                        {isRestore
                            ? 'Enter the password used when creating this backup. The backup cannot be decrypted without the correct password.'
                            : 'Enter a strong password to encrypt your backup. You will need this password to restore your data later. Do not lose it!'}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Encryption Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            placeholder="Enter password..."
                            autoFocus
                        />
                        {error && <div style={{ color: '#e11d48', fontSize: '12px', marginTop: '4px' }}>{error}</div>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={!password}>
                            {isRestore ? 'Decrypt & Restore' : 'Encrypt & Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BackupPasswordModal;
