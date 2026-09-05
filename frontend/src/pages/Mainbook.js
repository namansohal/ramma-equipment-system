import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import * as ui from '../components/ui';

export default function Mainbook() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState({
        txn_date: new Date().toISOString().split('T')[0],
        description: '',
        debit: '',
        credit: '',
    });

    useEffect(() => {
        loadRecords();
    }, []);

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
            setSuccess('Transaction recorded');
            setForm(f => ({ ...f, description: '', debit: '', credit: '' }));
            loadRecords();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save transaction');
        } finally {
            setLoading(false);
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
                            <label style={ui.label}>Debit (GHS)</label>
                            <input style={ui.input} type="number" name="debit" value={form.debit} onChange={handleChange} min="0" step="0.01" />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Credit (GHS)</label>
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
                            <th style={ui.th}>Debit</th>
                            <th style={ui.th}>Credit</th>
                            <th style={ui.th}>Balance</th>
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
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr><td colSpan="5" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No entries yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}