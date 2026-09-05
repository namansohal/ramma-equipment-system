import React, { useState } from 'react';
import Layout from '../components/Layout';
import API from '../services/api';
import * as ui from '../components/ui';

export default function Reports() {
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [active, setActive] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const reports = [
        { key: 'expenses', label: 'Expense Summary', dated: true },
        { key: 'machine-cost', label: 'Machine Cost Report', dated: true },
        { key: 'stock', label: 'Stock Report', dated: false },
        { key: 'mainbook', label: 'Mainbook Ledger', dated: true },
    ];

    const runReport = async (key) => {
        setActive(key);
        setData(null);
        setError('');
        setLoading(true);
        try {
            const params = {};
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;
            const res = await API.get(`/reports/${key}`, { params });
            setData(res.data);
        } catch (err) {
            setError('Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    const downloadExcel = async (key) => {
        try {
            const params = {};
            if (fromDate) params.from_date = fromDate;
            if (toDate) params.to_date = toDate;
            const res = await API.get(`/reports/export/${key}`, { params, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${key}_report.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError('Failed to download Excel');
        }
    };

    const renderTable = () => {
        if (!data || !data.rows || data.rows.length === 0) {
            return <div style={{ color: ui.colors.muted, padding: '16px 0' }}>No data for this report.</div>;
        }
        const cols = Object.keys(data.rows[0]);
        return (
            <table style={ui.table}>
                <thead>
                    <tr>{cols.map(c => <th key={c} style={ui.th}>{c.replace('_', ' ')}</th>)}</tr>
                </thead>
                <tbody>
                    {data.rows.map((r, i) => (
                        <tr key={i} style={ui.tr}>
                            {cols.map(c => (
                                <td key={c} style={ui.td}>
                                    {typeof r[c] === 'number' ? r[c].toLocaleString() : r[c]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>Date Range (optional)</div>
                <div style={ui.row2}>
                    <div style={ui.field}>
                        <label style={ui.label}>From</label>
                        <input style={ui.input} type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>To</label>
                        <input style={ui.input} type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                    </div>
                </div>
                <div style={styles.reportRow}>
                    {reports.map(r => (
                        <button key={r.key} onClick={() => runReport(r.key)}
                            style={active === r.key ? styles.reportBtnActive : styles.reportBtn}>
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div style={ui.alertError}>{error}</div>}

            {active && (
                <div style={ui.card}>
                    <div style={styles.resultHead}>
                        <div style={ui.cardTitle}>{reports.find(r => r.key === active)?.label}</div>
                        <button onClick={() => downloadExcel(active)} style={ui.btn}>⬇ Download Excel</button>
                    </div>
                    {data && data.total !== undefined && (
                        <div style={styles.totalBar}>Total: ₵{data.total.toLocaleString()} · {data.count} records</div>
                    )}
                    {loading ? <div style={{ color: ui.colors.muted }}>Loading...</div> : renderTable()}
                </div>
            )}
        </Layout>
    );
}

const styles = {
    reportRow: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' },
    reportBtn: { padding: '10px 18px', backgroundColor: '#fff', color: ui.colors.ink, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    reportBtnActive: { padding: '10px 18px', backgroundColor: ui.colors.accentSoft, color: ui.colors.accent, border: `0.5px solid ${ui.colors.accent}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    resultHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    totalBar: { fontSize: '13px', color: ui.colors.inkSoft, marginBottom: '16px', fontWeight: '500' },
};