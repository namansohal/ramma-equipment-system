import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import PartPicker from '../components/PartPicker';
import StyledSelect from '../components/StyledSelect';
import ChipSelect from '../components/ChipSelect';
import { createExpense, getExpenses, getExpenseTypes, getMachines, deleteExpense, getParts, purchaseSparePart, isViewer } from '../services/api';
import * as ui from '../components/ui';

export default function Expenses() {
    const viewer = isViewer();
    const [expenses, setExpenses] = useState([]);
    const [types, setTypes] = useState([]);
    const [machines, setMachines] = useState([]);
    const [parts, setParts] = useState([]);
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
        part_id: '',
        quantity: '',
        unit_price: '',
        supplier: '',
    });

    useEffect(() => {
        loadTypes(); loadExpenses(); loadMachines(); loadParts();
    }, []);

    const loadTypes = async () => { try { const r = await getExpenseTypes(); setTypes(r.data); } catch (e) { console.error(e); } };
    const loadExpenses = async () => { try { const r = await getExpenses(); setExpenses(r.data); } catch (e) { console.error(e); } };
    const loadMachines = async () => { try { const r = await getMachines(); setMachines(r.data); } catch (e) { console.error(e); } };
    const loadParts = async () => { try { const r = await getParts(); setParts(r.data); } catch (e) { console.error(e); } };

    const selectedType = types.find(t => t.type_id === parseInt(form.expense_type_id));
    const typeCode = selectedType?.code;
    const showMachinePicker = typeCode === 'machine';
    const showSparePart = typeCode === 'spare_part';

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

    const sparePartTotal = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setSuccess('');
        try {
            if (showSparePart) {
                const res = await purchaseSparePart({
                    part_id: parseInt(form.part_id),
                    quantity: parseFloat(form.quantity),
                    unit_price: parseFloat(form.unit_price),
                    txn_date: form.txn_date,
                    supplier: form.supplier || null,
                    notes: null,
                });
                setSuccess(res.data.message);
                setForm(f => ({ ...f, description: '', debit: '', credit: '', machine_ids: [], part_id: '', quantity: '', unit_price: '', supplier: '' }));
            } else {
                await createExpense({
                    txn_date: form.txn_date,
                    description: form.description,
                    expense_type_id: parseInt(form.expense_type_id),
                    debit: parseFloat(form.debit || 0),
                    credit: parseFloat(form.credit || 0),
                    machine_ids: form.machine_ids,
                });
                setSuccess('Expense recorded');
                setForm(f => ({ ...f, description: '', debit: '', credit: '', machine_ids: [] }));
            }
            loadExpenses();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setError(''); setSuccess('');
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

    const typeOptions = types.map(t => ({ value: t.type_id, label: t.label }));
    const machineOptions = machines.map(m => ({ value: m.machine_id, label: m.code }));

    return (
        <Layout>
            {!viewer && (
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
                                <StyledSelect options={typeOptions} value={form.expense_type_id} onChange={(v) => setForm(f => ({ ...f, expense_type_id: v }))} placeholder="Select type" />
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

                        {showSparePart ? (
                            <>
                                <div style={styles.hint}>Enter the price of ONE item — total is calculated automatically. This adds the part to stock and records the expense together.</div>
                                <div style={ui.row2}>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Part</label>
                                        <PartPicker parts={parts} value={form.part_id ? parseInt(form.part_id) : ''} onChange={(id) => setForm(f => ({ ...f, part_id: id }))} />
                                    </div>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Quantity Bought</label>
                                        <input style={ui.input} type="number" name="quantity" value={form.quantity} onChange={handleChange} min="0" step="0.01" required />
                                    </div>
                                </div>
                                <div style={ui.row2}>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Price of 1 Item (GHS)</label>
                                        <input style={ui.input} type="number" name="unit_price" value={form.unit_price} onChange={handleChange} min="0" step="0.01" required />
                                    </div>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Supplier / Shop</label>
                                        <input style={ui.input} type="text" name="supplier" value={form.supplier} onChange={handleChange} placeholder="Shop name" />
                                    </div>
                                </div>
                                {sparePartTotal > 0 && (
                                    <div style={styles.totalHint}>Total: ₵{sparePartTotal.toLocaleString()}</div>
                                )}
                            </>
                        ) : (
                            <>
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
                            </>
                        )}

                        <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                            {loading ? 'Saving...' : (showSparePart ? 'Record Purchase' : 'Save Expense')}
                        </button>
                    </form>
                </div>
            )}

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
                                    {!viewer && (confirmId === e.expense_id ? (
                                        <span style={styles.wrap}>
                                            <button onClick={() => handleDelete(e.expense_id)} style={styles.yes}>Delete</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(e.expense_id)} style={styles.del}>Delete</button>
                                    ))}
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
    hint: { fontSize: '12px', color: ui.colors.muted, marginBottom: '14px' },
    totalHint: { fontSize: '13px', color: ui.colors.ink, fontWeight: '500', marginBottom: '14px', marginTop: '-6px' },
    del: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    wrap: { display: 'inline-flex', gap: '6px' },
    yes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    no: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};