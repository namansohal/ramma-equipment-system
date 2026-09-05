import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getMainbook, createMainbook, deleteMainbook, isViewer } from '../services/api';
import * as ui from '../components/ui';

export default function Mainbook() {
    const viewer = isViewer();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [filterDate, setFilterDate] = useState('');
    const [form, setForm] = useState({
        txn_date: new Date().toISOString().split('T')[0],
        description: '',
        direction: 'in',        // 'in' = money in, 'out' = money out
        amount: '',
        destination: 'expense',
    });

    useEffect(() => { loadRecords(); }, [filterDate]);

    const loadRecords = async () => {
        try {
            const params = filterDate ? { on_date: filterDate } : {};
            const res = await getMainbook(params);
            setRecords(res.data);
        } catch (e) { console.error(e); }
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
            const payload = {
                txn_date: form.txn_date,
                description: form.description,
                debit: form.direction === 'out' ? parseFloat(form.amount || 0) : 0,
                credit: form.direction === 'in' ? parseFloat(form.amount || 0) : 0,
                destination: form.direction === 'out' ? form.destination : null,
            };
            await createMainbook(payload);
            setSuccess('Entry recorded');
            setForm(f => ({ ...f, description: '', amount: '' }));
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
            const res = await deleteMainbook(id);
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
            {!viewer && (
                <div style={ui.card}>
                    <div style={ui.cardTitle}>New Mainbook Entry</div>
                    {error && <div style={ui.alertError}>{error}</div>}
                    {success && <div style={ui.alertSuccess}>{success}</div>}
                    <form onSubmit={handleSubmit}>
                        <div style={ui.row2}>
                            <div style={ui.field}>
                                <label style={ui.label}>Date</label>
                                <input style={ui.input} type="date" name="txn_date" value={form.txn_date} onChange={handleChange} required />
                            </div>
                            <div style={ui.field}>
                                <label style={ui.label}>Direction</label>
                                <select style={ui.input} name="direction" value={form.direction} onChange={handleChange}>
                                    <option value="in">Money In</option>
                                    <option value="out">Money Out</option>
                                </select>
                            </div>
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Description</label>
                            <input style={ui.input} type="text" name="description" value={form.description} onChange={handleChange} required />
                        </div>
                        <div style={ui.row2}>
                            <div style={ui.field}>
                                <label style={ui.label}>Amount (GHS)</label>
                                <input style={ui.input} type="number" name="amount" value={form.amount} onChange={handleChange} min="0" step="0.01" required />
                            </div>
                            {form.direction === 'out' && (
                                <div style={ui.field}>
                                    <label style={ui.label}>Where is it going?</label>
                                    <select style={ui.input} name="destination" value={form.destination} onChange={handleChange}>
                                        <option value="expense">Expense Book</option>
                                        <option value="refund">Refund to Customer</option>
                                        <option value="momo">MOMO</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        {form.direction === 'out' && form.destination === 'expense' && (
                            <div style={styles.hint}>This will also appear as money-in in the Expense book.</div>
                        )}
                        <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Entry'}
                        </button>
                    </form>
                </div>
            )}

            <div style={ui.card}>
                <div style={styles.headRow}>
                    <div style={ui.cardTitle}>Mainbook Ledger</div>
                    <div style={styles.filterWrap}>
                        <label style={styles.filterLabel}>Show date:</label>
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={styles.filterInput} />
                        {filterDate && <button onClick={() => setFilterDate('')} style={styles.clearBtn}>All</button>}
                    </div>
                </div>
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
                                    {!viewer && (confirmId === r.transaction_id ? (
                                        <span style={styles.wrap}>
                                            <button onClick={() => handleDelete(r.transaction_id)} style={styles.yes}>Delete</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(r.transaction_id)} style={styles.del}>Delete</button>
                                    ))}
                                </td>
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr><td colSpan="6" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No entries{filterDate ? ' for this date' : ''}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    hint: { fontSize: '12px', color: ui.colors.muted, marginBottom: '14px', marginTop: '-6px' },
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    filterWrap: { display: 'flex', alignItems: 'center', gap: '8px' },
    filterLabel: { fontSize: '12px', color: ui.colors.muted },
    filterInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px' },
    clearBtn: { padding: '6px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    del: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    wrap: { display: 'inline-flex', gap: '6px' },
    yes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    no: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};