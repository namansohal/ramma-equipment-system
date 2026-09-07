import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { getCurrentStock, getExpenses } from '../services/api';
import { colors } from '../components/ui';

export default function Dashboard() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [stock, setStock] = useState(null);
    const [expenses, setExpenses] = useState(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoaded(false);
        try {
            const [stockRes, expRes] = await Promise.all([
                getCurrentStock(),
                getExpenses(),
            ]);
            setStock(stockRes.data);
            setExpenses(expRes.data);
        } catch (err) {
            console.error('Failed to load dashboard', err);
        } finally {
            setLoaded(true);
        }
    };

    const today = new Date().toISOString().split('T')[0];
    const stockList = stock || [];
    const expenseList = expenses || [];
    const todayExpenses = expenseList.filter(e => e.txn_date === today);
    const spentToday = todayExpenses.reduce((sum, e) => sum + parseFloat(e.debit || 0), 0);
    const receivedToday = todayExpenses.reduce((sum, e) => sum + parseFloat(e.credit || 0), 0);
    const lowStock = stockList.filter(s => parseFloat(s.available) <= 5);

    const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const tiles = [
        { path: '/mainbook', title: 'Mainbook', desc: 'Record cash in/out', icon: '❐' },
        { path: '/expenses', title: 'Expenses', desc: 'Record daily expenses', icon: '₵' },
        { path: '/stock', title: 'Spare Parts', desc: 'Issue parts to machines', icon: '⚙' },
    ];
    if (user.role === 'owner' || user.role === 'manager') {
        tiles.push({ path: '/users', title: 'Employees', desc: 'Manage accounts', icon: '◈' });
    }

    return (
        <Layout>
            <div style={styles.head}>
                <div>
                    <div style={styles.greet}>Good day, {user.full_name?.split(' ')[0]}</div>
                    <div style={styles.sub}>{dateStr} · Kade</div>
                </div>
            </div>

            <div style={styles.statGrid}>
                <div style={{ ...styles.stat, borderTop: `2px solid ${colors.accent}` }}>
                    <div style={styles.statLabel}>SPENT TODAY</div>
                    <div style={styles.statValue}>{loaded ? `₵${spentToday.toLocaleString()}` : '—'}</div>
                </div>
                <div style={{ ...styles.stat, borderTop: '2px solid #15803d' }}>
                    <div style={styles.statLabel}>RECEIVED TODAY</div>
                    <div style={{ ...styles.statValue, color: '#15803d' }}>{loaded ? `₵${receivedToday.toLocaleString()}` : '—'}</div>
                </div>
                <div style={styles.stat}>
                    <div style={styles.statLabel}>EXPENSES TODAY</div>
                    <div style={styles.statValue}>{loaded ? todayExpenses.length : '—'}</div>
                </div>
                <div style={styles.stat}>
                    <div style={styles.statLabel}>PARTS TRACKED</div>
                    <div style={styles.statValue}>{loaded ? stockList.length : '—'}</div>
                </div>
                <div style={{ ...styles.stat, borderTop: `2px solid ${lowStock.length > 0 ? colors.accent : colors.border}` }}>
                    <div style={styles.statLabel}>LOW STOCK</div>
                    <div style={{ ...styles.statValue, color: loaded && lowStock.length > 0 ? colors.accent : colors.ink }}>{loaded ? lowStock.length : '—'}</div>
                </div>
            </div>

            <div style={styles.twoCol}>
                <div style={styles.panel}>
                    <div style={styles.panelTitle}>Quick Actions</div>
                    <div style={styles.tileGrid}>
                        {tiles.map(t => (
                            <div key={t.path} style={styles.tile} onClick={() => navigate(t.path)}>
                                <div style={styles.tileIcon}>{t.icon}</div>
                                <div style={styles.tileText}>
                                    <div style={styles.tileTitle}>{t.title}</div>
                                    <div style={styles.tileDesc}>{t.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={styles.panel}>
                    <div style={styles.panelTitle}>Low Stock</div>
                    {!loaded ? (
                        <div style={styles.empty}>Loading...</div>
                    ) : lowStock.length === 0 ? (
                        <div style={styles.empty}>All parts well stocked</div>
                    ) : (
                        <div style={styles.lowList}>
                            {lowStock.slice(0, 6).map(s => (
                                <div key={s.part_id} style={styles.lowRow}>
                                    <span style={styles.lowName}>{s.name}</span>
                                    <span style={styles.lowBadge}>{parseFloat(s.available)} left</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

const styles = {
    head: { marginBottom: '24px' },
    greet: { fontSize: '23px', fontWeight: '500', color: colors.ink, letterSpacing: '-0.4px', marginBottom: '3px' },
    sub: { fontSize: '13px', color: colors.muted },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', backgroundColor: colors.border, border: `0.5px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' },
    stat: { backgroundColor: '#fff', padding: '18px 20px' },
    statLabel: { fontSize: '11px', color: colors.muted, marginBottom: '8px', letterSpacing: '0.3px' },
    statValue: { fontSize: '24px', fontWeight: '500', color: colors.ink, letterSpacing: '-0.5px', lineHeight: '1' },
    twoCol: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' },
    panel: { backgroundColor: '#fff', border: `0.5px solid ${colors.border}`, borderRadius: '12px', padding: '22px' },
    panelTitle: { fontSize: '14px', fontWeight: '500', color: colors.ink, marginBottom: '18px' },
    tileGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
    tile: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', border: `0.5px solid ${colors.border}`, borderRadius: '10px', cursor: 'pointer' },
    tileIcon: { width: '38px', height: '38px', borderRadius: '9px', backgroundColor: '#f5f3f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: colors.ink, flexShrink: 0 },
    tileText: {},
    tileTitle: { fontSize: '14px', fontWeight: '500', color: colors.ink },
    tileDesc: { fontSize: '12px', color: colors.muted },
    lowList: { display: 'flex', flexDirection: 'column', gap: '12px' },
    lowRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    lowName: { fontSize: '13px', color: colors.ink },
    lowBadge: { fontSize: '12px', fontWeight: '500', color: colors.accent, backgroundColor: colors.accentSoft, padding: '2px 10px', borderRadius: '20px' },
    empty: { fontSize: '13px', color: colors.muted, padding: '12px 0' },
};