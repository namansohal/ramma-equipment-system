import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import PartPicker from '../components/PartPicker';
import StyledSelect from '../components/StyledSelect';
import DescriptionInput from '../components/DescriptionInput';
import { createExpense, editExpense, getExpenses, getExpenseTypes, getMachines, deleteExpense, bulkDeleteExpenses, getParts, purchaseSparePart, isViewer, isAdmin } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import * as ui from '../components/ui';

export default function Expenses() {
    const viewer = isViewer();
    const admin = isAdmin();
    const [expenses, setExpenses] = useState([]);
    const [types, setTypes] = useState([]);
    const [machines, setMachines] = useState([]);
    const [parts, setParts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [confirmBulk, setConfirmBulk] = useState(false);
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({ txn_date: '', description: '', amount: '' });

    const [form, setForm] = useState({
        txn_date: new Date().toISOString().split('T')[0],
        description: '',
        expense_type_id: '',
        direction: 'out',
        amount: '',
        machine_ids: [],
        part_id: '',
        quantity: '',
        unit_price: '',
        supplier: '',
        is_carry_forward: false,
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

    const toggleSelect = (id) => {
        setSelected(s => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const clearSelection = () => { setSelected(new Set()); setConfirmBulk(false); };

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
                if (res.data.overpaid) {
                    setSuccess(`${res.data.message} ⚠ ${res.data.overpay_warning}`);
                } else {
                    setSuccess(res.data.message);
                }
                setForm(f => ({ ...f, description: '', amount: '', machine_ids: [], part_id: '', quantity: '', unit_price: '', supplier: '' }));
            } else {
                const amount = parseFloat(form.amount || 0);
                await createExpense({
                    txn_date: form.txn_date,
                    description: form.description,
                    expense_type_id: parseInt(form.expense_type_id),
                    debit: form.direction === 'out' ? amount : 0,
                    credit: form.direction === 'in' ? amount : 0,
                    machine_ids: form.machine_ids,
                    is_carry_forward: form.is_carry_forward,
                });
                setSuccess('Expense recorded');
                setForm(f => ({ ...f, description: '', amount: '', machine_ids: [], is_carry_forward: false }));
            }
            loadExpenses();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to save'));
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
            setError(getErrorMessage(err, 'Failed to delete'));
            setConfirmId(null);
        }
    };

    const handleBulkDelete = async () => {
        setError(''); setSuccess('');
        try {
            const res = await bulkDeleteExpenses(Array.from(selected));
            setSuccess(res.data.message);
            clearSelection();
            loadExpenses();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete selected'));
            setConfirmBulk(false);
        }
    };

    const startEdit = (e) => {
        const amount = parseFloat(e.debit || 0) > 0 ? e.debit : e.credit;
        setEditing(e.expense_id);
        setEditForm({ txn_date: e.txn_date, description: e.description, amount: amount || '' });
        setError(''); setSuccess('');
    };

    const saveEdit = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await editExpense(id, {
                txn_date: editForm.txn_date,
                description: editForm.description,
                amount: parseFloat(editForm.amount || 0),
            });
            setSuccess(res.data.message);
            setEditing(null);
            loadExpenses();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to update — this entry may be linked to stock or Mainbook'));
        }
    };

    const typeOptions = types.map(t => ({ value: t.type_id, label: t.label }));
    const directionOptions = [
        { value: 'out', label: 'Money Out' },
        { value: 'in', label: 'Money In' },
    ];

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
                                    <DescriptionInput value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} source="expenses" />
                                </div>
                                <div style={ui.row2}>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Direction</label>
                                        <StyledSelect options={directionOptions} value={form.direction} onChange={(v) => setForm(f => ({ ...f, direction: v }))} />
                                    </div>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Amount (GHS)</label>
                                        <input style={ui.input} type="number" name="amount" value={form.amount} onChange={handleChange} min="0" step="0.01" required />
                                    </div>
                                </div>
                                <div style={ui.field}>
                                    <label style={styles.checkboxLabel}>
                                        <input type="checkbox" checked={form.is_carry_forward} onChange={e => setForm(f => ({ ...f, is_carry_forward: e.target.checked }))} />
                                        This is a Carry Forward / Opening Balance (pins to top of its date)
                                    </label>
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
                <div style={styles.headRow}>
                    <div style={ui.cardTitle}>Recent Expenses</div>
                    {selected.size > 0 && !viewer && (
                        confirmBulk ? (
                            <span style={styles.wrap}>
                                <span style={styles.bulkText}>Delete {selected.size} selected?</span>
                                <button onClick={handleBulkDelete} style={styles.yes}>Confirm</button>
                                <button onClick={() => setConfirmBulk(false)} style={styles.no}>Cancel</button>
                            </span>
                        ) : (
                            <span style={styles.wrap}>
                                <span style={styles.bulkText}>{selected.size} selected</span>
                                <button onClick={() => setConfirmBulk(true)} style={styles.bulkDelBtn}>Delete Selected</button>
                                <button onClick={clearSelection} style={styles.no}>Clear</button>
                            </span>
                        )
                    )}
                </div>
                <table style={ui.table}>
                    <thead>
                        <tr>
                            <th style={ui.th}></th>
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
                                <td style={ui.td}>
                                    {!viewer && (
                                        <input type="checkbox" checked={selected.has(e.expense_id)} onChange={() => toggleSelect(e.expense_id)} />
                                    )}
                                </td>
                                {editing === e.expense_id ? (
                                    <>
                                        <td style={ui.td}><input type="date" value={editForm.txn_date} onChange={ev => setEditForm(f => ({ ...f, txn_date: ev.target.value }))} style={styles.editInput} /></td>
                                        <td style={ui.td}><input type="text" value={editForm.description} onChange={ev => setEditForm(f => ({ ...f, description: ev.target.value }))} style={styles.editInputWide} /></td>
                                        <td style={ui.td} colSpan="2">
                                            <input type="number" value={editForm.amount} onChange={ev => setEditForm(f => ({ ...f, amount: ev.target.value }))} style={styles.editInput} min="0" step="0.01" />
                                        </td>
                                        <td style={ui.td}>-</td>
                                        <td style={{ ...ui.td, textAlign: 'right' }}>
                                            <span style={styles.wrap}>
                                                <button onClick={() => saveEdit(e.expense_id)} style={styles.yes}>Save</button>
                                                <button onClick={() => setEditing(null)} style={styles.no}>Cancel</button>
                                            </span>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td style={ui.td}>
                                            {e.txn_date}
                                            {e.is_carry_forward && <span style={styles.cfBadge}>C/F</span>}
                                        </td>
                                        <td style={ui.td}>{e.description}</td>
                                        <td style={ui.td}>{e.debit ? parseFloat(e.debit).toLocaleString() : '-'}</td>
                                        <td style={ui.td}>{e.credit ? parseFloat(e.credit).toLocaleString() : '-'}</td>
                                        <td style={ui.td}>{e.balance ? parseFloat(e.balance).toLocaleString() : '-'}</td>
                                        <td style={{ ...ui.td, textAlign: 'right' }}>
                                            <span style={styles.wrap}>
                                                {admin && (
                                                    <button onClick={() => startEdit(e)} style={styles.editBtn}>Edit</button>
                                                )}
                                                {!viewer && (confirmId === e.expense_id ? (
                                                    <>
                                                        <button onClick={() => handleDelete(e.expense_id)} style={styles.yes}>Delete</button>
                                                        <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => setConfirmId(e.expense_id)} style={styles.del}>Delete</button>
                                                ))}
                                            </span>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {expenses.length === 0 && (
                            <tr><td colSpan="7" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No expenses yet</td></tr>
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
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: ui.colors.ink, cursor: 'pointer' },
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' },
    bulkText: { fontSize: '12px', color: ui.colors.muted },
    bulkDelBtn: { padding: '6px 14px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    del: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    editBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.ink, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    wrap: { display: 'inline-flex', gap: '6px', alignItems: 'center' },
    yes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    no: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    editInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px', width: '110px' },
    editInputWide: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px', width: '100%' },
    cfBadge: { marginLeft: '8px', fontSize: '10px', fontWeight: '600', color: ui.colors.accent, backgroundColor: ui.colors.accentSoft, padding: '1px 6px', borderRadius: '10px' },
};