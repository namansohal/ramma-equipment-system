import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import DescriptionInput from '../components/DescriptionInput';
import StyledSelect from '../components/StyledSelect';
import { getMomo, createMomo, editMomo, deleteMomo, bulkDeleteMomo, extractReceipt, isViewer, isAdmin } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import * as ui from '../components/ui';

export default function Momo() {
    const viewer = isViewer();
    const admin = isAdmin();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [filterDate, setFilterDate] = useState('');
    const [selected, setSelected] = useState(new Set());
    const [confirmBulk, setConfirmBulk] = useState(false);
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({ txn_date: '', description: '', amount: '' });
    const [reviewRows, setReviewRows] = useState(null);
    const [savingReview, setSavingReview] = useState(false);
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({
        txn_date: new Date().toISOString().split('T')[0],
        description: '',
        direction: 'in',
        amount: '',
        is_carry_forward: false,
    });

    useEffect(() => { loadRecords(); }, [filterDate]); // eslint-disable-line react-hooks/exhaustive-deps -- reload when the filter changes

    const loadRecords = async () => {
        try {
            const params = filterDate ? { on_date: filterDate } : {};
            const res = await getMomo(params);
            setRecords(res.data);
        } catch (e) { console.error(e); }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const toggleSelect = (id) => {
        setSelected(s => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const clearSelection = () => { setSelected(new Set()); setConfirmBulk(false); };

    const handleReceiptUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setExtracting(true);
        setError(''); setSuccess(''); setReviewRows(null);
        try {
            const res = await extractReceipt(file, 'expense');
            const rows = res.data.rows || [];
            if (rows.length === 0) {
                setError('Could not read any details from that photo. Try a clearer photo or enter manually.');
            } else {
                const prepared = rows.map((r, i) => ({
                    key: i,
                    selected: true,
                    date: r.date || new Date().toISOString().split('T')[0],
                    description: r.description || '',
                    amount: r.amount != null ? String(r.amount) : '',
                    direction: r.direction === 'in' ? 'in' : 'out',
                    is_carry_forward: false,
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
            setError(getErrorMessage(err, 'Could not read the photo. Try a clearer image or enter manually.'));
        } finally {
            setExtracting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const updateReviewRow = (key, field, value) => {
        setReviewRows(rows => rows.map(r => r.key === key ? { ...r, [field]: value } : r));
    };

    const toggleReviewRow = (key) => {
        setReviewRows(rows => rows.map(r => r.key === key ? { ...r, selected: !r.selected } : r));
    };

    const cancelReview = () => { setReviewRows(null); setSuccess(''); };

    const saveReviewRows = async () => {
        const toSave = reviewRows.filter(r => r.selected);
        if (toSave.length === 0) { setError('No rows selected'); return; }
        for (const r of toSave) {
            if (!r.amount || parseFloat(r.amount) <= 0) { setError('Every selected row needs a valid amount'); return; }
        }
        setSavingReview(true); setError(''); setSuccess('');
        let ok = 0; let fail = 0;
        for (const r of toSave) {
            try {
                const amount = parseFloat(r.amount);
                await createMomo({
                    txn_date: r.date,
                    description: r.description || '(no description)',
                    debit: r.direction === 'out' ? amount : 0,
                    credit: r.direction === 'in' ? amount : 0,
                    is_carry_forward: r.is_carry_forward,
                });
                ok++;
            } catch { fail++; }
        }
        setSavingReview(false);
        setReviewRows(null);
        setSuccess(fail === 0 ? `${ok} entry(ies) added` : `${ok} added, ${fail} failed`);
        loadRecords();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setSuccess('');
        try {
            const amount = parseFloat(form.amount || 0);
            await createMomo({
                txn_date: form.txn_date,
                description: form.description,
                debit: form.direction === 'out' ? amount : 0,
                credit: form.direction === 'in' ? amount : 0,
                is_carry_forward: form.is_carry_forward,
            });
            setSuccess('MOMO entry recorded');
            setForm(f => ({ ...f, description: '', amount: '', is_carry_forward: false }));
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
            const res = await deleteMomo(id);
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
            const res = await bulkDeleteMomo(Array.from(selected));
            setSuccess(res.data.message);
            clearSelection();
            loadRecords();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete selected'));
            setConfirmBulk(false);
        }
    };

    const startEdit = (r) => {
        const amount = r.debit > 0 ? r.debit : r.credit;
        setEditing(r.momo_id);
        setEditForm({ txn_date: r.txn_date, description: r.description, amount: String(amount) });
        setError(''); setSuccess('');
    };

    const saveEdit = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await editMomo(id, {
                txn_date: editForm.txn_date,
                description: editForm.description,
                amount: parseFloat(editForm.amount || 0),
            });
            setSuccess(res.data.message);
            setEditing(null);
            loadRecords();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to update'));
        }
    };

    const directionOptions = [
        { value: 'in', label: 'Money In' },
        { value: 'out', label: 'Money Out' },
    ];

    const selectedReviewCount = reviewRows ? reviewRows.filter(r => r.selected).length : 0;

    return (
        <Layout>
            {!viewer && (
                <div style={ui.card}>
                    <div style={ui.cardTitle}>New MOMO Entry</div>
                    {error && <div style={ui.alertError}>{error}</div>}
                    {success && !reviewRows && <div style={ui.alertSuccess}>{success}</div>}

                    <div style={styles.uploadRow}>
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                            onChange={handleReceiptUpload} style={{ display: 'none' }} id="momo-upload" />
                        <label htmlFor="momo-upload" style={extracting ? styles.uploadBtnDisabled : styles.uploadBtn}>
                            {extracting ? 'Reading photo...' : '📷 Upload Receipt / Ledger Photo'}
                        </label>
                        <span style={styles.uploadHint}>Reads every line — review and pick which to add</span>
                    </div>

                    {reviewRows && (
                        <div style={styles.reviewBox}>
                            <div style={styles.reviewHeader}>
                                <div style={styles.reviewTitle}>{success}</div>
                                <button onClick={cancelReview} style={styles.cancelBtn}>Discard All</button>
                            </div>
                            <div style={styles.reviewTable}>
                                {reviewRows.map(r => (
                                    <div key={r.key} style={r.selected ? styles.reviewRowWrap : styles.reviewRowWrapOff}>
                                        <div style={styles.reviewRowMain}>
                                            <input type="checkbox" checked={r.selected} onChange={() => toggleReviewRow(r.key)} />
                                            <input type="date" value={r.date} onChange={ev => updateReviewRow(r.key, 'date', ev.target.value)} style={styles.reviewDateInput} disabled={!r.selected} />
                                            <input type="text" value={r.description} onChange={ev => updateReviewRow(r.key, 'description', ev.target.value)} style={styles.reviewDescInput} placeholder="Description" disabled={!r.selected} />
                                            <select value={r.direction} onChange={ev => updateReviewRow(r.key, 'direction', ev.target.value)} style={styles.reviewDirSelect} disabled={!r.selected}>
                                                <option value="out">Out</option>
                                                <option value="in">In</option>
                                            </select>
                                            <input type="number" value={r.amount} onChange={ev => updateReviewRow(r.key, 'amount', ev.target.value)} style={styles.reviewAmountInput} placeholder="Amount" min="0" step="0.01" disabled={!r.selected} />
                                            {r.missingFields.length > 0 && r.selected && (
                                                <span style={styles.warn} title={`Could not read: ${r.missingFields.join(', ')}`}>⚠</span>
                                            )}
                                        </div>
                                        {r.selected && (
                                            <div style={styles.reviewExtras}>
                                                <label style={styles.checkboxLabel}>
                                                    <input type="checkbox" checked={r.is_carry_forward} onChange={ev => updateReviewRow(r.key, 'is_carry_forward', ev.target.checked)} />
                                                    Carry Forward
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div style={styles.reviewFooter}>
                                <span style={styles.reviewCount}>{selectedReviewCount} of {reviewRows.length} selected</span>
                                <button onClick={saveReviewRows} style={savingReview ? ui.btnDisabled : ui.btn} disabled={savingReview}>
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
                                <label style={ui.label}>Direction</label>
                                <StyledSelect options={directionOptions} value={form.direction} onChange={(v) => setForm(f => ({ ...f, direction: v }))} />
                            </div>
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Description</label>
                            <DescriptionInput value={form.description} onChange={(v) => setForm(f => ({ ...f, description: v }))} source="momo" />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Amount (GHS)</label>
                            <input style={ui.input} type="number" name="amount" value={form.amount} onChange={handleChange} min="0" step="0.01" required />
                        </div>
                        <div style={ui.field}>
                            <label style={styles.checkboxLabel}>
                                <input type="checkbox" checked={form.is_carry_forward} onChange={e => setForm(f => ({ ...f, is_carry_forward: e.target.checked }))} />
                                This is a Carry Forward / Opening Balance (pins to top of its date)
                            </label>
                        </div>
                        <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Entry'}
                        </button>
                    </form>
                </div>
            )}

            <div style={ui.card}>
                <div style={styles.headRow}>
                    <div style={ui.cardTitle}>MOMO Ledger</div>
                    <div style={styles.filterWrap}>
                        {selected.size > 0 && admin && (
                            confirmBulk ? (
                                <span style={styles.wrap}>
                                    <span style={styles.bulkText}>Delete {selected.size} selected?</span>
                                    <button onClick={handleBulkDelete} style={styles.yes}>Confirm</button>
                                    <button onClick={() => setConfirmBulk(false)} style={styles.no}>Cancel</button>
                                </span>
                            ) : (
                                <span style={styles.wrap}>
                                    <span style={styles.bulkText}>{selected.size} selected</span>
                                    {admin && <button onClick={() => setConfirmBulk(true)} style={styles.bulkDelBtn}>Delete Selected</button>}
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
                            <tr key={r.momo_id} style={ui.tr}>
                                <td style={ui.td}>
                                    {admin && <input type="checkbox" checked={selected.has(r.momo_id)} onChange={() => toggleSelect(r.momo_id)} />}
                                </td>
                                {editing === r.momo_id ? (
                                    <>
                                        <td style={ui.td}><input type="date" value={editForm.txn_date} onChange={ev => setEditForm(f => ({ ...f, txn_date: ev.target.value }))} style={styles.editInput} /></td>
                                        <td style={ui.td}><input type="text" value={editForm.description} onChange={ev => setEditForm(f => ({ ...f, description: ev.target.value }))} style={styles.editInputWide} /></td>
                                        <td style={ui.td} colSpan="2">
                                            <input type="number" value={editForm.amount} onChange={ev => setEditForm(f => ({ ...f, amount: ev.target.value }))} style={styles.editInput} min="0" step="0.01" />
                                        </td>
                                        <td style={ui.td}>-</td>
                                        <td style={{ ...ui.td, textAlign: 'right' }}>
                                            <span style={styles.wrap}>
                                                <button onClick={() => saveEdit(r.momo_id)} style={styles.yes}>Save</button>
                                                <button onClick={() => setEditing(null)} style={styles.no}>Cancel</button>
                                            </span>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td style={ui.td}>
                                            {r.txn_date}
                                            {r.is_carry_forward && <span style={styles.cfBadge}>C/F</span>}
                                        </td>
                                        <td style={ui.td}>{r.description}</td>
                                        <td style={ui.td}>{r.debit > 0 ? parseFloat(r.debit).toLocaleString() : '-'}</td>
                                        <td style={ui.td}>{r.credit > 0 ? parseFloat(r.credit).toLocaleString() : '-'}</td>
                                        <td style={ui.td}>{parseFloat(r.balance).toLocaleString()}</td>
                                        <td style={{ ...ui.td, textAlign: 'right' }}>
                                            <span style={styles.wrap}>
                                                {admin && <button onClick={() => startEdit(r)} style={styles.editBtn}>Edit</button>}
                                                {!viewer && (confirmId === r.momo_id ? (
                                                    <>
                                                        <button onClick={() => handleDelete(r.momo_id)} style={styles.yes}>Delete</button>
                                                        <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => setConfirmId(r.momo_id)} style={styles.del}>Delete</button>
                                                ))}
                                            </span>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr><td colSpan="7" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No MOMO entries yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    uploadRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', padding: '12px', backgroundColor: '#f5f3f0', borderRadius: '8px' },
    uploadBtn: { padding: '9px 16px', backgroundColor: ui.colors.ink, color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
    uploadBtnDisabled: { padding: '9px 16px', backgroundColor: ui.colors.muted, color: '#fff', borderRadius: '8px', cursor: 'not-allowed', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
    uploadHint: { fontSize: '12px', color: ui.colors.muted },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: ui.colors.ink, cursor: 'pointer' },
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
    cancelBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    editInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px', width: '110px' },
    editInputWide: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px', width: '100%' },
    cfBadge: { marginLeft: '8px', fontSize: '10px', fontWeight: '600', color: ui.colors.accent, backgroundColor: ui.colors.accentSoft, padding: '1px 6px', borderRadius: '10px' },
    reviewBox: { border: `1px solid ${ui.colors.accent}`, borderRadius: '10px', padding: '16px', marginBottom: '20px', backgroundColor: '#fffaf8' },
    reviewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
    reviewTitle: { fontSize: '13px', fontWeight: '500', color: ui.colors.ink },
    reviewTable: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', marginBottom: '14px' },
    reviewRowWrap: { backgroundColor: '#fff', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}`, padding: '8px' },
    reviewRowWrapOff: { backgroundColor: '#f5f3f0', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}`, padding: '8px', opacity: 0.55 },
    reviewRowMain: { display: 'flex', gap: '8px', alignItems: 'center' },
    reviewDateInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '130px', flexShrink: 0 },
    reviewDescInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', flex: 1, minWidth: '120px' },
    reviewDirSelect: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '70px', flexShrink: 0 },
    reviewAmountInput: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '100px', flexShrink: 0 },
    warn: { color: ui.colors.accent, fontSize: '14px' },
    reviewExtras: { display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', paddingLeft: '26px' },
    reviewFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    reviewCount: { fontSize: '12px', color: ui.colors.muted },
};