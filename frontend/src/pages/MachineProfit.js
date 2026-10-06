import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import * as ui from '../components/ui';

const { colors } = ui;
const PROFIT = '#1D4ED8'; // blue / red pair: passes colour-blind separation checks
const LOSS = colors.accent;

const thisMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthRange = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return { from_date: `${ym}-01`, to_date: `${ym}-${String(last).padStart(2, '0')}` };
};

const money = (n) => `${n < 0 ? '−' : ''}₵${Math.abs(Math.round(n)).toLocaleString()}`;

export default function MachineProfit() {
    const navigate = useNavigate();
    const [month, setMonth] = useState(thisMonth());
    const [allTime, setAllTime] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const params = allTime ? {} : monthRange(month);

    useEffect(() => {
        setData(null);
        setError('');
        API.get('/reports/machine-profit', { params })
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.data?.detail || 'Failed to load report'));
    }, [month, allTime]); // eslint-disable-line react-hooks/exhaustive-deps -- params derives from these

    const download = async () => {
        try {
            const res = await API.get('/reports/export/machine-profit', { params, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `machine_profit_${allTime ? 'all_time' : month}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            setError('Failed to download Excel');
        }
    };

    const rows = data?.rows || [];
    const totals = data?.totals;
    const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.profit)));
    const best = rows.length ? rows.reduce((a, b) => (b.profit > a.profit ? b : a)) : null;
    const worst = rows.length ? rows.reduce((a, b) => (b.profit < a.profit ? b : a)) : null;
    const periodLabel = allTime ? 'All time' : new Date(`${month}-01T00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    return (
        <Layout>
            <div style={styles.toolbar}>
                <div style={styles.period}>
                    <label htmlFor="mp-month" style={{ ...ui.label, marginBottom: 0 }}>Month</label>
                    <input id="mp-month" type="month" value={month} disabled={allTime}
                        onChange={e => e.target.value && setMonth(e.target.value)}
                        style={{ ...ui.input, width: 'auto', opacity: allTime ? 0.5 : 1 }} />
                    <button type="button" style={allTime ? styles.tabOn : styles.tab} onClick={() => setAllTime(v => !v)}>All time</button>
                </div>
                <button type="button" style={ui.btn} onClick={download} disabled={!data}>Download Excel</button>
            </div>

            {error && <div style={ui.alertError}>{error}</div>}

            <div className="rs-stats">
                <div style={{ ...ui.stat, borderTopColor: '#15803D' }}>
                    <div style={ui.statLabel}>Received</div>
                    <div style={{ ...ui.statValue, color: colors.green }}>{totals ? money(totals.received) : '—'}</div>
                    <div style={styles.statNote}>Billed {totals ? money(totals.billed) : '—'}</div>
                </div>
                <div style={{ ...ui.stat, borderTopColor: colors.accent }}>
                    <div style={ui.statLabel}>Costs</div>
                    <div style={ui.statValue}>{totals ? money(totals.cost) : '—'}</div>
                    <div style={styles.statNote}>Expenses {totals ? money(totals.expenses) : '—'} · Parts {totals ? money(totals.parts) : '—'}</div>
                </div>
                <div style={{ ...ui.stat, borderTopColor: colors.brand }}>
                    <div style={ui.statLabel}>Profit</div>
                    <div style={{ ...ui.statValue, color: totals && totals.profit < 0 ? LOSS : colors.ink }}>{totals ? money(totals.profit) : '—'}</div>
                    <div style={styles.statNote}>{periodLabel}</div>
                </div>
                <div style={ui.stat}>
                    <div style={ui.statLabel}>Best / worst</div>
                    <div style={ui.statValue}>{best && rows.some(r => r.profit || r.cost) ? `${best.machine} / ${worst.machine}` : '—'}</div>
                    <div style={styles.statNote}>by profit</div>
                </div>
            </div>

            <div style={ui.card}>
                <h2 style={ui.cardTitle}>Profit by machine — {periodLabel}</h2>
                {!data && !error ? (
                    <div style={styles.empty}>Loading...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={ui.table}>
                            <thead>
                                <tr>
                                    <th style={ui.th}>Machine</th>
                                    <th style={{ ...ui.th, ...styles.num }}>Hours</th>
                                    <th style={{ ...ui.th, ...styles.num }}>Billed</th>
                                    <th style={{ ...ui.th, ...styles.num }}>Received</th>
                                    <th style={{ ...ui.th, ...styles.num }}>Costs</th>
                                    <th style={{ ...ui.th, ...styles.num }}>Profit</th>
                                    <th style={{ ...ui.th, minWidth: '220px' }}>
                                        <span style={styles.legend}>
                                            <span><span style={{ ...styles.swatch, backgroundColor: LOSS }} />Loss</span>
                                            <span><span style={{ ...styles.swatch, backgroundColor: PROFIT }} />Profit</span>
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => {
                                    const pct = (Math.abs(r.profit) / maxAbs) * 50;
                                    const tip = `${r.machine}: received ${money(r.received)} − expenses ${money(r.expenses)} − parts ${money(r.parts)} = ${money(r.profit)}`;
                                    return (
                                        <tr key={r.machine_id} style={ui.tr}>
                                            <td style={ui.td}>
                                                <button type="button" style={styles.machine} onClick={() => navigate(`/machines/${r.machine_id}`)}>{r.machine}</button>
                                            </td>
                                            <td style={{ ...ui.td, ...styles.num }}>{r.hours ? r.hours.toLocaleString() : '—'}</td>
                                            <td style={{ ...ui.td, ...styles.num }}>{money(r.billed)}</td>
                                            <td style={{ ...ui.td, ...styles.num }}>{money(r.received)}</td>
                                            <td style={{ ...ui.td, ...styles.num }} title={`Expenses ${money(r.expenses)} · Parts ${money(r.parts)}`}>{money(r.cost)}</td>
                                            <td style={{ ...ui.td, ...styles.num, fontWeight: 700, color: r.profit < 0 ? LOSS : colors.ink }}>{money(r.profit)}</td>
                                            <td style={ui.td} title={tip}>
                                                <div style={styles.track} aria-hidden="true">
                                                    <div style={styles.mid} />
                                                    {r.profit !== 0 && (
                                                        <div style={{
                                                            ...styles.bar,
                                                            width: `${pct}%`,
                                                            backgroundColor: r.profit < 0 ? LOSS : PROFIT,
                                                            ...(r.profit < 0
                                                                ? { right: '50%', borderRadius: '4px 0 0 4px' }
                                                                : { left: '50%', borderRadius: '0 4px 4px 0' }),
                                                        }} />
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {totals && (
                                    <tr>
                                        <td style={{ ...ui.td, ...styles.totalCell }}>Total</td>
                                        <td style={{ ...ui.td, ...styles.num, ...styles.totalCell }}>{totals.hours.toLocaleString()}</td>
                                        <td style={{ ...ui.td, ...styles.num, ...styles.totalCell }}>{money(totals.billed)}</td>
                                        <td style={{ ...ui.td, ...styles.num, ...styles.totalCell }}>{money(totals.received)}</td>
                                        <td style={{ ...ui.td, ...styles.num, ...styles.totalCell }}>{money(totals.cost)}</td>
                                        <td style={{ ...ui.td, ...styles.num, ...styles.totalCell, color: totals.profit < 0 ? LOSS : colors.ink }}>{money(totals.profit)}</td>
                                        <td style={{ ...ui.td, ...styles.totalCell }} />
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                <p style={styles.note}>
                    Profit = money received for the machine (mainbook payments tagged to it) minus its expenses and spare-part costs.
                    “Billed” is the runtime amount charged, whether paid yet or not. An expense tagged to several machines is split evenly between them.
                </p>
            </div>
        </Layout>
    );
}

const styles = {
    toolbar: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' },
    period: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' },
    tab: { ...ui.btnSecondary, minHeight: '44px' },
    tabOn: { ...ui.btnSecondary, minHeight: '44px', backgroundColor: colors.ink, color: '#fff', borderColor: colors.ink },
    statNote: { fontSize: '13px', color: colors.muted },
    num: { textAlign: 'right', whiteSpace: 'nowrap' },
    machine: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: ui.condensed, fontWeight: 700, fontSize: '18px', color: colors.ink, textDecoration: 'underline', textUnderlineOffset: '3px' },
    track: { position: 'relative', height: '12px', minWidth: '200px' },
    mid: { position: 'absolute', left: '50%', top: '-4px', bottom: '-4px', width: '1px', backgroundColor: colors.borderStrong },
    bar: { position: 'absolute', top: 0, height: '12px' },
    legend: { display: 'flex', gap: '14px', justifyContent: 'center', textTransform: 'none', letterSpacing: 0, fontWeight: 600 },
    swatch: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', marginRight: '6px', verticalAlign: '-1px' },
    totalCell: { fontWeight: 700, borderTop: `2px solid ${colors.border}` },
    empty: { fontSize: '14px', color: colors.muted, padding: '12px 0' },
    note: { margin: '14px 0 0', fontSize: '13px', color: colors.muted, lineHeight: 1.5 },
};
