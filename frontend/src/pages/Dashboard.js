import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
    const navigate  = useNavigate();
    const user      = JSON.parse(localStorage.getItem('user') || '{}');

    const logout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Ramma Equipment</h2>
                <div style={styles.userInfo}>
                    <span>{user.full_name} ({user.role})</span>
                    <button onClick={logout} style={styles.logout}>Logout</button>
                </div>
            </div>
            <div style={styles.grid}>
                <div style={styles.card} onClick={() => navigate('/expenses')}>
                    <h3>💰 Expenses</h3>
                    <p>Record daily expenses</p>
                </div>
                <div style={styles.card} onClick={() => navigate('/stock')}>
                    <h3>🔧 Spare Parts</h3>
                    <p>Issue and receive parts</p>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: { padding:'24px', backgroundColor:'#f0f2f5', minHeight:'100vh' },
    header:    { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'32px', backgroundColor:'#fff', padding:'16px 24px', borderRadius:'8px', boxShadow:'0 1px 4px rgba(0,0,0,0.1)' },
    title:     { margin:0, color:'#1a1a1a' },
    userInfo:  { display:'flex', alignItems:'center', gap:'16px', color:'#555' },
    logout:    { padding:'6px 16px', backgroundColor:'#ff4d4f', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer' },
    grid:      { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'16px' },
    card:      { backgroundColor:'#fff', padding:'24px', borderRadius:'8px', boxShadow:'0 1px 4px rgba(0,0,0,0.1)', cursor:'pointer', textAlign:'center' },
};