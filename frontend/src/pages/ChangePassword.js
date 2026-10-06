import React, { useState } from 'react';
import Layout from '../components/Layout';
import { changePassword } from '../services/api';
import * as ui from '../components/ui';

export default function ChangePassword() {
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
            const res = await changePassword({ old_password: form.old_password, new_password: form.new_password });
            // Old tokens stop working once the password changes; keep this session signed in.
            if (res.data?.access_token) localStorage.setItem('token', res.data.access_token);
            setSuccess('Password changed successfully');
            setForm({ old_password: '', new_password: '', confirm: '' });
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div style={{ ...ui.card, maxWidth: '460px' }}>
                <div style={ui.cardTitle}>Change Password</div>
                {error && <div style={ui.alertError}>{error}</div>}
                {success && <div style={ui.alertSuccess}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={ui.field}>
                        <label style={ui.label}>Current Password</label>
                        <input style={ui.input} type="password" name="old_password" value={form.old_password} onChange={handleChange} required />
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>New Password</label>
                        <input style={ui.input} type="password" name="new_password" value={form.new_password} onChange={handleChange} required />
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>Confirm New Password</label>
                        <input style={ui.input} type="password" name="confirm" value={form.confirm} onChange={handleChange} required />
                    </div>
                    <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                        {loading ? 'Changing...' : 'Change Password'}
                    </button>
                </form>
            </div>
        </Layout>
    );
}