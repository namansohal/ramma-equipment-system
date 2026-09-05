import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createExpense, getExpenses, getExpenseTypes, getMachines } from '../services/api';

export default function Expenses() {
    const navigate = useNavigate();
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
        try {
            const res = await getExpenseTypes();
            setTypes(res.data);
        } catch (err) {
            console.error('Failed to load types', err);
        }
    };

    const loadExpenses = async () => {
        try {
            const res = await getExpenses();
            setExpenses(res.data);
        } catch (err) {
            console.error('Failed to load expenses', err);
        }
    };

    const loadMachines = async () => {
        try {
            const res = await getMachines();
            setMachines(res.data);
        } catch (err) {
            console.error('Failed to load machines', err);
        }
    };

    // Find the code of the currently selected type
    const selectedType = types.find(t => t.type_id === parseInt(form.expense_type_id));
    const showMachinePicker = selectedType && selectedType.code === 'machine';

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const toggleMachine = (id) => {
        setForm(f => ({
            ...f,
            machine_ids: f.machine_ids.includes(id)
                ? f.machine_ids.filter(m => m !== id)
                : [...f.machine_ids, id]
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
            setSuccess('Expense recorded successfully');
            setForm(f => ({
                ...f,
                description: '',
                debit: '',
                credit: '',
                machine_ids: [],
            }));
            loadExpenses();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save expense');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={{ margin: 0 }}>Expenses</h2>
                <button onClick={() => navigate('/dashboard')} style={styles.back}>← Dashboard</button>
            </div>

            <div style={styles.formBox}>
                <h3>New Expense</h3>
                {error && <div style={styles.error}>{error}</div>}
                {success && <div style={styles.success}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={styles.row}>
                        <div style={styles.field}>
                            <label style={styles.label}>Date</label>
                            <input style={styles.input} type="date" name="txn_date" value={form.txn_date} onChange={handleChange} required />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Type</label>
                            <select style={styles.input} name="expense_type_id" value={form.expense_type_id} onChange={handleChange} required>
                                <option value="">Select type</option>
                                {types.map(t => <option key={t.type_id} value={t.type_id}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {showMachinePicker && (
                        <div style={styles.field}>
                            <label style={styles.label}>Which machine(s)?</label>
                            <div style={styles.machineGrid}>
                                {machines.map(m => (
                                    <div
                                        key={m.machine_id}
                                        onClick={() => toggleMachine(m.machine_id)}
                                        style={form.machine_ids.includes(m.machine_id) ? styles.machineChipActive : styles.machineChip}
                                    >
                                        {m.code}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={styles.field}>
                        <label style={styles.label}>Description</label>
                        <input style={styles.input} type="text" name="description" value={form.description} onChange={handleChange} required />
                    </div>

                    <div style={styles.row}>
                        <div style={styles.field}>
                            <label style={styles.label}>Debit (GHS)</label>
                            <input style={styles.input} type="number" name="debit" value={form.debit} onChange={handleChange} min="0" step="0.01" />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Credit (GHS)</label>
                            <input style={styles.input} type="number" name="credit" value={form.credit} onChange={handleChange} min="0" step="0.01" />
                        </div>
                    </div>

                    <button style={loading ? styles.btnDisabled : styles.btn} type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Expense'}
                    </button>
                </form>
            </div>

            <div style={styles.tableBox}>
                <h3>Recent Expenses</h3>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Date</th>
                            <th style={styles.th}>Description</th>
                            <th style={styles.th}>Debit (GHS)</th>
                            <th style={styles.th}>Credit (GHS)</th>
                            <th style={styles.th}>Balance (GHS)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.map(e => (
                            <tr key={e.expense_id} style={styles.tr}>
                                <td style={styles.td}>{e.txn_date}</td>
                                <td style={styles.td}>{e.description}</td>
                                <td style={styles.td}>{e.debit ? parseFloat(e.debit).toLocaleString() : '-'}</td>
                                <td style={styles.td}>{e.credit ? parseFloat(e.credit).toLocaleString() : '-'}</td>
                                <td style={styles.td}>{e.balance ? parseFloat(e.balance).toLocaleString() : '-'}</td>
                            </tr>
                        ))}
                        {expenses.length === 0 && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#999' }}>No expenses yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const styles = {
    container: { padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    back: { padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' },
    formBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '24px' },
    tableBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    field: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '4px', fontWeight: '500', color: '#333' },
    input: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' },
    btn: { padding: '10px 24px', backgroundColor: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
    btnDisabled: { padding: '10px 24px', backgroundColor: '#91caff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'not-allowed', fontSize: '14px' },
    error: { backgroundColor: '#fff2f0', border: '1px solid #ffccc7', color: '#cf1322', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px' },
    success: { backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', color: '#389e0d', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0', fontWeight: '600', color: '#555' },
    tr: { borderBottom: '1px solid #f0f0f0' },
    td: { padding: '12px', color: '#333' },
    machineGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    machineChip: { padding: '8px 16px', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff', userSelect: 'none' },
    machineChipActive: { padding: '8px 16px', border: '1px solid #1890ff', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#e6f7ff', color: '#1890ff', userSelect: 'none' },
};