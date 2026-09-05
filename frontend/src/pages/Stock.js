import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getParts, getCurrentStock, getStockHistory, createStockTxn, deleteStockTxn, purchaseSparePart, getMachines, isViewer } from '../services/api';
import * as ui from '../components/ui';

export default function Stock() {
    const viewer = isViewer();
    const [parts, setParts] = useState([]);
    const [machines, setMachines] = useState([]);
    const [stock, setStock] = useState([]);
    const [history, setHistory] = useState([]);
    const [mode, setMode] = useState('issue'); // 'issue' | 'purchase'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);

    const [issueForm, setIssueForm] = useState({
        part_id: '', txn_date: new Date().toISOString().split('T')[0],
        direction: 'OUT', quantity: '', machine_id: '', notes: '',
    });
    const [buyForm, setBuyForm] = useState({
        part_id: '', quantity: '', amount: '', txn_date: new Date().toISOString().split('T')[0],
        supplier: '', notes: '',
    });

    useEffect(() => {
        loadParts(); loadMachines(); loadStock(); loadHistory();
    }, []);

    const loadParts = async () => { try { const r = await getParts(); setParts(r.data); } catch (e) { console.error(e); } };
    const loadMachines = async () => { try { const r = await getMachines(); setMachines(r.data); } catch (e) { console.error(e); } };
    const loadStock = async () => { try { const r = await getCurrentStock(); setStock(r.data); } catch (e) { console.error(e); } };
    const loadHistory = async () => { try { const r = await getStockHistory(); setHistory(r.data); } catch (e) { console.error(e); } };

    const refreshAll = () => { loadStock(); loadHistory(); };

    const submitIssue = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setSuccess('');
        try {
            await createStockTxn({
                part_id: parseInt(issueForm.part_id),
                txn_date: issueForm.txn_date,
                direction: 'OUT',
                quantity: parseFloat(issueForm.quantity),
                unit_price: null,
                total_amount: null,
                machine_id: issueForm.machine_id ? parseInt(issueForm.machine_id) : null,
                notes: issueForm.notes || null,
            });
            setSuccess('Part issued');
            setIssueForm(f => ({ ...f, part_id: '', quantity: '', machine_id: '', notes: '' }));
            refreshAll();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to issue part');
        } finally { setLoading(false); }
    };

    const submitBuy = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setSuccess('');
        try {
            const res = await purchaseSparePart({
                part_id: parseInt(buyForm.part_id),
                quantity: parseFloat(buyForm.quantity),
                amount: parseFloat(buyForm.amount),
                txn_date: buyForm.txn_date,
                supplier: buyForm.supplier || null,
                notes: buyForm.notes || null,
            });
            setSuccess(res.data.message);
            setBuyForm(f => ({ ...f, part_id: '', quantity: '', amount: '', supplier: '', notes: '' }));
            refreshAll();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to record purchase');
        } finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await deleteStockTxn(id);
            setSuccess(res.data.message);
            setConfirmId(null);
            refreshAll();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete');
            setConfirmId(null);
        }
    };

    return (
        <Layout>
            {!viewer && (
                <div style={ui.card}>
                    <div style={styles.tabRow}>
                        <button onClick={() => setMode('issue')} style={mode === 'issue' ? styles.tabActive : styles.tab}>Issue to Machine</button>
                        <button onClick={() => setMode('purchase')} style={mode === 'purchase' ? styles.tabActive : styles.tab}>Buy / Receive Stock</button>
                    </div>
                    {error && <div style={ui.alertError}>{error}</div>}
                    {success && <div style={ui.alertSuccess}>{success}</div>}

                    {mode === 'issue' ? (
                        <form onSubmit={submitIssue}>
                            <div style={ui.field}>
                                <label style={ui.label}>Part</label>
                                <select style={ui.input} value={issueForm.part_id} onChange={e => setIssueForm(f => ({ ...f, part_id: e.target.value }))} required>
                                    <option value="">Select part</option>
                                    {parts.map(p => <option key={p.part_id} value={p.part_id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div style={ui.row2}>
                                <div style={ui.field}>
                                    <label style={ui.label}>Issue to machine</label>
                                    <select style={ui.input} value={issueForm.machine_id} onChange={e => setIssueForm(f => ({ ...f, machine_id: e.target.value }))} required>
                                        <option value="">Select machine</option>
                                        {machines.map(m => <option key={m.machine_id} value={m.machine_id}>{m.code}</option>)}
                                    </select>
                                </div>
                                <div style={ui.field}>
                                    <label style={ui.label}>Quantity</label>
                                    <input style={ui.input} type="number" value={issueForm.quantity} onChange={e => setIssueForm(f => ({ ...f, quantity: e.target.value }))} min="0" step="0.01" required />
                                </div>
                            </div>
                            <div style={ui.row2}>
                                <div style={ui.field}>
                                    <label style={ui.label}>Date</label>
                                    <input style={ui.input} type="date" value={issueForm.txn_date} onChange={e => setIssueForm(f => ({ ...f, txn_date: e.target.value }))} required />
                                </div>
                                <div style={ui.field}>
                                    <label style={ui.label}>Notes (optional)</label>
                                    <input style={ui.input} type="text" value={issueForm.notes} onChange={e => setIssueForm(f => ({ ...f, notes: e.target.value }))} />
                                </div>
                            </div>
                            <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                                {loading ? 'Saving...' : 'Issue Part'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={submitBuy}>
                            <div style={styles.hint}>Recording a purchase adds stock AND records the expense automatically.</div>
                            <div style={ui.field}>
                                <label style={ui.label}>Part</label>
                                <select style={ui.input} value={buyForm.part_id} onChange={e => setBuyForm(f => ({ ...f, part_id: e.target.value }))} required>
                                    <option value="">Select part</option>
                                    {parts.map(p => <option key={p.part_id} value={p.part_id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div style={ui.row2}>
                                <div style={ui.field}>
                                    <label style={ui.label}>Quantity</label>
                                    <input style={ui.input} type="number" value={buyForm.quantity} onChange={e => setBuyForm(f => ({ ...f, quantity: e.target.value }))} min="0" step="0.01" required />
                                </div>
                                <div style={ui.field}>
                                    <label style={ui.label}>Total Amount (GHS)</label>
                                    <input style={ui.input} type="number" value={buyForm.amount} onChange={e => setBuyForm(f => ({ ...f, amount: e.target.value }))} min="0" step="0.01" required />
                                </div>
                            </div>
                            <div style={ui.row2}>
                                <div style={ui.field}>
                                    <label style={ui.label}>Supplier / Shop</label>
                                    <input style={ui.input} type="text" value={buyForm.supplier} onChange={e => setBuyForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Shop name" />
                                </div>
                                <div style={ui.field}>
                                    <label style={ui.label}>Date</label>
                                    <input style={ui.input} type="date" value={buyForm.txn_date} onChange={e => setBuyForm(f => ({ ...f, txn_date: e.target.value }))} required />
                                </div>
                            </div>
                            <div style={ui.field}>
                                <label style={ui.label}>Notes (optional)</label>
                                <input style={ui.input} type="text" value={buyForm.notes} onChange={e => setBuyForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>
                            <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                                {loading ? 'Saving...' : 'Record Purchase'}
                            </button>
                        </form>
                    )}
                </div>
            )}

            <div style={ui.card}>
                <div style={ui.cardTitle}>Current Stock</div>
                <table style={ui.table}>
                    <thead><tr><th style={ui.th}>Part</th><th style={ui.th}>Available</th></tr></thead>
                    <tbody>
                        {stock.map(s => {
                            const qty = parseFloat(s.available);
                            const low = qty <= 5;
                            return (
                                <tr key={s.part_id} style={ui.tr}>
                                    <td style={ui.td}>{s.name}</td>
                                    <td style={ui.td}><span style={low ? styles.lowBadge : styles.okText}>{qty.toLocaleString()}</span></td>
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
                        <tr><th style={ui.th}>Date</th><th style={ui.th}>Part</th><th style={ui.th}>Direction</th><th style={ui.th}>Qty</th><th style={ui.th}></th></tr>
                    </thead>
                    <tbody>
                        {history.map(h => (
                            <tr key={h.stock_txn_id} style={ui.tr}>
                                <td style={ui.td}>{h.date}</td>
                                <td style={ui.td}>{h.part}</td>
                                <td style={ui.td}>{h.direction}</td>
                                <td style={ui.td}>{h.quantity}</td>
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {!viewer && (confirmId === h.stock_txn_id ? (
                                        <span style={styles.wrap}>
                                            <button onClick={() => handleDelete(h.stock_txn_id)} style={styles.yes}>Delete</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(h.stock_txn_id)} style={styles.del}>Delete</button>
                                    ))}
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
    tabRow: { display: 'flex', gap: '8px', marginBottom: '18px' },
    tab: { padding: '9px 16px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    tabActive: { padding: '9px 16px', backgroundColor: ui.colors.accentSoft, color: ui.colors.accent, border: `0.5px solid ${ui.colors.accent}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    hint: { fontSize: '12px', color: ui.colors.muted, marginBottom: '14px' },
    lowBadge: { fontSize: '13px', fontWeight: '500', color: ui.colors.accent, backgroundColor: ui.colors.accentSoft, padding: '2px 10px', borderRadius: '20px' },
    okText: { fontSize: '14px', color: ui.colors.ink },
    del: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    wrap: { display: 'inline-flex', gap: '6px' },
    yes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    no: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};