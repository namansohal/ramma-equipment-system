import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import * as ui from '../components/ui';

const { colors } = ui;

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [slow, setSlow] = useState(false);
    const navigate = useNavigate();

    // The free Render server sleeps when idle and takes up to a minute to wake.
    // Say so instead of leaving people staring at "Signing in...".
    useEffect(() => {
        if (!loading) { setSlow(false); return; }
        const t = setTimeout(() => setSlow(true), 4000);
        return () => clearTimeout(t);
    }, [loading]);

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
            setError(err.response?.status === 429
                ? err.response.data?.detail || 'Too many failed attempts. Try again later.'
                : 'Incorrect username or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.box}>
                <div style={styles.top}>
                    <img src="/logo_r.jpeg" alt="Ramma" style={styles.logo} />
                    <div>
                        <h1 style={styles.title}>Ramma Equipment</h1>
                        <p style={styles.subtitle}>Company Management System</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit} style={styles.body}>
                    {error && <div style={styles.error} role="alert">{error}</div>}
                    <div>
                        <label style={ui.label} htmlFor="login-username">Username</label>
                        <input
                            id="login-username"
                            style={ui.input}
                            type="text"
                            autoComplete="username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label style={ui.label} htmlFor="login-password">Password</label>
                        <input
                            id="login-password"
                            style={ui.input}
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        style={{ ...(loading ? ui.btnDisabled : ui.btn), width: '100%', minHeight: '48px', fontSize: '16px' }}
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                    {slow && (
                        <div style={styles.slow} role="status">
                            The server is waking up — this can take up to a minute the first time. Please wait.
                        </div>
                    )}
                    <div style={styles.footer}>Ramma Equipment Co. · Kade</div>
                </form>
            </div>
        </div>
    );
}

const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '24px', boxSizing: 'border-box', backgroundColor: colors.side, backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 22px, rgba(255,255,255,0.025) 22px 44px)' },
    box: { backgroundColor: '#fff', borderRadius: '6px', overflow: 'hidden', width: '100%', maxWidth: '400px' },
    top: { backgroundColor: colors.brand, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: '14px' },
    logo: { width: '52px', height: '52px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 },
    title: { margin: 0, fontFamily: ui.condensed, fontSize: '26px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', color: colors.ink, lineHeight: 1.1 },
    subtitle: { margin: '2px 0 0', fontSize: '14px', fontWeight: '500', color: colors.ink },
    body: { padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' },
    error: { ...ui.alertError, marginBottom: 0, fontSize: '14px' },
    slow: { backgroundColor: colors.brandSoft, color: colors.ink, fontSize: '14px', fontWeight: '500', padding: '10px 12px', borderRadius: '4px' },
    footer: { textAlign: 'center', fontSize: '13px', color: colors.muted },
};
