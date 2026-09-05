import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getParts, getCurrentStock, getStockHistory, createStockTxn, deleteStockTxn, getMachines } from '../services/api';
import * as ui from '../components/ui';

export default function Stock() {
    const [parts, setParts] = useState([]);
    const [machines, setMachines] = useState([]);
    const [stock, setStock] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [form, setForm] = useState({
        part_id: '',
        txn_date: new Date().toISOString().split('T')[0],
        direction: 'OUT',
        quantity: '',
        unit_price: '',
        machine_id: '',
        notes: '',
    });

    useEffect(() => {
        loadParts();
        loadMachines();
        loadStock();
        loadHistory();
    }, []);

    const loadParts = async () => {
        try { const res = await getParts(); setParts(res.data); } catch (e) { console.error(e); }
    };
    const loadMachines = async () => {
        try { const res = await getMachines(); setMachines(res.data); } catch (e) { console.error(e); }
    };
    const loadStock = async () => {
        try { const res = await getCurrentStock(); setStock(res.data); } catch (e) { console.error(e); }
    };
    const loadHistory = async () => {
        try { const res = await getStockHistory(); setHistory(res.data); } catch (e) { console.error(e); }
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
                part_id: parseInt(form.part_id),
                txn_date: form.txn_date,
                direction: form.direction,
                quantity: parseFloat(form.quantity),
                unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
                total_amount: form.unit_price ? parseFloat(form.unit_price) * parseFloat(form.quantity) : null,
                machine_id: form.direction === 'OUT' && form.machine_id ? parseInt(form.machine_id) : null,
                notes: form.notes || null,
            };
            await createStockTxn(payload);
            setSuccess(form.direction === 'IN' ? 'Stock received' : 'Part issued');
            setForm(f => ({ ...f, part_id: '', quantity: '', unit_price: '', machine_id: '', notes: '' }));
            loadStock();
            loadHistory();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save transaction');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setError('');
        setSuccess('');
        try {
            const res = await deleteStockTxn(id);
            setSuccess(res.data.message);
            setConfirmId(null);
            loadStock();
            loadHistory();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete');
            setConfirmId(null);
        }
    };

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>Stock Transaction</div>
                {error && <div style={ui.alertError}>{error}</div>}
                {success && <div style={ui.alertSuccess}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Direction</label>
                            <select style={ui.input} name="direction" value={form.direction} onChange={handleChange} required>
                                <option value="OUT">OUT — Issue to machine</option>
                                <option value="IN">IN — Receive stock</option>
                            </select>
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Date</label>
                            <input style={ui.input} type="date" name="txn_date" value={form.txn_date} onChange={handleChange} required />
                        </div>
                    </div>

                    <div style={ui.field}>
                        <label style={ui.label}>Part</label>
                        <select style={ui.input} name="part_id" value={form.part_id} onChange={handleChange} required>
                            <option value="">Select part</option>
                            {parts.map(p => <option key={p.part_id} value={p.part_id}>{p.name}</option>)}
                        </select>
                    </div>

                    {form.direction === 'OUT' && (
                        <div style={ui.field}>
                            <label style={ui.label}>Issue to machine</label>
                            <select style={ui.input} name="machine_id" value={form.machine_id} onChange={handleChange} required>
                                <option value="">Select machine</option>
                                {machines.map(m => <option key={m.machine_id} value={m.machine_id}>{m.code}</option>)}
                            </select>
                        </div>
                    )}

                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Quantity</label>
                            <input style={ui.input} type="number" name="quantity" value={form.quantity} onChange={handleChange} min="0" step="0.01" required />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Unit Price (GHS)</label>
                            <input style={ui.input} type="number" name="unit_price" value={form.unit_price} onChange={handleChange} min="0" step="0.01" />
                        </div>
                    </div>

                    <div style={ui.field}>
                        <label style={ui.label}>Notes (optional)</label>
                        <input style={ui.input} type="text" name="notes" value={form.notes} onChange={handleChange} />
                    </div>

                    <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                        {loading ? 'Saving...' : (form.direction === 'IN' ? 'Receive Stock' : 'Issue Part')}
                    </button>
                </form>
            </div>

            <div style={ui.card}>
                <div style={ui.cardTitle}>Current Stock</div>
                <table style={ui.table}>
                    <thead>
                        <tr><th style={ui.th}>Part</th><th style={ui.th}>Available</th></tr>
                    </thead>
                    <tbody>
                        {stock.map(s => {
                            const qty = parseFloat(s.available);
                            const low = qty <= 5;
                            return (
                                <tr key={s.part_id} style={ui.tr}>
                                    <td style={ui.td}>{s.name}</td>
                                    <td style={ui.td}>
                                        <span style={low ? styles.lowBadge : styles.okText}>{qty.toLocaleString()}</span>
                                    </td>
                                </tr>
                            );
                        })}
                        {stock.length === 0 && (
                            <tr><td colSpan="2" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No stock recorded yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div style={ui.card}>
                <div style={ui.cardTitle}>Recent Transactions</div>
                <table style={ui.table}>
                    <thead>
                        <tr>
                            <th style={ui.th}>Date</th>
                            <th style={ui.th}>Part</th>
                            <th style={ui.th}>Direction</th>
                            <th style={ui.th}>Qty</th>
                            <th style={ui.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map(h => (
                            <tr key={h.stock_txn_id} style={ui.tr}>
                                <td style={ui.td}>{h.date}</td>
                                <td style={ui.td}>{h.part}</td>
                                <td style={ui.td}>{h.direction}</td>
                                <td style={ui.td}>{h.quantity}</td>
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {confirmId === h.stock_txn_id ? (
                                        <span style={styles.confirmWrap}>
                                            <button onClick={() => handleDelete(h.stock_txn_id)} style={styles.confirmYes}>Delete</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.confirmNo}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(h.stock_txn_id)} style={styles.delBtn}>Delete</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {history.length === 0 && (
                            <tr><td colSpan="5" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No transactions yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    lowBadge: { fontSize: '13px', fontWeight: '500', color: ui.colors.accent, backgroundColor: ui.colors.accentSoft, padding: '2px 10px', borderRadius: '20px' },
    okText: { fontSize: '14px', color: ui.colors.ink },
    delBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    confirmWrap: { display: 'inline-flex', gap: '6px' },
    confirmYes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    confirmNo: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};