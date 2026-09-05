import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getStaff, createStaff, removeStaff } from '../services/api';
import * as ui from '../components/ui';

export default function Staff() {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [form, setForm] = useState({
        full_name: '',
        designation: '',
        department: '',
        monthly_salary: '',
        currency: 'GHS',
        join_date: '',
    });

    useEffect(() => { load(); }, []);

    const load = async () => {
        try { const res = await getStaff(); setStaff(res.data); } catch (e) { console.error(e); }
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
            await createStaff({
                full_name: form.full_name,
                designation: form.designation || null,
                department: form.department || null,
                monthly_salary: form.monthly_salary ? parseFloat(form.monthly_salary) : null,
                currency: form.currency,
                join_date: form.join_date || null,
            });
            setSuccess(`${form.full_name} added to staff`);
            setForm({ full_name: '', designation: '', department: '', monthly_salary: '', currency: 'GHS', join_date: '' });
            load();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to add staff');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (id) => {
        setError('');
        setSuccess('');
        try {
            const res = await removeStaff(id);
            setSuccess(res.data.message);
            setConfirmId(null);
            load();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to remove');
            setConfirmId(null);
        }
    };

    const money = (amt, cur) => amt == null ? '-' : `${cur === 'INR' ? '₹' : '₵'}${amt.toLocaleString()}`;

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>Add Staff Member</div>
                {error && <div style={ui.alertError}>{error}</div>}
                {success && <div style={ui.alertSuccess}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Full Name</label>
                            <input style={ui.input} type="text" name="full_name" value={form.full_name} onChange={handleChange} required />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Designation</label>
                            <input style={ui.input} type="text" name="designation" value={form.designation} onChange={handleChange} placeholder="Operator, Driver..." />
                        </div>
                    </div>
                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Department</label>
                            <input style={ui.input} type="text" name="department" value={form.department} onChange={handleChange} placeholder="Field, Workshop..." />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Join Date</label>
                            <input style={ui.input} type="date" name="join_date" value={form.join_date} onChange={handleChange} />
                        </div>
                    </div>
                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Monthly Salary</label>
                            <input style={ui.input} type="number" name="monthly_salary" value={form.monthly_salary} onChange={handleChange} min="0" step="0.01" />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Currency</label>
                            <select style={ui.input} name="currency" value={form.currency} onChange={handleChange}>
                                <option value="GHS">GHS (Cedi)</option>
                                <option value="INR">INR (Rupee)</option>
                            </select>
                        </div>
                    </div>
                    <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                        {loading ? 'Adding...' : 'Add Staff'}
                    </button>
                </form>
            </div>

            <div style={ui.card}>
                <div style={ui.cardTitle}>All Staff ({staff.length})</div>
                <table style={ui.table}>
                    <thead>
                        <tr>
                            <th style={ui.th}>Name</th>
                            <th style={ui.th}>Designation</th>
                            <th style={ui.th}>Department</th>
                            <th style={ui.th}>Salary</th>
                            <th style={ui.th}>Joined</th>
                            <th style={ui.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {staff.map(s => (
                            <tr key={s.staff_id} style={ui.tr}>
                                <td style={ui.td}>{s.full_name}</td>
                                <td style={ui.td}>{s.designation || '-'}</td>
                                <td style={ui.td}>{s.department || '-'}</td>
                                <td style={ui.td}>{money(s.monthly_salary, s.currency)}</td>
                                <td style={ui.td}>{s.join_date || '-'}</td>
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {confirmId === s.staff_id ? (
                                        <span style={styles.wrap}>
                                            <button onClick={() => handleRemove(s.staff_id)} style={styles.yes}>Remove</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(s.staff_id)} style={styles.del}>Remove</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {staff.length === 0 && (
                            <tr><td colSpan="6" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No staff added yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    del: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    wrap: { display: 'inline-flex', gap: '6px' },
    yes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    no: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};