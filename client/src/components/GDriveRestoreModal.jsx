import React, { useState, useEffect } from 'react';
import { apiUrl } from '../runtime';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const GDriveRestoreModal = ({ onClose, onRestore }) => {
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedFileId, setSelectedFileId] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        const fetchBackups = async () => {
            try {
                const res = await fetch(apiUrl('/api/backup/gdrive/list'));
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to fetch backups');
                setBackups(data.files || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchBackups();
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedFileId) {
            setError('Please select a backup to restore');
            return;
        }
        if (!password) {
            setError('Encryption password is required');
            return;
        }
        onRestore(selectedFileId, password);
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100000 }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2>Restore from Google Drive</h2>
                    <button className="btn btn-ghost" onClick={onClose} style={{ padding: '4px 8px' }}>✕</button>
                </div>
                <form onSubmit={handleSubmit} style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                            Loading backups from Google Drive...
                        </div>
                    ) : (
                        <>
                            <div className="form-group">
                                <label className="form-label">Select Backup File</label>
                                {backups.length === 0 ? (
                                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '13px', color: 'var(--muted)' }}>
                                        No backups found in Google Drive.
                                    </div>
                                ) : (
                                    <select
                                        className="form-input"
                                        value={selectedFileId}
                                        onChange={e => setSelectedFileId(e.target.value)}
                                        style={{ WebkitAppearance: 'auto', appearance: 'auto' }}
                                    >
                                        <option value="" disabled>-- Select a backup --</option>
                                        {backups.map(file => (
                                            <option key={file.id} value={file.id}>
                                                {new Date(file.createdTime).toLocaleString()} - {formatBytes(file.size)}
                                            </option>
                                        ))}
                                    </select>
                                )}
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
                                    placeholder="Enter decryption password..."
                                    disabled={backups.length === 0}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                                    Required to decrypt the backup file.
                                </div>
                            </div>

                            {error && <div style={{ color: '#e11d48', fontSize: '13px', marginTop: '4px', fontWeight: '500' }}>{error}</div>}
                        </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading || backups.length === 0 || !selectedFileId || !password}>
                            Start Restore
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GDriveRestoreModal;
