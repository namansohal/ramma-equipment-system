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

    const profitPositive = data.summary.profit >= 0;

    return (
        <Layout>
            <div style={styles.head}>
                <button onClick={() => navigate('/machines')} style={ui.btnSecondary}>← All Machines</button>
                <h2 style={styles.machineCode}>{data.machine.code}</h2>
            </div>

            <div style={styles.statGrid}>
                <div style={styles.stat}>
                    <div style={styles.statLabel}>Distinct parts used</div>
                    <div style={styles.statValue}>{data.summary.distinct_parts}</div>
                </div>
                <div style={styles.stat}>
                    <div style={styles.statLabel}>Total income</div>
                    <div style={styles.statValue}>₵{data.summary.total_income.toLocaleString()}</div>
                </div>
                <div style={{ ...styles.stat, borderTopColor: colors.accent }}>
                    <div style={styles.statLabel}>Total expenses</div>
                    <div style={styles.statValue}>₵{data.summary.total_expense.toLocaleString()}</div>
                </div>
                <div style={{ ...styles.stat, borderTopColor: profitPositive ? '#15803D' : colors.accent }}>
                    <div style={styles.statLabel}>Profit</div>
                    <div style={{ ...styles.statValue, color: profitPositive ? colors.green : colors.accent }}>
                        ₵{data.summary.profit.toLocaleString()}
                    </div>
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
                <div style={ui.cardTitle}>Expenses & Costs for {data.machine.code}</div>
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
    machineCode: { margin: 0, fontFamily: ui.condensed, fontSize: '36px', fontWeight: '700', color: colors.ink, lineHeight: 1 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' },
    stat: ui.stat,
    statLabel: ui.statLabel,
    statValue: ui.statValue,
    twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' },
};