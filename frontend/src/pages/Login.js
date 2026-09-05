import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error,    setError]    = useState('');
    const [loading,  setLoading]  = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await login(username, password);
            localStorage.setItem('token', res.data.access_token);
            localStorage.setItem('user',  JSON.stringify(res.data.user));
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
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles = {
    container:      { display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', backgroundColor:'#f0f2f5' },
    box:            { backgroundColor:'#fff', padding:'40px', borderRadius:'8px', boxShadow:'0 2px 10px rgba(0,0,0,0.1)', width:'360px' },
    title:          { margin:0, fontSize:'24px', fontWeight:'bold', color:'#1a1a1a', textAlign:'center' },
    subtitle:       { textAlign:'center', color:'#666', marginBottom:'24px' },
    error:          { backgroundColor:'#fff2f0', border:'1px solid #ffccc7', color:'#cf1322', padding:'8px 12px', borderRadius:'4px', marginBottom:'16px' },
    field:          { marginBottom:'16px' },
    label:          { display:'block', marginBottom:'4px', fontWeight:'500', color:'#333' },
    input:          { width:'100%', padding:'10px', border:'1px solid #d9d9d9', borderRadius:'4px', fontSize:'14px', boxSizing:'border-box' },
    button:         { width:'100%', padding:'10px', backgroundColor:'#1890ff', color:'#fff', border:'none', borderRadius:'4px', fontSize:'16px', cursor:'pointer' },
    buttonDisabled: { width:'100%', padding:'10px', backgroundColor:'#91caff', color:'#fff', border:'none', borderRadius:'4px', fontSize:'16px', cursor:'not-allowed' },
};