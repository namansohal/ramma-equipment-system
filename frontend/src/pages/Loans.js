import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import StyledSelect from '../components/StyledSelect';
import { getBorrowers, getLoans, createLoan, repayLoan, isViewer } from '../services/api';
import * as ui from '../components/ui';

export default function Loans() {
    const viewer = isViewer();
    const [borrowers, setBorrowers] = useState([]);
    const [loans, setLoans] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [repayId, setRepayId] = useState(null);
    const [repayForm, setRepayForm] = useState({ amount: '', paid_date: new Date().toISOString().split('T')[0] });
    const [form, setForm] = useState({
        user_id: '',
        amount: '',
        issued_date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    useEffect(() => {
        loadLoans();
        if (!viewer) loadBorrowers();
    }, []);

    const loadBorrowers = async () => {
        try { const res = await getBorrowers(); setBorrowers(res.data); } catch (e) { console.error(e); }
    };
    const loadLoans = async () => {
        try { const res = await getLoans(); setLoans(res.data); } catch (e) { console.error(e); }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await createLoan({
                user_id: parseInt(form.user_id),
                amount: parseFloat(form.amount),
                issued_date: form.issued_date,
                notes: form.notes || null,
            });
            setSuccess('Loan recorded');
            setForm(f => ({ ...f, user_id: '', amount: '', notes: '' }));
            loadLoans();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to record loan');
        } finally {
            setLoading(false);
        }
    };

    const submitRepay = async (loanId) => {
        setError('');
        setSuccess('');
        try {
            await repayLoan(loanId, {
                amount: parseFloat(repayForm.amount),
                paid_date: repayForm.paid_date,
            });
            setSuccess('Repayment recorded');
            setRepayId(null);
            setRepayForm({ amount: '', paid_date: new Date().toISOString().split('T')[0] });
            loadLoans();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to record repayment');
        }
    };

    const borrowerOptions = borrowers.map(b => ({ value: b.user_id, label: b.full_name }));

    return (
        <Layout>
            {!viewer && (
                <div style={ui.card}>
                    <div style={ui.cardTitle}>Give a Loan</div>
                    {error && <div style={ui.alertError}>{error}</div>}
                    {success && <div style={ui.alertSuccess}>{success}</div>}
                    <form onSubmit={handleSubmit}>
                        <div style={ui.row2}>
                            <div style={ui.field}>
                                <label style={ui.label}>Employee</label>
                                <StyledSelect options={borrowerOptions} value={form.user_id} onChange={(v) => setForm(f => ({ ...f, user_id: v }))} placeholder="Select employee" />
                            </div>
                            <div style={ui.field}>
                                <label style={ui.label}>Amount (GHS)</label>
                                <input style={ui.input} type="number" name="amount" value={form.amount} onChange={handleChange} min="0" step="0.01" required />
                            </div>
                        </div>
                        <div style={ui.row2}>
                            <div style={ui.field}>
                                <label style={ui.label}>Date</label>
                                <input style={ui.input} type="date" name="issued_date" value={form.issued_date} onChange={handleChange} required />
                            </div>
                            <div style={ui.field}>
                                <label style={ui.label}>Notes (optional)</label>
                                <input style={ui.input} type="text" name="notes" value={form.notes} onChange={handleChange} />
                            </div>
                        </div>
                        <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Record Loan'}
                        </button>
                    </form>
                </div>
            )}

            <div style={ui.card}>
                <div style={ui.cardTitle}>Loans</div>
                {viewer && error && <div style={ui.alertError}>{error}</div>}
                {viewer && success && <div style={ui.alertSuccess}>{success}</div>}
                <table style={ui.table}>
                    <thead>
                        <tr>
                            <th style={ui.th}>Employee</th>
                            <th style={ui.th}>Amount</th>
                            <th style={ui.th}>Paid</th>
                            <th style={ui.th}>Remaining</th>
                            <th style={ui.th}>Date</th>
                            <th style={ui.th}>Status</th>
                            <th style={ui.th}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loans.map(l => (
                            <tr key={l.loan_id} style={ui.tr}>
                                <td style={ui.td}>{l.borrower}</td>
                                <td style={ui.td}>{l.amount.toLocaleString()}</td>
                                <td style={ui.td}>{l.paid.toLocaleString()}</td>
                                <td style={ui.td}>{l.remaining.toLocaleString()}</td>
                                <td style={ui.td}>{l.issued_date}</td>
                                <td style={ui.td}>
                                    {l.settled
                                        ? <span style={styles.settled}>Settled</span>
                                        : <span style={styles.pending}>Pending</span>}
                                </td>
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {!viewer && !l.settled && (
                                        repayId === l.loan_id ? (
                                            <span style={styles.repayWrap}>
                                                <input type="number" placeholder="Amount" value={repayForm.amount}
                                                    onChange={e => setRepayForm(f => ({ ...f, amount: e.target.value }))}
                                                    style={styles.repayInput} min="0" step="0.01" />
                                                <button onClick={() => submitRepay(l.loan_id)} style={styles.saveBtn}>Save</button>
                                                <button onClick={() => setRepayId(null)} style={styles.cancelBtn}>×</button>
                                            </span>
                                        ) : (
                                            <button onClick={() => { setRepayId(l.loan_id); setRepayForm({ amount: '', paid_date: new Date().toISOString().split('T')[0] }); }} style={styles.repayBtn}>Repay</button>
                                        )
                                    )}
                                </td>
                            </tr>
                        ))}
                        {loans.length === 0 && (
                            <tr><td colSpan="7" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No loans recorded</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    settled: { fontSize: '12px', fontWeight: '500', color: '#15803d', backgroundColor: '#f0fdf4', padding: '2px 10px', borderRadius: '20px' },
    pending: { fontSize: '12px', fontWeight: '500', color: ui.colors.accent, backgroundColor: ui.colors.accentSoft, padding: '2px 10px', borderRadius: '20px' },
    repayBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.ink, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    repayWrap: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
    repayInput: { padding: '5px 8px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '90px' },
    saveBtn: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    cancelBtn: { padding: '5px 9px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
};