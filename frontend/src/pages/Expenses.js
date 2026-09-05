import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { createExpense, getExpenses, getExpenseTypes, getMachines, deleteExpense } from '../services/api';
import * as ui from '../components/ui';

export default function Expenses() {
    const [expenses, setExpenses] = useState([]);
    const [types, setTypes] = useState([]);
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [form, setForm] = useState({
        txn_date: new Date().toISOString().split('T')[0],
        description: '',
        expense_type_id: '',
        debit: '',
        credit: '',
        machine_ids: [],
    });

    useEffect(() => {
        loadTypes();
        loadExpenses();
        loadMachines();
    }, []);

    const loadTypes = async () => {
        try { const res = await getExpenseTypes(); setTypes(res.data); } catch (e) { console.error(e); }
    };
    const loadExpenses = async () => {
        try { const res = await getExpenses(); setExpenses(res.data); } catch (e) { console.error(e); }
    };
    const loadMachines = async () => {
        try { const res = await getMachines(); setMachines(res.data); } catch (e) { console.error(e); }
    };

    const selectedType = types.find(t => t.type_id === parseInt(form.expense_type_id));
    const showMachinePicker = selectedType && selectedType.code === 'machine';

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const toggleMachine = (id) => {
        setForm(f => ({
            ...f,
            machine_ids: f.machine_ids.includes(id) ? f.machine_ids.filter(m => m !== id) : [...f.machine_ids, id]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await createExpense({
                ...form,
                debit: parseFloat(form.debit || 0),
                credit: parseFloat(form.credit || 0),
                expense_type_id: parseInt(form.expense_type_id),
            });
            setSuccess('Expense recorded');
            setForm(f => ({ ...f, description: '', debit: '', credit: '', machine_ids: [] }));
            loadExpenses();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save expense');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setError('');
        setSuccess('');
        try {
            const res = await deleteExpense(id);
            setSuccess(res.data.message);
            setConfirmId(null);
            loadExpenses();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete');
            setConfirmId(null);
        }
    };

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>New Expense</div>
                {error && <div style={ui.alertError}>{error}</div>}
                {success && <div style={ui.alertSuccess}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Date</label>
                            <input style={ui.input} type="date" name="txn_date" value={form.txn_date} onChange={handleChange} required />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Type</label>
                            <select style={ui.input} name="expense_type_id" value={form.expense_type_id} onChange={handleChange} required>
                                <option value="">Select type</option>
                                {types.map(t => <option key={t.type_id} value={t.type_id}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {showMachinePicker && (
                        <div style={ui.field}>
                            <label style={ui.label}>Which machine(s)?</label>
                            <div style={styles.chipRow}>
                                {machines.map(m => (
                                    <div key={m.machine_id} onClick={() => toggleMachine(m.machine_id)}
                                        style={form.machine_ids.includes(m.machine_id) ? styles.chipActive : styles.chip}>
                                        {m.code}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                        {loading ? 'Saving...' : 'Save Expense'}
                    </button>
                </form>
            </div>

            <div style={ui.card}>
                <div style={ui.cardTitle}>Recent Expenses</div>
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
                        {expenses.map(e => (
                            <tr key={e.expense_id} style={ui.tr}>
                                <td style={ui.td}>{e.txn_date}</td>
                                <td style={ui.td}>{e.description}</td>
                                <td style={ui.td}>{e.debit ? parseFloat(e.debit).toLocaleString() : '-'}</td>
                                <td style={ui.td}>{e.credit ? parseFloat(e.credit).toLocaleString() : '-'}</td>
                                <td style={ui.td}>{e.balance ? parseFloat(e.balance).toLocaleString() : '-'}</td>
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {confirmId === e.expense_id ? (
                                        <span style={styles.confirmWrap}>
                                            <button onClick={() => handleDelete(e.expense_id)} style={styles.confirmYes}>Delete</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.confirmNo}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(e.expense_id)} style={styles.delBtn}>Delete</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {expenses.length === 0 && (
                            <tr><td colSpan="6" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No expenses yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    chipRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    chip: { padding: '8px 16px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: '#fff', userSelect: 'none', fontSize: '13px', color: ui.colors.ink },
    chipActive: { padding: '8px 16px', border: `0.5px solid ${ui.colors.accent}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: ui.colors.accentSoft, color: ui.colors.accent, userSelect: 'none', fontSize: '13px', fontWeight: '500' },
    delBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    confirmWrap: { display: 'inline-flex', gap: '6px' },
    confirmYes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    confirmNo: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};