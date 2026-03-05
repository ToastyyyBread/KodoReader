import React, { useState } from 'react';

const BackupPasswordModal = ({ isRestore, onClose, onSubmit }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
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

                    <div style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.5', padding: '16px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '4px' }}>
                        {isRestore
                            ? 'Enter the password used when creating this backup. If you created it without a password, leave this blank.'
                            : 'Set an optional encryption password to secure your backup. If you choose to set one, do not lose it!'}
                    </div>

                    <div className="form-group">
                        <label className="form-label">{isRestore ? 'Decryption Password' : 'Encryption Password'} (Optional)</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError('');
                            }}
                            placeholder="Leave empty for no password"
                            autoFocus
                        />
                        {error && <div style={{ color: '#e11d48', fontSize: '12px', marginTop: '4px' }}>{error}</div>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">
                            {isRestore ? 'Decrypt & Restore' : 'Encrypt & Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BackupPasswordModal;
