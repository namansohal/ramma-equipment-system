import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, createUser, getRoles } from '../services/api';

export default function Users() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
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
        try {
            const res = await getUsers();
            setUsers(res.data);
        } catch (err) {
            console.error('Failed to load users', err);
        }
    };

    const loadRoles = async () => {
        try {
            const res = await getRoles();
            setRoles(res.data);
        } catch (err) {
            console.error('Failed to load roles', err);
        }
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
            await createUser({
                ...form,
                role_id: parseInt(form.role_id),
                employee_code: form.employee_code || null,
            });
            setSuccess(`Employee "${form.full_name}" created successfully`);
            setForm({ full_name: '', username: '', password: '', employee_code: '', role_id: '' });
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create employee');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={{ margin: 0 }}>Employees</h2>
                <button onClick={() => navigate('/dashboard')} style={styles.back}>← Dashboard</button>
            </div>

            <div style={styles.formBox}>
                <h3>Add New Employee</h3>
                {error && <div style={styles.error}>{error}</div>}
                {success && <div style={styles.success}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={styles.row}>
                        <div style={styles.field}>
                            <label style={styles.label}>Full Name</label>
                            <input style={styles.input} type="text" name="full_name" value={form.full_name} onChange={handleChange} required />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Employee Code (optional)</label>
                            <input style={styles.input} type="text" name="employee_code" value={form.employee_code} onChange={handleChange} placeholder="EMP002" />
                        </div>
                    </div>
                    <div style={styles.row}>
                        <div style={styles.field}>
                            <label style={styles.label}>Username</label>
                            <input style={styles.input} type="text" name="username" value={form.username} onChange={handleChange} required />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Role</label>
                            <select style={styles.input} name="role_id" value={form.role_id} onChange={handleChange} required>
                                <option value="">Select role</option>
                                {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Password</label>
                        <input style={styles.input} type="text" name="password" value={form.password} onChange={handleChange} required placeholder="Give them a starting password" />
                    </div>
                    <button style={loading ? styles.btnDisabled : styles.btn} type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Employee'}
                    </button>
                </form>
            </div>

            <div style={styles.tableBox}>
                <h3>All Employees</h3>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Username</th>
                            <th style={styles.th}>Code</th>
                            <th style={styles.th}>Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.user_id} style={styles.tr}>
                                <td style={styles.td}>{u.full_name}</td>
                                <td style={styles.td}>{u.username}</td>
                                <td style={styles.td}>{u.employee_code || '-'}</td>
                                <td style={styles.td}>{u.role}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const styles = {
    container: { padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    back: { padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' },
    formBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '24px' },
    tableBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    field: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '4px', fontWeight: '500', color: '#333' },
    input: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' },
    btn: { padding: '10px 24px', backgroundColor: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
    btnDisabled: { padding: '10px 24px', backgroundColor: '#91caff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'not-allowed', fontSize: '14px' },
    error: { backgroundColor: '#fff2f0', border: '1px solid #ffccc7', color: '#cf1322', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px' },
    success: { backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', color: '#389e0d', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0', fontWeight: '600', color: '#555' },
    tr: { borderBottom: '1px solid #f0f0f0' },
    td: { padding: '12px', color: '#333' },
};