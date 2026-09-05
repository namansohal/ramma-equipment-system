import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getUsers, createUser, getRoles, deactivateUser, changeName, changeCode, changeRole } from '../services/api';
import * as ui from '../components/ui';

export default function Users() {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isOwner = currentUser.role === 'owner';
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [edit, setEdit] = useState(null); // { userId, field, value }
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

    const startEdit = (userId, field, value) => {
        setEdit({ userId, field, value: value || '' });
        setError('');
        setSuccess('');
    };

    const saveEdit = async () => {
        const { userId, field, value } = edit;
        setError('');
        setSuccess('');
        try {
            let res;
            if (field === 'name') res = await changeName(userId, { new_name: value.trim() });
            else if (field === 'code') res = await changeCode(userId, { new_code: value.trim() });
            else if (field === 'role') res = await changeRole(userId, { new_role_id: parseInt(value) });
            setSuccess(res.data.message);
            setEdit(null);
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to update');
        }
    };

    const editing = (userId, field) => edit && edit.userId === userId && edit.field === field;

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
                                {/* NAME */}
                                <td style={ui.td}>
                                    {editing(u.user_id, 'name') ? (
                                        <span style={styles.editWrap}>
                                            <input value={edit.value} onChange={e => setEdit({ ...edit, value: e.target.value })} style={styles.editInput} />
                                            <button onClick={saveEdit} style={styles.saveBtn}>Save</button>
                                            <button onClick={() => setEdit(null)} style={styles.cancelBtn}>×</button>
                                        </span>
                                    ) : (
                                        <span>{u.full_name}{isOwner && u.role !== 'owner' && <button onClick={() => startEdit(u.user_id, 'name', u.full_name)} style={styles.editLink}>edit</button>}</span>
                                    )}
                                </td>
                                <td style={ui.td}>{u.username}</td>
                                {/* CODE */}
                                <td style={ui.td}>
                                    {editing(u.user_id, 'code') ? (
                                        <span style={styles.editWrap}>
                                            <input value={edit.value} onChange={e => setEdit({ ...edit, value: e.target.value })} style={styles.editInput} placeholder="EMP002" />
                                            <button onClick={saveEdit} style={styles.saveBtn}>Save</button>
                                            <button onClick={() => setEdit(null)} style={styles.cancelBtn}>×</button>
                                        </span>
                                    ) : (
                                        <span>{u.employee_code || '-'}{isOwner && u.role !== 'owner' && <button onClick={() => startEdit(u.user_id, 'code', u.employee_code)} style={styles.editLink}>edit</button>}</span>
                                    )}
                                </td>
                                {/* ROLE */}
                                <td style={{ ...ui.td, textTransform: 'capitalize' }}>
                                    {editing(u.user_id, 'role') ? (
                                        <span style={styles.editWrap}>
                                            <select value={edit.value} onChange={e => setEdit({ ...edit, value: e.target.value })} style={styles.editInput}>
                                                {roles.filter(r => r.name !== 'owner').map(r => <option key={r.role_id} value={r.role_id}>{r.name}</option>)}
                                            </select>
                                            <button onClick={saveEdit} style={styles.saveBtn}>Save</button>
                                            <button onClick={() => setEdit(null)} style={styles.cancelBtn}>×</button>
                                        </span>
                                    ) : (
                                        <span>{u.role}{isOwner && u.role !== 'owner' && <button onClick={() => { const rid = roles.find(r => r.name === u.role)?.role_id; startEdit(u.user_id, 'role', rid); }} style={styles.editLink}>edit</button>}</span>
                                    )}
                                </td>
                                {/* REMOVE */}
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {u.role === 'owner' || u.user_id === currentUser.user_id ? (
                                        <span style={{ color: ui.colors.muted, fontSize: '12px' }}>—</span>
                                    ) : confirmId === u.user_id ? (
                                        <span style={styles.editWrap}>
                                            <button onClick={() => handleRemove(u.user_id)} style={styles.confirmYes}>Confirm</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.cancelBtn}>Cancel</button>
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
    confirmYes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    editLink: { marginLeft: '8px', padding: '2px 8px', backgroundColor: 'transparent', color: ui.colors.muted, border: `0.5px solid ${ui.colors.border}`, borderRadius: '5px', cursor: 'pointer', fontSize: '11px' },
    editWrap: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
    editInput: { padding: '5px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '13px' },
    saveBtn: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    cancelBtn: { padding: '5px 9px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};