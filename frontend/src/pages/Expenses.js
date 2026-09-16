import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import PartPicker from '../components/PartPicker';
import StyledSelect from '../components/StyledSelect';
import DescriptionInput from '../components/DescriptionInput';
import { createExpense, editExpense, getExpenses, getExpenseTypes, getMachines, deleteExpense, bulkDeleteExpenses, getParts, purchaseSparePart, extractReceipt, isViewer, isAdmin } from '../services/api';
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
    const [extracting, setExtracting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [confirmBulk, setConfirmBulk] = useState(false);
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({ txn_date: '', description: '', amount: '' });
    const fileInputRef = useRef(null);

    const [reviewRows, setReviewRows] = useState(null);
    const [savingReview, setSavingReview] = useState(false);

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

    const machineTypeId = () => {
        const m = types.find(t => t.code === 'machine');
        return m ? m.type_id : null;
    };

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

    const defaultTypeId = () => {
        const common = types.find(t => t.code === 'common');
        return common ? common.type_id : (types[0]?.type_id || '');
    };

    const handleReceiptUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setExtracting(true);
        setError(''); setSuccess(''); setReviewRows(null);
        try {
            const res = await extractReceipt(file);
            const rows = res.data.rows || [];

            if (rows.length === 0) {
                setError('Could not read any details from that photo. Try a clearer, well-lit photo, or enter the details manually.');
            } else {
                const prepared = rows.map((r, i) => ({
                    key: i,
                    selected: true,
                    date: r.date || new Date().toISOString().split('T')[0],
                    description: r.description || '',
                    amount: r.amount != null ? String(r.amount) : '',
                    direction: r.direction === 'in' ? 'in' : 'out',
                    expense_type_id: defaultTypeId(),
                    machine_ids: [],
                    missingFields: [
                        !r.date && 'date',
                        r.amount == null && 'amount',
                        !r.description && 'description',
                    ].filter(Boolean),
                }));
                setReviewRows(prepared);
                setSuccess(`Found ${rows.length} line(s). Review, edit, and select which to add below.`);
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Could not read the receipt. Try a clearer photo or enter manually.'));
        } finally {
            setExtracting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const updateReviewRow = (key, field, value) => {
        setReviewRows(rows => rows.map(r => r.key === key ? { ...r, [field]: value } : r));
    };

    const toggleReviewRowMachine = (key, machineId) => {
        setReviewRows(rows => rows.map(r => {
            if (r.key !== key) return r;
            const has = r.machine_ids.includes(machineId);
            return { ...r, machine_ids: has ? r.machine_ids.filter(m => m !== machineId) : [...r.machine_ids, machineId] };
        }));
    };

    const toggleReviewRow = (key) => {
        setReviewRows(rows => rows.map(r => r.key === key ? { ...r, selected: !r.selected } : r));
    };

    const cancelReview = () => {
        setReviewRows(null);
        setSuccess('');
    };

    const saveReviewRows = async () => {
        const toSave = reviewRows.filter(r => r.selected);
        if (toSave.length === 0) {
            setError('No rows selected to add');
            return;
        }
        const machineTid = machineTypeId();
        for (const r of toSave) {
            if (!r.expense_type_id) {
                setError('Every selected row needs a Type chosen');
                return;
            }
            if (!r.amount || parseFloat(r.amount) <= 0) {
                setError('Every selected row needs a valid amount');
                return;
            }
            if (machineTid && parseInt(r.expense_type_id) === machineTid && r.machine_ids.length === 0) {
                setError('A row typed as "Machine" needs at least one machine selected');
                return;
            }
        }

        setSavingReview(true);
        setError(''); setSuccess('');
        let successCount = 0;
        let failCount = 0;

        for (const r of toSave) {
            try {
                const amount = parseFloat(r.amount);
                await createExpense({
                    txn_date: r.date,
                    description: r.description || '(no description)',
                    expense_type_id: parseInt(r.expense_type_id),
                    debit: r.direction === 'out' ? amount : 0,
                    credit: r.direction === 'in' ? amount : 0,
                    machine_ids: r.machine_ids || [],
                    is_carry_forward: false,
                });
                successCount++;
            } catch (err) {
                failCount++;
            }
        }

        setSavingReview(false);
        setReviewRows(null);
        if (failCount === 0) {
            setSuccess(`${successCount} expense(s) added successfully`);
        } else {
            setSuccess(`${successCount} added, ${failCount} failed — check and re-enter those manually`);
        }
        loadExpenses();
    };

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

    const selectedReviewCount = reviewRows ? reviewRows.filter(r => r.selected).length : 0;
    const machineTid = machineTypeId();

    return (
        <Layout>
            {!viewer && (
                <div style={ui.card}>
                    <div style={ui.cardTitle}>New Expense</div>
                    {error && <div style={ui.alertError}>{error}</div>}
                    {success && !reviewRows && <div style={ui.alertSuccess}>{success}</div>}

                    {!showSparePart && (
                        <div style={styles.uploadRow}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleReceiptUpload}
                                style={{ display: 'none' }}
                                id="receipt-upload"
                            />
                            <label htmlFor="receipt-upload" style={extracting ? styles.uploadBtnDisabled : styles.uploadBtn}>
                                {extracting ? 'Reading photo...' : '📷 Upload Receipt / Ledger Photo'}
                            </label>
                            <span style={styles.uploadHint}>Reads every line — review and pick which to add below</span>
                        </div>
                    )}

                    {reviewRows && (
                        <div style={styles.reviewBox}>
                            <div style={styles.reviewHeader}>
                                <div style={styles.reviewTitle}>{success}</div>
                                <button onClick={cancelReview} style={styles.reviewCancelAll}>Discard All</button>
                            </div>
                            <div style={styles.reviewTable}>
                                {reviewRows.map(r => (
                                    <div key={r.key} style={r.selected ? styles.reviewRowWrap : styles.reviewRowWrapOff}>
                                        <div style={styles.reviewRowMain}>
                                            <input type="checkbox" checked={r.selected} onChange={() => toggleReviewRow(r.key)} style={styles.reviewCheckbox} />
                                            <input
                                                type="date"
                                                value={r.date}
                                                onChange={ev => updateReviewRow(r.key, 'date', ev.target.value)}
                                                style={styles.reviewDateInput}
                                                disabled={!r.selected}
                                            />
                                            <input
                                                type="text"
                                                value={r.description}
                                                onChange={ev => updateReviewRow(r.key, 'description', ev.target.value)}
                                                style={styles.reviewDescInput}
                                                placeholder="Description"
                                                disabled={!r.selected}
                                            />
                                            <select
                                                value={r.direction}
                                                onChange={ev => updateReviewRow(r.key, 'direction', ev.target.value)}
                                                style={styles.reviewDirSelect}
                                                disabled={!r.selected}
                                            >
                                                <option value="out">Out</option>
                                                <option value="in">In</option>
                                            </select>
                                            <input
                                                type="number"
                                                value={r.amount}
                                                onChange={ev => updateReviewRow(r.key, 'amount', ev.target.value)}
                                                style={styles.reviewAmountInput}
                                                placeholder="Amount"
                                                min="0"
                                                step="0.01"
                                                disabled={!r.selected}
                                            />
                                            <div style={styles.reviewTypeWrap}>
                                                <StyledSelect
                                                    options={typeOptions}
                                                    value={r.expense_type_id}
                                                    onChange={(v) => updateReviewRow(r.key, 'expense_type_id', v)}
                                                    placeholder="Type"
                                                />
                                            </div>
                                            {r.missingFields.length > 0 && r.selected && (
                                                <span style={styles.reviewMissing} title={`Could not read: ${r.missingFields.join(', ')}`}>⚠</span>
                                            )}
                                        </div>
                                        {r.selected && machineTid && parseInt(r.expense_type_id) === machineTid && (
                                            <div style={styles.reviewRowExtras}>
                                                <span style={styles.reviewExtraLabel}>Which machine?</span>
                                                <div style={styles.reviewMachineChips}>
                                                    {machines.map(m => (
                                                        <span
                                                            key={m.machine_id}
                                                            onClick={() => toggleReviewRowMachine(r.key, m.machine_id)}
                                                            style={r.machine_ids.includes(m.machine_id) ? styles.reviewChipActive : styles.reviewChip}
                                                        >
                                                            {m.code}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div style={styles.reviewFooter}>
                                <span style={styles.reviewCount}>{selectedReviewCount} of {reviewRows.length} selected</span>
                                <button
                                    onClick={saveReviewRows}
                                    style={savingReview ? ui.btnDisabled : ui.btn}
                                    disabled={savingReview}
                                >
                                    {savingReview ? 'Adding...' : `Add ${selectedReviewCount} Selected`}
                                </button>
                            </div>
                        </div>
                    )}

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
                                <div style={styles.hint}>This records the expense against a catalog part for reference only — it does NOT change stock. Use the Spare Parts page to issue or receive stock.</div>
                                <div style={ui.row2}>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Part</label>
                                        <PartPicker parts={parts} value={form.part_id ? parseInt(form.part_id) : ''} onChange={(id) => setForm(f => ({ ...f, part_id: id }))} />
                                    </div>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Quantity</label>
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
                            {loading ? 'Saving...' : (showSparePart ? 'Record (data only)' : 'Save Expense')}
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
    uploadRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', padding: '12px', backgroundColor: '#f5f3f0', borderRadius: '8px' },
    uploadBtn: { padding: '9px 16px', backgroundColor: ui.colors.ink, color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
    uploadBtnDisabled: { padding: '9px 16px', backgroundColor: ui.colors.muted, color: '#fff', borderRadius: '8px', cursor: 'not-allowed', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
    uploadHint: { fontSize: '12px', color: ui.colors.muted },
    reviewBox: { border: `1px solid ${ui.colors.accent}`, borderRadius: '10px', padding: '16px', marginBottom: '20px', backgroundColor: '#fffaf8' },
    reviewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
    reviewTitle: { fontSize: '13px', fontWeight: '500', color: ui.colors.ink },
    reviewCancelAll: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    reviewTable: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '460px', overflowY: 'auto', marginBottom: '14px' },
    reviewRowWrap: { backgroundColor: '#fff', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}`, padding: '8px' },
    reviewRowWrapOff: { backgroundColor: '#f5f3f0', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}`, padding: '8px', opacity: 0.55 },
    reviewRowMain: { display: 'flex', gap: '8px', alignItems: 'center' },
    reviewCheckbox: { flexShrink: 0 },
    reviewDateInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '130px', flexShrink: 0 },
    reviewDescInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', flex: 1, minWidth: '120px' },
    reviewDirSelect: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '70px', flexShrink: 0 },
    reviewAmountInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '100px', flexShrink: 0 },
    reviewTypeWrap: { width: '140px', flexShrink: 0 },
    reviewMissing: { color: ui.colors.accent, fontSize: '14px', flexShrink: 0 },
    reviewRowExtras: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', paddingLeft: '26px', flexWrap: 'wrap' },
    reviewExtraLabel: { fontSize: '12px', color: ui.colors.inkSoft, whiteSpace: 'nowrap' },
    reviewMachineChips: { display: 'flex', flexWrap: 'wrap', gap: '5px' },
    reviewChip: { padding: '3px 10px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '20px', cursor: 'pointer', backgroundColor: '#fff', fontSize: '11px', color: ui.colors.ink },
    reviewChipActive: { padding: '3px 10px', border: `0.5px solid ${ui.colors.accent}`, borderRadius: '20px', cursor: 'pointer', backgroundColor: ui.colors.accentSoft, color: ui.colors.accent, fontSize: '11px', fontWeight: '500' },
    reviewFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    reviewCount: { fontSize: '12px', color: ui.colors.muted },
};