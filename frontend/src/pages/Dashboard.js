import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { getCurrentStock, getExpenses } from '../services/api';
import * as ui from '../components/ui';
import Icon from '../components/Icon';

const { colors } = ui;

// Local calendar date (YYYY-MM-DD), not UTC.
const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Dashboard() {
    const today = localToday();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [stock, setStock] = useState(null);
    const [expenses, setExpenses] = useState(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        loadData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- load once on open

    const loadData = async () => {
        setLoaded(false);
        try {
            const [stockRes, expRes] = await Promise.all([
                getCurrentStock(),
                // Only today's rows: the full list is large and the dashboard doesn't need it.
                getExpenses({ from_date: today, to_date: today }),
            ]);
            setStock(stockRes.data);
            setExpenses(expRes.data);
        } catch (err) {
            console.error('Failed to load dashboard', err);
        } finally {
            setLoaded(true);
        }
    };

    const stockList = stock || [];
    const expenseList = expenses || [];
    const todayExpenses = expenseList.filter(e => e.txn_date === today);
    const spentToday = todayExpenses.reduce((sum, e) => sum + parseFloat(e.debit || 0), 0);
    const receivedToday = todayExpenses.reduce((sum, e) => sum + parseFloat(e.credit || 0), 0);
    const lowStock = stockList.filter(s => parseFloat(s.available) <= 5);

    const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const tiles = [
        { path: '/mainbook', title: 'Mainbook', desc: 'Cash in/out', icon: 'book' },
        { path: '/expenses', title: 'Expenses', desc: 'Daily expenses', icon: 'receipt' },
        { path: '/stock', title: 'Spare Parts', desc: 'Issue to machines', icon: 'gear' },
    ];
    if (user.role === 'owner' || user.role === 'manager') {
        tiles.push({ path: '/users', title: 'Employees', desc: 'Manage accounts', icon: 'userplus' });
    }

    const money = (n) => `₵${n.toLocaleString()}`;
    const show = (v) => (loaded ? v : '—');

    return (
        <Layout>
            <div style={styles.head}>
                <div>
                    <div className="rs-eyebrow">{dateStr} · Kade</div>
                    <h1 className="rs-title">Good day, {user.full_name?.split(' ')[0]}</h1>
                </div>
                <div style={styles.actions}>
                    <button type="button" style={ui.btnSecondary} onClick={() => navigate('/mainbook')}>Mainbook entry</button>
                    <button type="button" style={ui.btn} onClick={() => navigate('/expenses')}>+ New expense</button>
                </div>
            </div>

            <div className="rs-stats">
                <div style={{ ...ui.stat, borderTopColor: colors.brand }}>
                    <div style={ui.statLabel}>Spent today</div>
                    <div style={ui.statValue}>{show(money(spentToday))}</div>
                </div>
                <div style={{ ...ui.stat, borderTopColor: '#15803D' }}>
                    <div style={ui.statLabel}>Received today</div>
                    <div style={{ ...ui.statValue, color: colors.green }}>{show(money(receivedToday))}</div>
                </div>
                <div style={ui.stat}>
                    <div style={ui.statLabel}>Expenses today</div>
                    <div style={ui.statValue}>{show(todayExpenses.length)}</div>
                </div>
                <div style={ui.stat}>
                    <div style={ui.statLabel}>Parts tracked</div>
                    <div style={ui.statValue}>{show(stockList.length)}</div>
                </div>
                <div style={{ ...ui.stat, borderTopColor: lowStock.length > 0 ? colors.accent : 'transparent' }}>
                    <div style={ui.statLabel}>Low stock</div>
                    <div style={{ ...ui.statValue, color: loaded && lowStock.length > 0 ? colors.accent : colors.ink }}>{show(lowStock.length)}</div>
                </div>
            </div>

            <div className="rs-two">
                <div style={ui.card}>
                    <div style={styles.cardHead}>
                        <h2 style={{ ...ui.cardTitle, marginBottom: 0 }}>Today's expenses</h2>
                        <button type="button" style={styles.link} onClick={() => navigate('/expenses')}>View all →</button>
                    </div>
                    {!loaded ? (
                        <div style={styles.empty}>Loading...</div>
                    ) : todayExpenses.length === 0 ? (
                        <div style={styles.empty}>Nothing recorded yet today</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={ui.table}>
                                <thead>
                                    <tr>
                                        <th style={ui.th}>Description</th>
                                        <th style={{ ...ui.th, textAlign: 'right' }}>Out</th>
                                        <th style={{ ...ui.th, textAlign: 'right' }}>In</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {todayExpenses.slice(0, 8).map(e => (
                                        <tr key={e.expense_id} style={ui.tr}>
                                            <td style={ui.td}>{e.description}</td>
                                            <td style={{ ...ui.td, textAlign: 'right' }}>{parseFloat(e.debit || 0) ? money(parseFloat(e.debit)) : ''}</td>
                                            <td style={{ ...ui.td, textAlign: 'right', color: colors.green }}>{parseFloat(e.credit || 0) ? money(parseFloat(e.credit)) : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div>
                    <div style={ui.card}>
                        <div style={styles.cardHead}>
                            <h2 style={{ ...ui.cardTitle, marginBottom: 0 }}>Low stock</h2>
                            <button type="button" style={styles.link} onClick={() => navigate('/stock')}>Spare parts →</button>
                        </div>
                        {!loaded ? (
                            <div style={styles.empty}>Loading...</div>
                        ) : lowStock.length === 0 ? (
                            <div style={styles.empty}>All parts well stocked</div>
                        ) : (
                            lowStock.slice(0, 6).map(s => (
                                <div key={s.part_id} style={styles.lowRow}>
                                    <span>{s.name}</span>
                                    <span style={parseFloat(s.available) <= 0 ? styles.outBadge : styles.lowBadge}>{parseFloat(s.available)} left</span>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={ui.card}>
                        <h2 style={ui.cardTitle}>Quick actions</h2>
                        <div className="rs-quick">
                            {tiles.map(t => (
                                <button type="button" key={t.path} style={styles.tile} onClick={() => navigate(t.path)}>
                                    <span style={styles.tileIcon}><Icon name={t.icon} size={20} /></span>
                                    <span>
                                        <span style={styles.tileTitle}>{t.title}</span>
                                        <span style={styles.tileDesc}>{t.desc}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

const styles = {
    head: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: '22px' },
    actions: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px' },
    link: { background: 'none', border: 'none', padding: 0, color: '#1D4ED8', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
    empty: { fontSize: '14px', color: colors.muted, padding: '12px 0' },
    lowRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #EEF0F2', fontSize: '14px' },
    lowBadge: { fontSize: '12px', fontWeight: '700', color: colors.amber, backgroundColor: colors.amberSoft, padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap' },
    outBadge: { fontSize: '12px', fontWeight: '700', color: colors.accent, backgroundColor: colors.accentSoft, padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap' },
    tile: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', border: `1px solid ${colors.border}`, borderRadius: '4px', backgroundColor: '#fff', cursor: 'pointer', textAlign: 'left', color: colors.ink },
    tileIcon: { width: '40px', height: '40px', borderRadius: '4px', backgroundColor: colors.brandSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    tileTitle: { display: 'block', fontSize: '15px', fontWeight: '700' },
    tileDesc: { display: 'block', fontSize: '13px', color: colors.muted },
};
