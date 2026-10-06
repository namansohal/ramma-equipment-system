import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import API from '../services/api';
import * as ui from '../components/ui';

const { colors } = ui;

const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const money = (n) => `${n < 0 ? '−' : ''}₵${Math.abs(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const METHODS = [['cash', 'Cash'], ['momo', 'MOMO'], ['bank', 'Bank transfer'], ['cheque', 'Cheque'], ['other', 'Other']];

export default function Customers() {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState(null);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ customer_name: '', amount: '', txn_date: localToday(), method: 'cash', notes: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = () => API.get('/customers/').then(r => setCustomers(r.data)).catch(e => setError(e.response?.data?.detail || 'Failed to load customers'));
    useEffect(() => { load(); }, []);

    const submit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        setSaving(true);
        try {
            await API.post('/customers/payments', { ...form, amount: parseFloat(form.amount) });
            setSuccess(`Payment of ${money(parseFloat(form.amount))} from ${form.customer_name.trim()} recorded`);
            setForm(f => ({ ...f, customer_name: '', amount: '', notes: '' }));
            load();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to record payment');
        } finally {
            setSaving(false);
        }
    };

    const list = customers || [];
    const shown = list.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()));
    const totalOwed = list.reduce((s, c) => s + Math.max(c.owed, 0), 0);
    const owing = list.filter(c => c.owed > 0).length;
    const totalBilled = list.reduce((s, c) => s + c.billed, 0);
    const totalPaid = list.reduce((s, c) => s + c.paid, 0);
    const open = (c) => navigate(`/customers/${encodeURIComponent(c.key)}`);

    return (
        <Layout>
            <div className="rs-stats">
                <div style={{ ...ui.stat, borderTopColor: colors.accent }}>
                    <div style={ui.statLabel}>Owed to you</div>
                    <div style={{ ...ui.statValue, color: totalOwed > 0 ? colors.accent : colors.ink }}>{customers ? money(totalOwed) : '—'}</div>
                    <div style={styles.note}>{customers ? `${owing} customer${owing === 1 ? '' : 's'} owing` : ''}</div>
                </div>
                <div style={ui.stat}>
                    <div style={ui.statLabel}>Billed (all time)</div>
                    <div style={ui.statValue}>{customers ? money(totalBilled) : '—'}</div>
                </div>
                <div style={{ ...ui.stat, borderTopColor: '#15803D' }}>
                    <div style={ui.statLabel}>Paid (all time)</div>
                    <div style={{ ...ui.statValue, color: colors.green }}>{customers ? money(totalPaid) : '—'}</div>
                </div>
            </div>

            <div className="rs-two" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)' }}>
                <div style={ui.card}>
                    <div style={styles.cardHead}>
                        <h2 style={{ ...ui.cardTitle, marginBottom: 0 }}>Customers</h2>
                        <input type="search" placeholder="Search customers" aria-label="Search customers" value={search}
                            onChange={e => setSearch(e.target.value)} style={{ ...ui.input, width: '220px', minHeight: '40px' }} />
                    </div>
                    {!customers ? (
                        <div style={styles.empty}>Loading...</div>
                    ) : shown.length === 0 ? (
                        <div style={styles.empty}>{list.length ? 'No customer matches that search' : 'No customers yet — they appear here once a runtime entry has a customer name.'}</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={ui.table}>
                                <thead>
                                    <tr>
                                        <th style={ui.th}>Customer</th>
                                        <th style={{ ...ui.th, ...styles.num }}>Jobs</th>
                                        <th style={{ ...ui.th, ...styles.num }}>Billed</th>
                                        <th style={{ ...ui.th, ...styles.num }}>Paid</th>
                                        <th style={{ ...ui.th, ...styles.num }}>Owed</th>
                                        <th style={ui.th}>Last activity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shown.map(c => (
                                        <tr key={c.key} style={ui.tr}>
                                            <td style={ui.td}>
                                                <button type="button" style={styles.name} onClick={() => open(c)}>{c.name}</button>
                                            </td>
                                            <td style={{ ...ui.td, ...styles.num }}>{c.jobs}</td>
                                            <td style={{ ...ui.td, ...styles.num }}>{money(c.billed)}</td>
                                            <td style={{ ...ui.td, ...styles.num, color: colors.green }}>{money(c.paid)}</td>
                                            <td style={{ ...ui.td, ...styles.num }}>
                                                {c.owed > 0 ? <span style={styles.owedPill}>{money(c.owed)}</span>
                                                    : c.owed < 0 ? <span style={styles.creditPill} title="Paid more than billed">{money(-c.owed)} credit</span>
                                                        : <span style={styles.paidPill}>Paid up</span>}
                                            </td>
                                            <td style={{ ...ui.td, color: colors.muted, whiteSpace: 'nowrap' }}>{c.last_date || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div style={ui.card}>
                    <h2 style={ui.cardTitle}>Record a payment</h2>
                    {error && <div style={ui.alertError}>{error}</div>}
                    {success && <div style={ui.alertSuccess}>{success}</div>}
                    <form onSubmit={submit} style={styles.form}>
                        <div>
                            <label style={ui.label} htmlFor="pay-customer">Customer</label>
                            <input id="pay-customer" list="customer-names" style={ui.input} value={form.customer_name} required
                                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Customer / site name" />
                            <datalist id="customer-names">
                                {list.map(c => <option key={c.key} value={c.name} />)}
                            </datalist>
                        </div>
                        <div style={styles.row2}>
                            <div>
                                <label style={ui.label} htmlFor="pay-amount">Amount (GHS)</label>
                                <input id="pay-amount" type="number" min="0.01" step="0.01" style={ui.input} value={form.amount} required
                                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                            </div>
                            <div>
                                <label style={ui.label} htmlFor="pay-date">Date</label>
                                <input id="pay-date" type="date" style={ui.input} value={form.txn_date} required
                                    onChange={e => setForm(f => ({ ...f, txn_date: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <label style={ui.label} htmlFor="pay-method">Paid by</label>
                            <select id="pay-method" style={ui.input} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                                {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={ui.label} htmlFor="pay-notes">Notes (optional)</label>
                            <input id="pay-notes" style={ui.input} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. receipt no., for which job" />
                        </div>
                        <button type="submit" style={saving ? ui.btnDisabled : ui.btn} disabled={saving}>{saving ? 'Saving...' : 'Record payment'}</button>
                        <p style={styles.note}>This tracks what each customer owes. It does not add money to the Mainbook — record cash there as usual.</p>
                    </form>
                </div>
            </div>
        </Layout>
    );
}

const pill = { fontSize: '12px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap' };
const styles = {
    cardHead: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px' },
    num: { textAlign: 'right', whiteSpace: 'nowrap' },
    name: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: colors.ink, fontWeight: 600, fontSize: '15px', textAlign: 'left', textDecoration: 'underline', textUnderlineOffset: '3px' },
    owedPill: { ...pill, backgroundColor: colors.accentSoft, color: colors.accent },
    paidPill: { ...pill, backgroundColor: colors.greenSoft, color: colors.green },
    creditPill: { ...pill, backgroundColor: '#E6EEFB', color: '#1D4ED8' },
    form: { display: 'flex', flexDirection: 'column', gap: '14px' },
    row2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' },
    note: { margin: 0, fontSize: '13px', color: colors.muted, lineHeight: 1.5 },
    empty: { fontSize: '14px', color: colors.muted, padding: '12px 0' },
};
