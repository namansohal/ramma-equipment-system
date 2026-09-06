import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getAlerts, markAlertRead, deleteAlert, currentUser, isAdmin } from '../services/api';
import * as ui from '../components/ui';

export default function Alerts() {
    const user = currentUser();
    const admin = isAdmin();
    const [alerts, setAlerts] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const res = await getAlerts();
            setAlerts(res.data);
        } catch (e) { console.error(e); }
    };

    const handleRead = async (id) => {
        try {
            await markAlertRead(id);
            load();
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await deleteAlert(id);
            setSuccess(res.data.message);
            setConfirmId(null);
            load();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete');
            setConfirmId(null);
        }
    };

    const fmtTime = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Accra', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>Alerts</div>
                {error && <div style={ui.alertError}>{error}</div>}
                {success && <div style={ui.alertSuccess}>{success}</div>}
                <div style={styles.list}>
                    {alerts.map(a => (
                        <div key={a.alert_id} style={a.is_read ? styles.itemRead : styles.item}>
                            <div style={styles.itemMain}>
                                <div style={styles.itemMessage}>{a.message}</div>
                                <div style={styles.itemMeta}>{fmtTime(a.created_at)}</div>
                            </div>
                            <div style={styles.itemActions}>
                                {!a.is_read && (
                                    <button onClick={() => handleRead(a.alert_id)} style={styles.readBtn}>Mark read</button>
                                )}
                                {admin && (
                                    confirmId === a.alert_id ? (
                                        <span style={styles.wrap}>
                                            <button onClick={() => handleDelete(a.alert_id)} style={styles.yes}>Delete</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(a.alert_id)} style={styles.delBtn}>Delete</button>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                    {alerts.length === 0 && (
                        <div style={styles.empty}>No alerts</div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

const styles = {
    list: { display: 'flex', flexDirection: 'column', gap: '2px' },
    item: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px', borderRadius: '8px', backgroundColor: ui.colors.accentSoft, border: `0.5px solid #f0c0c0` },
    itemRead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px', borderRadius: '8px', backgroundColor: '#fff', border: `0.5px solid ${ui.colors.border}` },
    itemMain: { flex: 1 },
    itemMessage: { fontSize: '13px', color: ui.colors.ink, marginBottom: '4px' },
    itemMeta: { fontSize: '11px', color: ui.colors.muted },
    itemActions: { display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' },
    readBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.ink, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    delBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    wrap: { display: 'inline-flex', gap: '6px' },
    yes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    no: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    empty: { textAlign: 'center', color: ui.colors.muted, padding: '24px', fontSize: '13px' },
};