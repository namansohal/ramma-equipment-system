import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ChipSelect from '../components/ChipSelect';
import { getMachines, getDowntime, createDowntime, endDowntime, editDowntime, deleteDowntime, isAdmin } from '../services/api';
import * as ui from '../components/ui';

export default function Downtime() {
    const [machines, setMachines] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [endingId, setEndingId] = useState(null);
    const admin = isAdmin();
    const [edit, setEdit] = useState(null);       // row being edited
    const [confirmDel, setConfirmDel] = useState(null);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [form, setForm] = useState({
        machine_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        reason: '',
        notes: '',
    });

    useEffect(() => {
        loadMachines();
        loadRecords();
    }, []);

    const loadMachines = async () => {
        try { const res = await getMachines(); setMachines(res.data); } catch (e) { console.error(e); }
    };
    const loadRecords = async () => {
        try { const res = await getDowntime(); setRecords(res.data); } catch (e) { console.error(e); }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await createDowntime({
                machine_id: parseInt(form.machine_id),
                start_date: form.start_date,
                end_date: form.end_date || null,
                reason: form.reason,
                notes: form.notes || null,
            });
            setSuccess('Downtime recorded');
            setForm(f => ({ ...f, reason: '', notes: '', end_date: '' }));
            loadRecords();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to record downtime');
        } finally {
            setLoading(false);
        }
    };

    const saveEdit = async () => {
        setError(''); setSuccess('');
        try {
            const res = await editDowntime(edit.downtime_id, {
                reason: edit.reason, start_date: edit.start_date, end_date: edit.end_date || null, notes: edit.notes,
            });
            setSuccess(res.data.message);
            setEdit(null);
            loadRecords();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update');
        }
    };

    const handleDelete = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await deleteDowntime(id);
            setSuccess(res.data.message);
            setConfirmDel(null);
            loadRecords();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete');
            setConfirmDel(null);
        }
    };

    const handleEnd = async (id) => {
        setError('');
        try {
            await endDowntime(id, { end_date: endDate });
            setEndingId(null);
            loadRecords();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to resolve');
        }
    };

    const machineOptions = machines.map(m => ({ value: m.machine_id, label: m.code }));

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>Record Downtime</div>
                {error && <div style={ui.alertError}>{error}</div>}
                {success && <div style={ui.alertSuccess}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={ui.field}>
                        <label style={ui.label}>Machine</label>
                        <ChipSelect options={machineOptions} value={form.machine_id} onChange={(v) => setForm(f => ({ ...f, machine_id: v }))} />
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>Reason</label>
                        <input style={ui.input} type="text" name="reason" value={form.reason} onChange={handleChange} placeholder="Engine repair, waiting for parts..." required />
                    </div>
                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Start Date</label>
                            <input style={ui.input} type="date" name="start_date" value={form.start_date} onChange={handleChange} required />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>End Date (leave blank if still down)</label>
                            <input style={ui.input} type="date" name="end_date" value={form.end_date} onChange={handleChange} />
                        </div>
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>Notes (optional)</label>
                        <input style={ui.input} type="text" name="notes" value={form.notes} onChange={handleChange} />
                    </div>
                    <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Record Downtime'}
                    </button>
                </form>
            </div>

            <div style={ui.card}>
                <div style={ui.cardTitle}>Downtime History</div>
                <table style={ui.table}>
                    <thead>
                        <tr>
                            <th style={ui.th}>Machine</th>
                            <th style={ui.th}>Reason</th>
                            <th style={ui.th}>Start</th>
                            <th style={ui.th}>End</th>
                            <th style={ui.th}>Days</th>
                            <th style={ui.th}>Status</th>
                            {admin && <th style={ui.th} />}
                        </tr>
                    </thead>
                    <tbody>
                        {records.map(r => edit && edit.downtime_id === r.downtime_id ? (
                            <tr key={r.downtime_id} style={ui.tr}>
                                <td style={ui.td}>{r.machine_code}</td>
                                <td style={ui.td}><input aria-label="Reason" value={edit.reason} onChange={e => setEdit(x => ({ ...x, reason: e.target.value }))} style={styles.editInput} /></td>
                                <td style={ui.td}><input aria-label="Start date" type="date" value={edit.start_date} onChange={e => setEdit(x => ({ ...x, start_date: e.target.value }))} style={styles.editInput} /></td>
                                <td style={ui.td}><input aria-label="End date (blank = still down)" type="date" value={edit.end_date || ''} onChange={e => setEdit(x => ({ ...x, end_date: e.target.value }))} style={styles.editInput} /></td>
                                <td style={ui.td} />
                                <td style={ui.td} colSpan={2}>
                                    <span style={styles.endWrap}>
                                        <button onClick={saveEdit} style={styles.resolveBtn}>Save</button>
                                        <button onClick={() => setEdit(null)} style={styles.cancelBtn}>Cancel</button>
                                    </span>
                                </td>
                            </tr>
                        ) : (
                            <tr key={r.downtime_id} style={ui.tr}>
                                <td style={ui.td}>{r.machine_code}</td>
                                <td style={ui.td}>{r.reason}</td>
                                <td style={ui.td}>{r.start_date}</td>
                                <td style={ui.td}>{r.end_date || '—'}</td>
                                <td style={ui.td}>{r.days}</td>
                                <td style={ui.td}>
                                    {r.ongoing ? (
                                        endingId === r.downtime_id ? (
                                            <span style={styles.endWrap}>
                                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={styles.endInput} />
                                                <button onClick={() => handleEnd(r.downtime_id)} style={styles.resolveBtn}>Save</button>
                                                <button onClick={() => setEndingId(null)} style={styles.cancelBtn}>×</button>
                                            </span>
                                        ) : (
                                            <button onClick={() => { setEndingId(r.downtime_id); setEndDate(new Date().toISOString().split('T')[0]); }} style={styles.downBadge}>Still down · resolve</button>
                                        )
                                    ) : (
                                        <span style={styles.doneBadge}>Resolved</span>
                                    )}
                                </td>
                                {admin && (
                                    <td style={{ ...ui.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {confirmDel === r.downtime_id ? (
                                            <span style={styles.endWrap}>
                                                <button onClick={() => handleDelete(r.downtime_id)} style={styles.delBtn}>Delete</button>
                                                <button onClick={() => setConfirmDel(null)} style={styles.cancelBtn}>Cancel</button>
                                            </span>
                                        ) : (
                                            <span style={styles.endWrap}>
                                                <button onClick={() => setEdit({ downtime_id: r.downtime_id, reason: r.reason, start_date: r.start_date, end_date: r.end_date || '', notes: r.notes || '' })} style={styles.cancelBtn}>Edit</button>
                                                <button onClick={() => setConfirmDel(r.downtime_id)} style={styles.delOutline}>Delete</button>
                                            </span>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                        {records.length === 0 && (
                            <tr><td colSpan={admin ? 7 : 6} style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No downtime recorded</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    editInput: { ...ui.input, minHeight: '36px', padding: '4px 8px', fontSize: '14px' },
    delBtn: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
    delOutline: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: '1px solid #F1B8B2', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
    downBadge: { fontSize: '12px', fontWeight: '500', color: ui.colors.accent, backgroundColor: ui.colors.accentSoft, padding: '4px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer' },
    doneBadge: { fontSize: '12px', fontWeight: '500', color: '#15803d', backgroundColor: '#f0fdf4', padding: '4px 10px', borderRadius: '20px' },
    endWrap: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
    endInput: { padding: '5px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px' },
    resolveBtn: { padding: '5px 12px', backgroundColor: ui.colors.ink, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    cancelBtn: { padding: '5px 9px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};