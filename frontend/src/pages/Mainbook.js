import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import StyledSelect from '../components/StyledSelect';
import DescriptionInput from '../components/DescriptionInput';
import { getMainbook, createMainbook, editMainbook, deleteMainbook, bulkDeleteMainbook, getMachines, isViewer, isAdmin } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import * as ui from '../components/ui';

export default function Mainbook() {
    const viewer = isViewer();
    const admin = isAdmin();
    const [records, setRecords] = useState([]);
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [filterDate, setFilterDate] = useState('');
    const [selected, setSelected] = useState(new Set());
    const [confirmBulk, setConfirmBulk] = useState(false);
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({ txn_date: '', description: '', amount: '' });

    const [form, setForm] = useState({
        txn_date: new Date().toISOString().split('T')[0],
        description: '',
        direction: 'in',
        amount: '',
        destination: 'expense',
        forMachine: false,
        machine_id: '',
    });

    useEffect(() => { loadRecords(); loadMachines(); }, [filterDate]);

    const loadRecords = async () => {
        try {
            const params = filterDate ? { on_date: filterDate } : {};
            const res = await getMainbook(params);
            setRecords(res.data);
        } catch (e) { console.error(e); }
    };
    const loadMachines = async () => {
        try { const res = await getMachines(); setMachines(res.data); } catch (e) { console.error(e); }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const selectMachine = (id) => {
        setForm(f => ({ ...f, machine_id: id }));
    };

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
            const payload = {
                txn_date: form.txn_date,
                description: form.description,
                debit: form.direction === 'out' ? parseFloat(form.amount || 0) : 0,
                credit: form.direction === 'in' ? parseFloat(form.amount || 0) : 0,
                destination: form.direction === 'out' ? form.destination : null,
                machine_id: (form.direction === 'in' && form.forMachine && form.machine_id) ? parseInt(form.machine_id) : null,
            };
            await createMainbook(payload);
            setSuccess('Entry recorded');
            setForm(f => ({ ...f, description: '', amount: '', forMachine: false, machine_id: '' }));
            loadRecords();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to save'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await deleteMainbook(id);
            setSuccess(res.data.message);
            setConfirmId(null);
            loadRecords();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete'));
            setConfirmId(null);
        }
    };

    const handleBulkDelete = async () => {
        setError(''); setSuccess('');
        try {
            const res = await bulkDeleteMainbook(Array.from(selected));
            setSuccess(res.data.message);
            clearSelection();
            loadRecords();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete selected'));
            setConfirmBulk(false);
        }
    };

    const startEdit = (r) => {
        const amount = parseFloat(r.debit || 0) > 0 ? r.debit : r.credit;
        setEditing(r.transaction_id);
        setEditForm({ txn_date: r.txn_date, description: r.description, amount: amount || '' });
        setError(''); setSuccess('');
    };

    const saveEdit = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await editMainbook(id, {
                txn_date: editForm.txn_date,
                description: editForm.description,
                amount: parseFloat(editForm.amount || 0),
            });
            setSuccess(res.data.message);
            setEditing(null);
            loadRecords();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to update — this entry may be linked to Expenses or machine income'));
        }
    };

    const directionOptions = [
        { value: 'in', label: 'Money In' },
        { value: 'out', label: 'Money Out' },
    ];
    const destinationOptions = [
        { value: 'expense', label: 'Expense Book' },
        { value: 'refund', label: 'Refund to Customer' },
        { value: 'momo', label: 'MOMO' },
    ];

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
                                <StyledSelect options={directionOptions} value={form.direction} onChange={(v) => setForm(f => ({ ...f, direction: v }))} />
                            </div>
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Description</label>
                            <DescriptionInput value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} source="mainbook" />
                        </div>
                        <div style={ui.row2}>
                            <div style={ui.field}>
                                <label style={ui.label}>Amount (GHS)</label>
                                <input style={ui.input} type="number" name="amount" value={form.amount} onChange={handleChange} min="0" step="0.01" required />
                            </div>
                            {form.direction === 'out' && (
                                <div style={ui.field}>
                                    <label style={ui.label}>Where is it going?</label>
                                    <StyledSelect options={destinationOptions} value={form.destination} onChange={(v) => setForm(f => ({ ...f, destination: v }))} />
                                </div>
                            )}
                        </div>

                        {form.direction === 'out' && form.destination === 'expense' && (
                            <div style={styles.hint}>This will also appear as money-in in the Expense book.</div>
                        )}

                        {form.direction === 'in' && (
                            <div style={ui.field}>
                                <label style={styles.checkboxLabel}>
                                    <input type="checkbox" checked={form.forMachine} onChange={e => setForm(f => ({ ...f, forMachine: e.target.checked, machine_id: '' }))} />
                                    This is payment for a specific machine
                                </label>
                            </div>
                        )}

                        {form.direction === 'in' && form.forMachine && (
                            <div style={ui.field}>
                                <label style={ui.label}>Which machine?</label>
                                <div style={styles.chipRow}>
                                    {machines.map(m => (
                                        <div key={m.machine_id} onClick={() => selectMachine(m.machine_id)}
                                            style={form.machine_id === m.machine_id ? styles.chipActive : styles.chip}>
                                            {m.code}
                                        </div>
                                    ))}
                                </div>
                                <div style={styles.hint}>This amount will count toward this machine's income.</div>
                            </div>
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
                        <label style={styles.filterLabel}>Show date:</label>
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={styles.filterInput} />
                        {filterDate && <button onClick={() => setFilterDate('')} style={styles.clearBtn}>All</button>}
                    </div>
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
                        {records.map(r => (
                            <tr key={r.transaction_id} style={ui.tr}>
                                <td style={ui.td}>
                                    {!viewer && (
                                        <input type="checkbox" checked={selected.has(r.transaction_id)} onChange={() => toggleSelect(r.transaction_id)} />
                                    )}
                                </td>
                                {editing === r.transaction_id ? (
                                    <>
                                        <td style={ui.td}><input type="date" value={editForm.txn_date} onChange={ev => setEditForm(f => ({ ...f, txn_date: ev.target.value }))} style={styles.editInput} /></td>
                                        <td style={ui.td}><input type="text" value={editForm.description} onChange={ev => setEditForm(f => ({ ...f, description: ev.target.value }))} style={styles.editInputWide} /></td>
                                        <td style={ui.td} colSpan="2">
                                            <input type="number" value={editForm.amount} onChange={ev => setEditForm(f => ({ ...f, amount: ev.target.value }))} style={styles.editInput} min="0" step="0.01" />
                                        </td>
                                        <td style={ui.td}>-</td>
                                        <td style={{ ...ui.td, textAlign: 'right' }}>
                                            <span style={styles.wrap}>
                                                <button onClick={() => saveEdit(r.transaction_id)} style={styles.yes}>Save</button>
                                                <button onClick={() => setEditing(null)} style={styles.no}>Cancel</button>
                                            </span>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td style={ui.td}>{r.txn_date}</td>
                                        <td style={ui.td}>{r.description}</td>
                                        <td style={ui.td}>{r.debit ? parseFloat(r.debit).toLocaleString() : '-'}</td>
                                        <td style={ui.td}>{r.credit ? parseFloat(r.credit).toLocaleString() : '-'}</td>
                                        <td style={ui.td}>{r.balance ? parseFloat(r.balance).toLocaleString() : '-'}</td>
                                        <td style={{ ...ui.td, textAlign: 'right' }}>
                                            <span style={styles.wrap}>
                                                {admin && (
                                                    <button onClick={() => startEdit(r)} style={styles.editBtn}>Edit</button>
                                                )}
                                                {!viewer && (confirmId === r.transaction_id ? (
                                                    <>
                                                        <button onClick={() => handleDelete(r.transaction_id)} style={styles.yes}>Delete</button>
                                                        <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => setConfirmId(r.transaction_id)} style={styles.del}>Delete</button>
                                                ))}
                                            </span>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr><td colSpan="7" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No entries{filterDate ? ' for this date' : ''}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    hint: { fontSize: '12px', color: ui.colors.muted, marginBottom: '14px', marginTop: '-6px' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: ui.colors.ink, cursor: 'pointer' },
    chipRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' },
    chip: { padding: '8px 16px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: '#fff', userSelect: 'none', fontSize: '13px', color: ui.colors.ink },
    chipActive: { padding: '8px 16px', border: `0.5px solid ${ui.colors.accent}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: ui.colors.accentSoft, color: ui.colors.accent, userSelect: 'none', fontSize: '13px', fontWeight: '500' },
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' },
    filterWrap: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    filterLabel: { fontSize: '12px', color: ui.colors.muted },
    filterInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px' },
    clearBtn: { padding: '6px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    bulkText: { fontSize: '12px', color: ui.colors.muted },
    bulkDelBtn: { padding: '6px 14px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    del: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    editBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.ink, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    wrap: { display: 'inline-flex', gap: '6px', alignItems: 'center' },
    yes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    no: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    editInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px', width: '110px' },
    editInputWide: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px', width: '100%' },
};