import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { getRuntime, createRuntime, editRuntime, deleteRuntime, getMachines, extractReceipt, isAdmin } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import * as ui from '../components/ui';

export default function Runtime() {
    const admin = isAdmin();
    const [records, setRecords] = useState([]);
    const [machines, setMachines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [filterMachine, setFilterMachine] = useState('');
    const fileInputRef = useRef(null);
    const [reviewRows, setReviewRows] = useState(null);
    const [savingReview, setSavingReview] = useState(false);

    const [form, setForm] = useState({
        machine_id: '',
        customer_name: '',
        txn_date: new Date().toISOString().split('T')[0],
        start_reading: '',
        end_reading: '',
        amount: '',
        status_note: '',
    });

    useEffect(() => { loadRecords(); loadMachines(); }, [filterMachine]);

    const loadRecords = async () => {
        try {
            const params = filterMachine ? { machine_id: filterMachine } : {};
            const res = await getRuntime(params);
            setRecords(res.data);
        } catch (e) { console.error(e); }
    };

    const loadMachines = async () => {
        try { const res = await getMachines(); setMachines(res.data); } catch (e) { console.error(e); }
    };

    const hours = form.start_reading && form.end_reading
        ? Math.max(0, parseFloat(form.end_reading) - parseFloat(form.start_reading)).toFixed(2)
        : null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.machine_id) { setError('Select a machine'); return; }
        setLoading(true); setError(''); setSuccess('');
        try {
            await createRuntime({
                machine_id: parseInt(form.machine_id),
                customer_name: form.customer_name || null,
                txn_date: form.txn_date,
                start_reading: form.start_reading ? parseFloat(form.start_reading) : null,
                end_reading: form.end_reading ? parseFloat(form.end_reading) : null,
                amount: parseFloat(form.amount),
                status_note: form.status_note || null,
            });
            setSuccess('Runtime entry recorded');
            setForm(f => ({ ...f, customer_name: '', start_reading: '', end_reading: '', amount: '', status_note: '' }));
            loadRecords();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to save'));
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (r) => {
        setEditing(r.runtime_id);
        setEditForm({
            txn_date: r.txn_date,
            customer_name: r.customer_name || '',
            start_reading: r.start_reading != null ? String(r.start_reading) : '',
            end_reading: r.end_reading != null ? String(r.end_reading) : '',
            amount: String(r.amount),
            status_note: r.status_note || '',
        });
        setError(''); setSuccess('');
    };

    const saveEdit = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await editRuntime(id, {
                txn_date: editForm.txn_date,
                customer_name: editForm.customer_name || null,
                start_reading: editForm.start_reading ? parseFloat(editForm.start_reading) : null,
                end_reading: editForm.end_reading ? parseFloat(editForm.end_reading) : null,
                amount: parseFloat(editForm.amount),
                status_note: editForm.status_note || null,
            });
            setSuccess(res.data.message);
            setEditing(null);
            loadRecords();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to update'));
        }
    };

    const handleDelete = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await deleteRuntime(id);
            setSuccess(res.data.message);
            setConfirmId(null);
            loadRecords();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete'));
            setConfirmId(null);
        }
    };

    const handleReceiptUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setExtracting(true);
        setError(''); setSuccess(''); setReviewRows(null);
        try {
            const res = await extractReceipt(file, 'runtime');
            const rows = res.data.rows || [];
            if (rows.length === 0) {
                setError('Could not read any details from that photo. Try a clearer, well-lit photo.');
            } else {
                const machineMap = {};
                machines.forEach(m => { machineMap[m.code.toUpperCase()] = m.machine_id; });
                const prepared = rows.map((r, i) => {
                    const code = (r.machine_code || '').toUpperCase();
                    const machineId = machineMap[code] || '';
                    return {
                        key: i,
                        selected: true,
                        machine_id: machineId,
                        machine_code_raw: r.machine_code || '',
                        customer_name: r.customer_name || '',
                        date: r.date || new Date().toISOString().split('T')[0],
                        start_reading: r.start_reading != null ? String(r.start_reading) : '',
                        end_reading: r.end_reading != null ? String(r.end_reading) : '',
                        amount: r.amount != null ? String(r.amount) : '',
                        status_note: r.status_note || '',
                        machineNotFound: !!r.machine_code && !machineId,
                    };
                });
                setReviewRows(prepared);
                setSuccess(`Found ${rows.length} row(s). Review before adding.`);
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Could not read the photo. Try a clearer image.'));
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

    const saveReviewRows = async () => {
        const toSave = reviewRows.filter(r => r.selected);
        if (toSave.length === 0) { setError('No rows selected'); return; }
        for (const r of toSave) {
            if (!r.machine_id) { setError('Every selected row needs a machine selected'); return; }
            if (!r.amount || parseFloat(r.amount) <= 0) { setError('Every selected row needs a valid amount'); return; }
        }
        setSavingReview(true); setError(''); setSuccess('');
        let ok = 0; let fail = 0;
        for (const r of toSave) {
            try {
                await createRuntime({
                    machine_id: parseInt(r.machine_id),
                    customer_name: r.customer_name || null,
                    txn_date: r.date,
                    start_reading: r.start_reading ? parseFloat(r.start_reading) : null,
                    end_reading: r.end_reading ? parseFloat(r.end_reading) : null,
                    amount: parseFloat(r.amount),
                    status_note: r.status_note || null,
                });
                ok++;
            } catch { fail++; }
        }
        setSavingReview(false);
        setReviewRows(null);
        setSuccess(fail === 0 ? `${ok} entry(ies) added` : `${ok} added, ${fail} failed`);
        loadRecords();
    };

    const machineOptions = [{ value: '', label: 'All machines' }, ...machines.map(m => ({ value: m.machine_id, label: m.code }))];
    const selectedReviewCount = reviewRows ? reviewRows.filter(r => r.selected).length : 0;

    return (
        <Layout>
            {admin && (
                <div style={ui.card}>
                    <div style={ui.cardTitle}>New Runtime Entry</div>
                    {error && <div style={ui.alertError}>{error}</div>}
                    {success && !reviewRows && <div style={ui.alertSuccess}>{success}</div>}

                    <div style={styles.uploadRow}>
                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                            onChange={handleReceiptUpload} style={{ display: 'none' }} id="runtime-upload" />
                        <label htmlFor="runtime-upload" style={extracting ? styles.uploadBtnDisabled : styles.uploadBtn}>
                            {extracting ? 'Reading photo...' : '📷 Upload Runtime Ledger Photo'}
                        </label>
                        <span style={styles.uploadHint}>Reads every row — machine, readings, amount, note</span>
                    </div>

                    {reviewRows && (
                        <div style={styles.reviewBox}>
                            <div style={styles.reviewHeader}>
                                <div style={styles.reviewTitle}>{success}</div>
                                <button onClick={() => { setReviewRows(null); setSuccess(''); }} style={styles.cancelBtn}>Discard All</button>
                            </div>
                            <div style={styles.reviewTable}>
                                {reviewRows.map(r => (
                                    <div key={r.key} style={r.selected ? styles.reviewRowWrap : styles.reviewRowWrapOff}>
                                        <div style={styles.reviewRowMain}>
                                            <input type="checkbox" checked={r.selected} onChange={() => toggleReviewRow(r.key)} />
                                            <select value={r.machine_id} onChange={ev => updateReviewRow(r.key, 'machine_id', ev.target.value)} style={styles.reviewMachineSelect}>
                                                <option value="">-- machine --</option>
                                                {machines.map(m => <option key={m.machine_id} value={m.machine_id}>{m.code}</option>)}
                                            </select>
                                            {r.machineNotFound && <span style={styles.warn} title={`"${r.machine_code_raw}" not found — pick manually`}>⚠</span>}
                                            <input type="text" value={r.customer_name} onChange={ev => updateReviewRow(r.key, 'customer_name', ev.target.value)} style={styles.reviewCustomerInput} placeholder="Customer" disabled={!r.selected} />
                                            <input type="date" value={r.date} onChange={ev => updateReviewRow(r.key, 'date', ev.target.value)} style={styles.reviewDateInput} disabled={!r.selected} />
                                            <input type="number" value={r.start_reading} onChange={ev => updateReviewRow(r.key, 'start_reading', ev.target.value)} style={styles.reviewSmallInput} placeholder="Start" disabled={!r.selected} />
                                            <input type="number" value={r.end_reading} onChange={ev => updateReviewRow(r.key, 'end_reading', ev.target.value)} style={styles.reviewSmallInput} placeholder="End" disabled={!r.selected} />
                                            <input type="number" value={r.amount} onChange={ev => updateReviewRow(r.key, 'amount', ev.target.value)} style={styles.reviewAmountInput} placeholder="Amount" disabled={!r.selected} />
                                            <input type="text" value={r.status_note} onChange={ev => updateReviewRow(r.key, 'status_note', ev.target.value)} style={styles.reviewNoteInput} placeholder="Note" disabled={!r.selected} />
                                        </div>
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
                        <div style={ui.field}>
                            <label style={ui.label}>Machine</label>
                            <div style={styles.chipRow}>
                                {machines.map(m => (
                                    <div key={m.machine_id}
                                        onClick={() => setForm(f => ({ ...f, machine_id: m.machine_id }))}
                                        style={form.machine_id === m.machine_id ? styles.chipActive : styles.chip}>
                                        {m.code}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={ui.row2}>
                            <div style={ui.field}>
                                <label style={ui.label}>Customer Name</label>
                                <input style={ui.input} type="text" name="customer_name" value={form.customer_name} onChange={handleChange} placeholder="Customer / site name" />
                            </div>
                            <div style={ui.field}>
                                <label style={ui.label}>Date</label>
                                <input style={ui.input} type="date" name="txn_date" value={form.txn_date} onChange={handleChange} required />
                            </div>
                        </div>
                        <div style={ui.row2}>
                            <div style={ui.field}>
                                <label style={ui.label}>Starting Reading</label>
                                <input style={ui.input} type="number" name="start_reading" value={form.start_reading} onChange={handleChange} min="0" step="0.01" placeholder="e.g. 1250" />
                            </div>
                            <div style={ui.field}>
                                <label style={ui.label}>Closing Reading</label>
                                <input style={ui.input} type="number" name="end_reading" value={form.end_reading} onChange={handleChange} min="0" step="0.01" placeholder="e.g. 1262" />
                            </div>
                        </div>
                        {hours !== null && <div style={styles.hoursHint}>Hours worked: {hours}</div>}
                        <div style={ui.row2}>
                            <div style={ui.field}>
                                <label style={ui.label}>Amount (GHS)</label>
                                <input style={ui.input} type="number" name="amount" value={form.amount} onChange={handleChange} min="0" step="0.01" required />
                            </div>
                            <div style={ui.field}>
                                <label style={ui.label}>Status Note</label>
                                <input style={ui.input} type="text" name="status_note" value={form.status_note} onChange={handleChange} placeholder="e.g. 8 shifts, Booking finished" />
                            </div>
                        </div>
                        <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Record Entry'}
                        </button>
                    </form>
                </div>
            )}

            <div style={ui.card}>
                <div style={styles.headRow}>
                    <div style={ui.cardTitle}>Runtime Ledger</div>
                    <div style={styles.filterWrap}>
                        <label style={styles.filterLabel}>Machine:</label>
                        <select value={filterMachine} onChange={e => setFilterMachine(e.target.value)} style={styles.filterSelect}>
                            {machineOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                </div>
                <table style={ui.table}>
                    <thead>
                        <tr>
                            <th style={ui.th}>Date</th>
                            <th style={ui.th}>Machine</th>
                            <th style={ui.th}>Customer</th>
                            <th style={ui.th}>Start</th>
                            <th style={ui.th}>End</th>
                            <th style={ui.th}>Hours</th>
                            <th style={ui.th}>Amount</th>
                            <th style={ui.th}>Note</th>
                            <th style={ui.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map(r => (
                            <tr key={r.runtime_id} style={ui.tr}>
                                {editing === r.runtime_id ? (
                                    <>
                                        <td style={ui.td}><input type="date" value={editForm.txn_date} onChange={ev => setEditForm(f => ({ ...f, txn_date: ev.target.value }))} style={styles.editInput} /></td>
                                        <td style={ui.td}>{r.machine_code}</td>
                                        <td style={ui.td}><input type="text" value={editForm.customer_name} onChange={ev => setEditForm(f => ({ ...f, customer_name: ev.target.value }))} style={styles.editInput} /></td>
                                        <td style={ui.td}><input type="number" value={editForm.start_reading} onChange={ev => setEditForm(f => ({ ...f, start_reading: ev.target.value }))} style={styles.editInputSm} /></td>
                                        <td style={ui.td}><input type="number" value={editForm.end_reading} onChange={ev => setEditForm(f => ({ ...f, end_reading: ev.target.value }))} style={styles.editInputSm} /></td>
                                        <td style={ui.td}>
                                            {editForm.start_reading && editForm.end_reading
                                                ? Math.max(0, parseFloat(editForm.end_reading) - parseFloat(editForm.start_reading)).toFixed(2)
                                                : '-'}
                                        </td>
                                        <td style={ui.td}><input type="number" value={editForm.amount} onChange={ev => setEditForm(f => ({ ...f, amount: ev.target.value }))} style={styles.editInputSm} /></td>
                                        <td style={ui.td}><input type="text" value={editForm.status_note} onChange={ev => setEditForm(f => ({ ...f, status_note: ev.target.value }))} style={styles.editInput} /></td>
                                        <td style={{ ...ui.td, textAlign: 'right' }}>
                                            <span style={styles.wrap}>
                                                <button onClick={() => saveEdit(r.runtime_id)} style={styles.yes}>Save</button>
                                                <button onClick={() => setEditing(null)} style={styles.no}>Cancel</button>
                                            </span>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td style={ui.td}>{r.txn_date}</td>
                                        <td style={ui.td}>{r.machine_code}</td>
                                        <td style={ui.td}>{r.customer_name || '-'}</td>
                                        <td style={ui.td}>{r.start_reading != null ? r.start_reading : '-'}</td>
                                        <td style={ui.td}>{r.end_reading != null ? r.end_reading : '-'}</td>
                                        <td style={ui.td}>{r.hours != null ? r.hours : '-'}</td>
                                        <td style={ui.td}>₵{parseFloat(r.amount).toLocaleString()}</td>
                                        <td style={ui.td}>{r.status_note || '-'}</td>
                                        <td style={{ ...ui.td, textAlign: 'right' }}>
                                            <span style={styles.wrap}>
                                                {admin && <button onClick={() => startEdit(r)} style={styles.editBtn}>Edit</button>}
                                                {admin && (confirmId === r.runtime_id ? (
                                                    <>
                                                        <button onClick={() => handleDelete(r.runtime_id)} style={styles.yes}>Delete</button>
                                                        <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => setConfirmId(r.runtime_id)} style={styles.del}>Delete</button>
                                                ))}
                                            </span>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr><td colSpan="9" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No runtime entries yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    chipRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' },
    chip: { padding: '8px 16px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: '#fff', userSelect: 'none', fontSize: '13px', color: ui.colors.ink },
    chipActive: { padding: '8px 16px', border: `1px solid ${ui.colors.ink}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: ui.colors.ink, color: '#fff', userSelect: 'none', fontSize: '13px', fontWeight: '500' },
    hoursHint: { fontSize: '13px', color: ui.colors.ink, fontWeight: '500', marginBottom: '14px', marginTop: '-6px' },
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    filterWrap: { display: 'flex', alignItems: 'center', gap: '8px' },
    filterLabel: { fontSize: '12px', color: ui.colors.muted },
    filterSelect: { padding: '6px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px' },
    uploadRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', padding: '12px', backgroundColor: '#f5f3f0', borderRadius: '8px' },
    uploadBtn: { padding: '9px 16px', backgroundColor: ui.colors.ink, color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
    uploadBtnDisabled: { padding: '9px 16px', backgroundColor: ui.colors.muted, color: '#fff', borderRadius: '8px', cursor: 'not-allowed', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
    uploadHint: { fontSize: '12px', color: ui.colors.muted },
    reviewBox: { border: `1px solid ${ui.colors.accent}`, borderRadius: '10px', padding: '16px', marginBottom: '20px', backgroundColor: '#fffaf8' },
    reviewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
    reviewTitle: { fontSize: '13px', fontWeight: '500', color: ui.colors.ink },
    cancelBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    reviewTable: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', marginBottom: '14px' },
    reviewRowWrap: { backgroundColor: '#fff', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}`, padding: '8px' },
    reviewRowWrapOff: { backgroundColor: '#f5f3f0', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}`, padding: '8px', opacity: 0.55 },
    reviewRowMain: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' },
    reviewMachineSelect: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '90px' },
    reviewCustomerInput: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '110px' },
    reviewDateInput: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '130px' },
    reviewSmallInput: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '75px' },
    reviewAmountInput: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '90px' },
    reviewNoteInput: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', flex: 1, minWidth: '100px' },
    warn: { color: ui.colors.accent, fontSize: '13px' },
    reviewFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    reviewCount: { fontSize: '12px', color: ui.colors.muted },
    del: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    editBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.ink, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    wrap: { display: 'inline-flex', gap: '6px', alignItems: 'center' },
    yes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    no: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    editInput: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '110px' },
    editInputSm: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '80px' },
};