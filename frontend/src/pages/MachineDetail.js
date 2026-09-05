import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import { colors } from '../components/ui';
import * as ui from '../components/ui';

export default function MachineDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        API.get(`/machine-detail/${id}`)
            .then(res => setData(res.data))
            .catch(() => setError('Failed to load machine details'));
    }, [id]);

    if (error) return <Layout><div style={ui.alertError}>{error}</div></Layout>;
    if (!data) return <Layout><div style={{ color: colors.muted }}>Loading...</div></Layout>;

    return (
        <Layout>
            <div style={styles.head}>
                <button onClick={() => navigate('/machines')} style={ui.btnSecondary}>← All Machines</button>
                <div style={styles.machineCode}>{data.machine.code}</div>
            </div>

            <div style={styles.statGrid}>
                <div style={styles.stat}>
                    <div style={styles.statLabel}>DISTINCT PARTS USED</div>
                    <div style={styles.statValue}>{data.summary.distinct_parts}</div>
                </div>
                <div style={{ ...styles.stat, borderTop: `2px solid ${colors.accent}` }}>
                    <div style={styles.statLabel}>TOTAL EXPENSES</div>
                    <div style={styles.statValue}>₵{data.summary.total_expense.toLocaleString()}</div>
                </div>
                <div style={styles.stat}>
                    <div style={styles.statLabel}>EXPENSE RECORDS</div>
                    <div style={styles.statValue}>{data.summary.expense_count}</div>
                </div>
            </div>

            <div style={styles.twoCol}>
                <div style={ui.card}>
                    <div style={ui.cardTitle}>Parts Used (Summary)</div>
                    <table style={ui.table}>
                        <thead>
                            <tr><th style={ui.th}>Part</th><th style={ui.th}>Total Qty</th><th style={ui.th}>Times</th></tr>
                        </thead>
                        <tbody>
                            {data.parts_used.map((p, i) => (
                                <tr key={i} style={ui.tr}>
                                    <td style={ui.td}>{p.name}</td>
                                    <td style={ui.td}>{p.total_qty}</td>
                                    <td style={ui.td}>{p.times}</td>
                                </tr>
                            ))}
                            {data.parts_used.length === 0 && (
                                <tr><td colSpan="3" style={{ ...ui.td, textAlign: 'center', color: colors.muted }}>No parts used yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={ui.card}>
                    <div style={ui.cardTitle}>Recent Part Issues</div>
                    <table style={ui.table}>
                        <thead>
                            <tr><th style={ui.th}>Date</th><th style={ui.th}>Part</th><th style={ui.th}>Qty</th></tr>
                        </thead>
                        <tbody>
                            {data.recent_parts.map((p, i) => (
                                <tr key={i} style={ui.tr}>
                                    <td style={ui.td}>{p.date}</td>
                                    <td style={ui.td}>{p.name}</td>
                                    <td style={ui.td}>{p.quantity}</td>
                                </tr>
                            ))}
                            {data.recent_parts.length === 0 && (
                                <tr><td colSpan="3" style={{ ...ui.td, textAlign: 'center', color: colors.muted }}>No recent issues</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={ui.card}>
                <div style={ui.cardTitle}>Expenses for {data.machine.code}</div>
                <table style={ui.table}>
                    <thead>
                        <tr><th style={ui.th}>Date</th><th style={ui.th}>Description</th><th style={ui.th}>Amount (GHS)</th></tr>
                    </thead>
                    <tbody>
                        {data.expenses.map((e, i) => (
                            <tr key={i} style={ui.tr}>
                                <td style={ui.td}>{e.date}</td>
                                <td style={ui.td}>{e.description}</td>
                                <td style={ui.td}>{e.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                        {data.expenses.length === 0 && (
                            <tr><td colSpan="3" style={{ ...ui.td, textAlign: 'center', color: colors.muted }}>No expenses linked yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    head: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' },
    machineCode: { fontSize: '24px', fontWeight: '500', color: colors.ink, letterSpacing: '-0.5px' },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', backgroundColor: colors.border, border: `0.5px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' },
    stat: { backgroundColor: '#fff', padding: '18px 20px' },
    statLabel: { fontSize: '11px', color: colors.muted, marginBottom: '8px', letterSpacing: '0.3px' },
    statValue: { fontSize: '24px', fontWeight: '500', color: colors.ink, letterSpacing: '-0.5px', lineHeight: '1' },
    twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
};