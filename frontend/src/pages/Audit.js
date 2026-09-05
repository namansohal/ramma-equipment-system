import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import * as ui from '../components/ui';

export default function Audit() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isOwner = user.role === 'owner';
    const [logs, setLogs] = useState([]);
    const [filter, setFilter] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => { load(); }, [filter]);

    const load = async () => {
        try {
            const params = filter ? { table: filter } : {};
            const res = await API.get('/audit/', { params });
            setLogs(res.data);
        } catch (e) {
            setError('Failed to load audit log');
        }
    };

    const restore = async (log) => {
        setError('');
        setSuccess('');
        try {
            const res = await API.post(`/audit/restore/${log.table}/${log.record_id}`);
            setSuccess(res.data.message);
            load();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to restore');
        }
    };

    const fmtTime = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleString('en-GB', { timeZone: 'Africa/Accra', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const actionStyle = (action) => {
        if (action === 'DELETE') return styles.badgeDel;
        if (action === 'CREATE') return styles.badgeNew;
        if (action === 'RESTORE') return styles.badgeRestore;
        return styles.badgeEdit;
    };

    const tables = [
        { val: '', label: 'All' },
        { val: 'expenses', label: 'Expenses' },
        { val: 'mainbook_transactions', label: 'Mainbook' },
        { val: 'stock_transactions', label: 'Stock' },
        { val: 'users', label: 'Employees' },
    ];

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>Activity History</div>
                {error && <div style={ui.alertError}>{error}</div>}
                {success && <div style={ui.alertSuccess}>{success}</div>}
                <div style={styles.filterRow}>
                    {tables.map(t => (
                        <button key={t.val} onClick={() => setFilter(t.val)}
                            style={filter === t.val ? styles.filterActive : styles.filterBtn}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <table style={ui.table}>
                    <thead>
                        <tr>
                            <th style={ui.th}>When</th>
                            <th style={ui.th}>Who</th>
                            <th style={ui.th}>Action</th>
                            <th style={ui.th}>Area</th>
                            <th style={ui.th}>Change</th>
                            <th style={ui.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(l => (
                            <tr key={l.audit_id} style={ui.tr}>
                                <td style={ui.td}>{fmtTime(l.changed_at)}</td>
                                <td style={ui.td}>{l.changed_by}</td>
                                <td style={ui.td}><span style={actionStyle(l.action)}>{l.action}</span></td>
                                <td style={ui.td}>{l.table.replace('_transactions', '').replace('_', ' ')}</td>
                                <td style={ui.td}>
                                    {l.field
                                        ? `${l.field}: ${l.old_value ?? '—'} → ${l.new_value ?? '—'}`
                                        : (l.new_value || l.old_value || '')}
                                </td>
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {isOwner && l.action === 'DELETE' &&
                                     ['expenses', 'mainbook_transactions', 'stock_transactions'].includes(l.table) && (
                                        <button onClick={() => restore(l)} style={styles.restoreBtn}>Restore</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr><td colSpan="6" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No activity recorded</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    filterRow: { display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' },
    filterBtn: { padding: '7px 14px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    filterActive: { padding: '7px 14px', backgroundColor: ui.colors.accentSoft, color: ui.colors.accent, border: `0.5px solid ${ui.colors.accent}`, borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    badgeDel: { fontSize: '11px', fontWeight: '600', color: ui.colors.accent, backgroundColor: ui.colors.accentSoft, padding: '2px 8px', borderRadius: '20px' },
    badgeNew: { fontSize: '11px', fontWeight: '600', color: '#15803d', backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: '20px' },
    badgeEdit: { fontSize: '11px', fontWeight: '600', color: '#b45309', backgroundColor: '#fffbeb', padding: '2px 8px', borderRadius: '20px' },
    badgeRestore: { fontSize: '11px', fontWeight: '600', color: '#1e40af', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '20px' },
    restoreBtn: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
};