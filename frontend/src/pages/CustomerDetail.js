import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import * as ui from '../components/ui';
import { money } from './Customers';
import useSiteName from '../components/useSite';

const { colors } = ui;

export default function CustomerDetail() {
    const { key } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const site = useSiteName();

    const load = () => API.get('/customers/detail', { params: { key } })
        .then(r => setData(r.data))
        .catch(e => setError(e.response?.data?.detail || 'Failed to load customer'));
    useEffect(() => { load(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- reload when the customer changes

    const deletePayment = async (id) => {
        try {
            await API.delete(`/customers/payments/${id}`);
            setConfirmId(null);
            load();
        } catch (e) {
            setError(e.response?.data?.detail || 'Failed to delete payment');
        }
    };

    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <Layout>
            <div className="no-print" style={styles.toolbar}>
                <button type="button" style={ui.btnSecondary} onClick={() => navigate('/customers')}>← All customers</button>
                <button type="button" style={ui.btn} onClick={() => window.print()} disabled={!data}>Print statement</button>
            </div>

            {error && <div style={ui.alertError}>{error}</div>}
            {!data && !error && <div style={styles.empty}>Loading...</div>}

            {data && (
                <div style={ui.card} className="print-sheet">
                    <div style={styles.header}>
                        <div>
                            <div className="rs-eyebrow">Statement of account</div>
                            <h2 style={styles.name}>{data.name}</h2>
                            <div style={styles.meta}>Ramma Equipment Co.{site ? ` · ${site}` : ''} · {today}</div>
                        </div>
                        <div style={styles.totals}>
                            <div><span style={styles.k}>Billed</span><span style={styles.v}>{money(data.billed)}</span></div>
                            <div><span style={styles.k}>Paid</span><span style={{ ...styles.v, color: colors.green }}>{money(data.paid)}</span></div>
                            <div style={styles.owedBox}>
                                <span style={styles.k}>{data.owed >= 0 ? 'Amount owed' : 'In credit'}</span>
                                <span style={{ ...styles.v, fontSize: '28px', color: data.owed > 0 ? colors.accent : colors.ink }}>{money(Math.abs(data.owed))}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={ui.table}>
                            <thead>
                                <tr>
                                    <th style={ui.th}>Date</th>
                                    <th style={ui.th}>Machine</th>
                                    <th style={ui.th}>Details</th>
                                    <th style={{ ...ui.th, ...styles.num }}>Hours</th>
                                    <th style={{ ...ui.th, ...styles.num }}>Billed</th>
                                    <th style={{ ...ui.th, ...styles.num }}>Paid</th>
                                    <th style={{ ...ui.th, ...styles.num }}>Owed</th>
                                    <th style={ui.th} className="no-print" />
                                </tr>
                            </thead>
                            <tbody>
                                {data.lines.map(l => (
                                    <tr key={`${l.kind}-${l.id}`} style={ui.tr}>
                                        <td style={{ ...ui.td, whiteSpace: 'nowrap' }}>{l.date}</td>
                                        <td style={{ ...ui.td, fontFamily: ui.condensed, fontWeight: 700, fontSize: '16px' }}>{l.machine || ''}</td>
                                        <td style={ui.td}>{l.kind === 'payment' ? <span style={styles.payTag}>{l.description}</span> : l.description}</td>
                                        <td style={{ ...ui.td, ...styles.num }}>{l.hours != null ? l.hours.toLocaleString() : ''}</td>
                                        <td style={{ ...ui.td, ...styles.num }}>{l.billed ? money(l.billed) : ''}</td>
                                        <td style={{ ...ui.td, ...styles.num, color: colors.green }}>{l.paid ? money(l.paid) : ''}</td>
                                        <td style={{ ...ui.td, ...styles.num, fontWeight: 600 }}>{money(l.owed)}</td>
                                        <td style={{ ...ui.td, textAlign: 'right' }} className="no-print">
                                            {l.kind === 'payment' && (confirmId === l.id ? (
                                                <span style={styles.confirm}>
                                                    <button type="button" style={styles.yes} onClick={() => deletePayment(l.id)}>Delete</button>
                                                    <button type="button" style={styles.no} onClick={() => setConfirmId(null)}>Cancel</button>
                                                </span>
                                            ) : (
                                                <button type="button" style={styles.del} onClick={() => setConfirmId(l.id)}>Delete</button>
                                            ))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p style={styles.footnote}>Billed amounts come from runtime entries for this customer. Payments are recorded on the Customers page.</p>
                </div>
            )}
        </Layout>
    );
}

const small = { padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' };
const styles = {
    toolbar: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '10px', marginBottom: '20px' },
    header: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' },
    name: { margin: '2px 0 4px', fontFamily: ui.condensed, fontSize: '34px', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.05 },
    meta: { fontSize: '14px', color: colors.muted },
    totals: { display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-end' },
    k: { display: 'block', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted },
    v: { display: 'block', fontFamily: ui.condensed, fontWeight: 700, fontSize: '22px' },
    owedBox: { borderLeft: `4px solid ${colors.brand}`, paddingLeft: '12px' },
    num: { textAlign: 'right', whiteSpace: 'nowrap' },
    payTag: { fontWeight: 600, color: colors.green },
    confirm: { display: 'inline-flex', gap: '6px' },
    del: { ...small, backgroundColor: '#fff', color: colors.accent, border: '1px solid #F1B8B2' },
    yes: { ...small, backgroundColor: colors.accent, color: '#fff', border: 'none' },
    no: { ...small, backgroundColor: '#fff', color: colors.ink, border: `1px solid ${colors.borderStrong}` },
    footnote: { margin: '14px 0 0', fontSize: '13px', color: colors.muted },
    empty: { fontSize: '14px', color: colors.muted, padding: '12px 0' },
};
