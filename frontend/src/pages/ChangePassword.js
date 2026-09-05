import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../services/api';

export default function ChangePassword() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (form.new_password !== form.confirm) {
            setError('New passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await changePassword({ old_password: form.old_password, new_password: form.new_password });
            setSuccess('Password changed successfully');
            setForm({ old_password: '', new_password: '', confirm: '' });
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={{ margin: 0 }}>Change Password</h2>
                <button onClick={() => navigate('/dashboard')} style={styles.back}>← Dashboard</button>
            </div>
            <div style={styles.formBox}>
                {error && <div style={styles.error}>{error}</div>}
                {success && <div style={styles.success}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={styles.field}>
                        <label style={styles.label}>Current Password</label>
                        <input style={styles.input} type="password" name="old_password" value={form.old_password} onChange={handleChange} required />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>New Password</label>
                        <input style={styles.input} type="password" name="new_password" value={form.new_password} onChange={handleChange} required />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Confirm New Password</label>
                        <input style={styles.input} type="password" name="confirm" value={form.confirm} onChange={handleChange} required />
                    </div>
                    <button style={loading ? styles.btnDisabled : styles.btn} type="submit" disabled={loading}>
                        {loading ? 'Changing...' : 'Change Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles = {
    container: { padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    back: { padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' },
    formBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', maxWidth: '480px' },
    field: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '4px', fontWeight: '500', color: '#333' },
    input: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' },
    btn: { padding: '10px 24px', backgroundColor: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
    btnDisabled: { padding: '10px 24px', backgroundColor: '#91caff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'not-allowed', fontSize: '14px' },
    error: { backgroundColor: '#fff2f0', border: '1px solid #ffccc7', color: '#cf1322', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px' },
    success: { backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', color: '#389e0d', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px' },
};