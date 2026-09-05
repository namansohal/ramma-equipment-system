import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import * as ui from '../components/ui';

export default function Mainbook() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [form, setForm] = useState({
        txn_date: new Date().toISOString().split('T')[0],
        description: '',
        debit: '',
        credit: '',
    });

    useEffect(() => { loadRecords(); }, []);

    const loadRecords = async () => {
        try { const res = await API.get('/mainbook/'); setRecords(res.data); } catch (e) { console.error(e); }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await API.post('/mainbook/', {
                txn_date: form.txn_date,
                description: form.description,
                debit: parseFloat(form.debit || 0),
                credit: parseFloat(form.credit || 0),
            });
            setSuccess('Entry recorded');
            setForm(f => ({ ...f, description: '', debit: '', credit: '' }));
            loadRecords();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setError('');
        setSuccess('');
        try {
            const res = await API.delete(`/mainbook/${id}`);
            setSuccess(res.data.message);
            setConfirmId(null);
            loadRecords();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete');
            setConfirmId(null);
        }
    };

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>New Mainbook Entry</div>
                {error && <div style={ui.alertError}>{error}</div>}
                {success && <div style={ui.alertSuccess}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={ui.field}>
                        <label style={ui.label}>Date</label>
                        <input style={ui.input} type="date" name="txn_date" value={form.txn_date} onChange={handleChange} required />
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>Description</label>
                        <input style={ui.input} type="text" name="description" value={form.description} onChange={handleChange} required />
                    </div>
                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Money Out / Debit (GHS)</label>
                            <input style={ui.input} type="number" name="debit" value={form.debit} onChange={handleChange} min="0" step="0.01" />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Money In / Credit (GHS)</label>
                            <input style={ui.input} type="number" name="credit" value={form.credit} onChange={handleChange} min="0" step="0.01" />
                        </div>
                    </div>
                    <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Entry'}
                    </button>
                </form>
            </div>

            <div style={ui.card}>
                <div style={ui.cardTitle}>Mainbook Ledger</div>
                <table style={ui.table}>
                    <thead>
                        <tr>
                            <th style={ui.th}>Date</th>
                            <th style={ui.th}>Description</th>
                            <th style={ui.th}>Out</th>
                            <th style={ui.th}>In</th>
                            <th style={ui.th}>Balance</th>
                            <th style={ui.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map(r => (
                            <tr key={r.transaction_id} style={ui.tr}>
                                <td style={ui.td}>{r.txn_date}</td>
                                <td style={ui.td}>{r.description}</td>
                                <td style={ui.td}>{r.debit ? parseFloat(r.debit).toLocaleString() : '-'}</td>
                                <td style={ui.td}>{r.credit ? parseFloat(r.credit).toLocaleString() : '-'}</td>
                                <td style={ui.td}>{r.balance ? parseFloat(r.balance).toLocaleString() : '-'}</td>
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {confirmId === r.transaction_id ? (
                                        <span style={styles.confirmWrap}>
                                            <button onClick={() => handleDelete(r.transaction_id)} style={styles.confirmYes}>Delete</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.confirmNo}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(r.transaction_id)} style={styles.delBtn}>Delete</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr><td colSpan="6" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No entries yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    delBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    confirmWrap: { display: 'inline-flex', gap: '6px' },
    confirmYes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    confirmNo: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};