import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { createExpense, getExpenses, getExpenseTypes, getMachines } from '../services/api';
import * as ui from '../components/ui';

export default function Expenses() {
    const [expenses, setExpenses] = useState([]);
    const [types, setTypes] = useState([]);
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
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
                            <label style={ui.label}>Debit (GHS)</label>
                            <input style={ui.input} type="number" name="debit" value={form.debit} onChange={handleChange} min="0" step="0.01" />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Credit (GHS)</label>
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
                            <th style={ui.th}>Debit</th>
                            <th style={ui.th}>Credit</th>
                            <th style={ui.th}>Balance</th>
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
                            </tr>
                        ))}
                        {expenses.length === 0 && (
                            <tr><td colSpan="5" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No expenses yet</td></tr>
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
};