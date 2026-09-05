import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { colors } from '../components/ui';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await login(username, password);
            localStorage.setItem('token', res.data.access_token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            navigate('/dashboard');
        } catch (err) {
            setError('Incorrect username or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.box}>
                <div style={styles.logoRow}>
                    <img src="/logo_r.jpeg" alt="Ramma" style={styles.logo} />
                </div>
                <h2 style={styles.title}>Ramma Equipment</h2>
                <p style={styles.subtitle}>Company Management System</p>
                {error && <div style={styles.error}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={styles.field}>
                        <label style={styles.label}>Username</label>
                        <input
                            style={styles.input}
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div style={styles.field}>
                        <label style={styles.label}>Password</label>
                        <input
                            style={styles.input}
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        style={loading ? styles.buttonDisabled : styles.button}
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
            <div style={styles.footer}>Ramma Equipment Co. · Kade</div>
        </div>
    );
}

const styles = {
    container: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: colors.page, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    box: { backgroundColor: '#fff', padding: '40px', borderRadius: '14px', border: `0.5px solid ${colors.border}`, width: '360px' },
    logoRow: { display: 'flex', justifyContent: 'center', marginBottom: '18px' },
    logo: { width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' },
    title: { margin: 0, fontSize: '22px', fontWeight: '500', color: colors.ink, textAlign: 'center', letterSpacing: '-0.3px' },
    subtitle: { textAlign: 'center', color: colors.muted, marginTop: '4px', marginBottom: '28px', fontSize: '13px' },
    error: { backgroundColor: colors.accentSoft, border: '0.5px solid #fecaca', color: colors.accent, padding: '10px 14px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px' },
    field: { marginBottom: '18px' },
    label: { display: 'block', marginBottom: '6px', fontWeight: '500', color: colors.inkSoft, fontSize: '13px' },
    input: { width: '100%', padding: '11px 12px', border: `0.5px solid ${colors.borderStrong}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none', color: colors.ink },
    button: { width: '100%', padding: '12px', backgroundColor: colors.accent, color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', marginTop: '4px' },
    buttonDisabled: { width: '100%', padding: '12px', backgroundColor: '#e6a5a5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500', cursor: 'not-allowed', marginTop: '4px' },
    footer: { marginTop: '20px', fontSize: '12px', color: colors.muted },
};