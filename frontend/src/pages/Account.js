import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import API, { changePassword, changeUsername } from '../services/api';
import { siteChanged } from '../components/useSite';
import * as ui from '../components/ui';

export default function Account() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' });
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');

    const [newUsername, setNewUsername] = useState('');
    const [unLoading, setUnLoading] = useState(false);
    const [unError, setUnError] = useState('');
    const [unSuccess, setUnSuccess] = useState('');

    const handlePwChange = (e) => {
        const { name, value } = e.target;
        setPwForm(f => ({ ...f, [name]: value }));
    };

    const submitPassword = async (e) => {
        e.preventDefault();
        setPwError('');
        setPwSuccess('');
        if (pwForm.new_password !== pwForm.confirm) {
            setPwError('New passwords do not match');
            return;
        }
        setPwLoading(true);
        try {
            const res = await changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password });
            // Old tokens stop working once the password changes; keep this session signed in.
            if (res.data?.access_token) localStorage.setItem('token', res.data.access_token);
            setPwSuccess('Password changed successfully');
            setPwForm({ old_password: '', new_password: '', confirm: '' });
        } catch (err) {
            setPwError(err.response?.data?.detail || 'Failed to change password');
        } finally {
            setPwLoading(false);
        }
    };

    const submitUsername = async (e) => {
        e.preventDefault();
        setUnError('');
        setUnSuccess('');
        setUnLoading(true);
        try {
            const res = await changeUsername({ new_username: newUsername });
            setUnSuccess(res.data.message);
            const updated = { ...user, username: res.data.new_username || newUsername };
            localStorage.setItem('user', JSON.stringify(updated));
            setNewUsername('');
        } catch (err) {
            setUnError(err.response?.data?.detail || 'Failed to change username');
        } finally {
            setUnLoading(false);
        }
    };

    const [sites, setSites] = useState([]);
    const [pickSite, setPickSite] = useState('');
    const [confirmSite, setConfirmSite] = useState(false);
    const [siteMsg, setSiteMsg] = useState('');
    const loadSites = () => API.get('/locations/').then(r => {
        setSites(r.data);
        const cur = r.data.find(l => l.is_current);
        setPickSite(cur ? String(cur.location_id) : '');
    }).catch(() => {});
    useEffect(() => { if (user.role === 'owner') loadSites(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- load once
    const switchSite = async () => {
        setSiteMsg('');
        try {
            const res = await API.post(`/locations/${pickSite}/make-current`);
            setSiteMsg(res.data.message);
            setConfirmSite(false);
            siteChanged();
            loadSites();
        } catch (err) {
            setSiteMsg(err.response?.data?.detail || 'Could not change the site');
        }
    };
    const currentSite = sites.find(l => l.is_current);
    const chosenSite = sites.find(l => String(l.location_id) === pickSite);

    const [backingUp, setBackingUp] = useState(false);
    const [backupMsg, setBackupMsg] = useState('');
    const downloadBackup = async () => {
        setBackingUp(true); setBackupMsg('');
        try {
            const res = await API.get('/backup/export', { responseType: 'blob' });
            const name = (res.headers['content-disposition'] || '').match(/filename=([^;]+)/)?.[1] || 'ramma_backup.zip';
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
            setBackupMsg('Backup downloaded. Keep it somewhere safe — it contains all company records.');
        } catch {
            setBackupMsg('Backup failed. Please try again.');
        } finally {
            setBackingUp(false);
        }
    };

    return (
        <Layout>
            <div style={styles.grid}>
                <div style={{ ...ui.card, marginBottom: 0 }}>
                    <div style={ui.cardTitle}>Account Details</div>
                    <div style={styles.detailRow}><span style={styles.detailLabel}>Name</span><span style={styles.detailValue}>{user.full_name}</span></div>
                    <div style={styles.detailRow}><span style={styles.detailLabel}>Role</span><span style={{ ...styles.detailValue, textTransform: 'capitalize' }}>{user.role}</span></div>
                    {user.employee_code && <div style={styles.detailRow}><span style={styles.detailLabel}>Employee Code</span><span style={styles.detailValue}>{user.employee_code}</span></div>}
                </div>

                <div style={{ ...ui.card, marginBottom: 0 }}>
                    <div style={ui.cardTitle}>Change Username</div>
                    {unError && <div style={ui.alertError}>{unError}</div>}
                    {unSuccess && <div style={ui.alertSuccess}>{unSuccess}</div>}
                    {user.role !== 'owner' && (
                        <div style={styles.note}>You can change your username once every 7 days.</div>
                    )}
                    <form onSubmit={submitUsername}>
                        <div style={ui.field}>
                            <label style={ui.label}>New Username</label>
                            <input style={ui.input} type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required />
                        </div>
                        <button style={unLoading ? ui.btnDisabled : ui.btn} type="submit" disabled={unLoading}>
                            {unLoading ? 'Updating...' : 'Update Username'}
                        </button>
                    </form>
                </div>
            </div>

            <div style={{ ...ui.card, maxWidth: '460px', marginTop: '20px' }}>
                <div style={ui.cardTitle}>Change Password</div>
                {pwError && <div style={ui.alertError}>{pwError}</div>}
                {pwSuccess && <div style={ui.alertSuccess}>{pwSuccess}</div>}
                <form onSubmit={submitPassword}>
                    <div style={ui.field}>
                        <label style={ui.label}>Current Password</label>
                        <input style={ui.input} type="password" name="old_password" value={pwForm.old_password} onChange={handlePwChange} required />
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>New Password</label>
                        <input style={ui.input} type="password" name="new_password" value={pwForm.new_password} onChange={handlePwChange} required />
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>Confirm New Password</label>
                        <input style={ui.input} type="password" name="confirm" value={pwForm.confirm} onChange={handlePwChange} required />
                    </div>
                    <button style={pwLoading ? ui.btnDisabled : ui.btn} type="submit" disabled={pwLoading}>
                        {pwLoading ? 'Changing...' : 'Change Password'}
                    </button>
                </form>
            </div>
            {user.role === 'owner' && sites.length > 0 && (
                <div style={{ ...ui.card, maxWidth: '640px' }}>
                    <div style={ui.cardTitle}>Active site</div>
                    <p style={{ margin: '0 0 14px', fontSize: '14px', color: ui.colors.muted, lineHeight: 1.5 }}>
                        Ledgers, reports and new entries all use the active site — for everyone. Change it when the company moves to another site.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                        <label htmlFor="site-pick" style={{ ...ui.label, marginBottom: 0 }}>Site</label>
                        <select id="site-pick" value={pickSite} onChange={e => { setPickSite(e.target.value); setConfirmSite(false); setSiteMsg(''); }}
                            style={{ ...ui.input, width: 'auto', minWidth: '180px' }}>
                            {sites.map(l => <option key={l.location_id} value={l.location_id}>{l.name}{l.is_current ? ' (active)' : ''}</option>)}
                        </select>
                        {chosenSite && currentSite && chosenSite.location_id !== currentSite.location_id && (confirmSite ? (
                            <>
                                <span style={{ fontSize: '14px' }}>Switch everyone from {currentSite.name} to {chosenSite.name}?</span>
                                <button type="button" style={ui.btn} onClick={switchSite}>Yes, switch</button>
                                <button type="button" style={ui.btnSecondary} onClick={() => setConfirmSite(false)}>Cancel</button>
                            </>
                        ) : (
                            <button type="button" style={ui.btn} onClick={() => setConfirmSite(true)}>Make active</button>
                        ))}
                    </div>
                    {siteMsg && <p style={{ margin: '12px 0 0', fontSize: '14px' }} role="status">{siteMsg}</p>}
                </div>
            )}
            {user.role === 'owner' && (
                <div style={{ ...ui.card, maxWidth: '640px' }}>
                    <div style={ui.cardTitle}>Backup</div>
                    <p style={{ margin: '0 0 14px', fontSize: '14px', color: ui.colors.muted, lineHeight: 1.5 }}>
                        Download every record (ledgers, stock, machines, staff, customers, activity log) as one zip file.
                        Passwords are not included.
                    </p>
                    <button type="button" style={backingUp ? ui.btnDisabled : ui.btn} onClick={downloadBackup} disabled={backingUp}>
                        {backingUp ? 'Preparing backup...' : 'Download full backup'}
                    </button>
                    {backupMsg && <p style={{ margin: '12px 0 0', fontSize: '14px' }} role="status">{backupMsg}</p>}
                </div>
            )}
        </Layout>
    );
}

const styles = {
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
    detailRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `0.5px solid ${ui.colors.border}` },
    detailLabel: { fontSize: '13px', color: ui.colors.muted },
    detailValue: { fontSize: '13px', color: ui.colors.ink, fontWeight: '500' },
    note: { fontSize: '12px', color: ui.colors.muted, marginBottom: '14px' },
};