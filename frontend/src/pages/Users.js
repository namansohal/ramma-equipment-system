import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getUsers, createUser, getRoles, deactivateUser } from '../services/api';
import * as ui from '../components/ui';

export default function Users() {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [form, setForm] = useState({
        full_name: '',
        username: '',
        password: '',
        employee_code: '',
        role_id: '',
    });

    useEffect(() => {
        loadUsers();
        loadRoles();
    }, []);

    const loadUsers = async () => {
        try { const res = await getUsers(); setUsers(res.data); } catch (e) { console.error(e); }
    };
    const loadRoles = async () => {
        try { const res = await getRoles(); setRoles(res.data); } catch (e) { console.error(e); }
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
            await createUser({ ...form, role_id: parseInt(form.role_id), employee_code: form.employee_code || null });
            setSuccess(`Employee "${form.full_name}" created`);
            setForm({ full_name: '', username: '', password: '', employee_code: '', role_id: '' });
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create employee');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (userId) => {
        setError('');
        setSuccess('');
        try {
            const res = await deactivateUser(userId);
            setSuccess(res.data.message);
            setConfirmId(null);
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to remove employee');
            setConfirmId(null);
        }
    };

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>Add New Employee</div>
                {error && <div style={ui.alertError}>{error}</div>}
                {success && <div style={ui.alertSuccess}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Full Name</label>
                            <input style={ui.input} type="text" name="full_name" value={form.full_name} onChange={handleChange} required />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Employee Code (optional)</label>
                            <input style={ui.input} type="text" name="employee_code" value={form.employee_code} onChange={handleChange} placeholder="EMP002" />
                        </div>
                    </div>
                    <div style={ui.row2}>
                        <div style={ui.field}>
                            <label style={ui.label}>Username</label>
                            <input style={ui.input} type="text" name="username" value={form.username} onChange={handleChange} required />
                        </div>
                        <div style={ui.field}>
                            <label style={ui.label}>Role</label>
                            <select style={ui.input} name="role_id" value={form.role_id} onChange={handleChange} required>
                                <option value="">Select role</option>
                                {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>Password</label>
                        <input style={ui.input} type="text" name="password" value={form.password} onChange={handleChange} required placeholder="Starting password" />
                    </div>
                    <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Employee'}
                    </button>
                </form>
            </div>

            <div style={ui.card}>
                <div style={ui.cardTitle}>All Employees</div>
                <table style={ui.table}>
                    <thead>
                        <tr>
                            <th style={ui.th}>Name</th>
                            <th style={ui.th}>Username</th>
                            <th style={ui.th}>Code</th>
                            <th style={ui.th}>Role</th>
                            <th style={ui.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.user_id} style={ui.tr}>
                                <td style={ui.td}>{u.full_name}</td>
                                <td style={ui.td}>{u.username}</td>
                                <td style={ui.td}>{u.employee_code || '-'}</td>
                                <td style={{ ...ui.td, textTransform: 'capitalize' }}>{u.role}</td>
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {u.role === 'owner' || u.user_id === currentUser.user_id ? (
                                        <span style={{ color: ui.colors.muted, fontSize: '12px' }}>—</span>
                                    ) : confirmId === u.user_id ? (
                                        <span style={styles.confirmWrap}>
                                            <button onClick={() => handleRemove(u.user_id)} style={styles.confirmYes}>Confirm</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.confirmNo}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(u.user_id)} style={styles.removeBtn}>Remove</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    removeBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    confirmWrap: { display: 'inline-flex', gap: '6px' },
    confirmYes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    confirmNo: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};