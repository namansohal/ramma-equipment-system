import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getParts, getCurrentStock, createStockTxn, getMachines } from '../services/api';

export default function Stock() {
    const navigate = useNavigate();
    const [parts, setParts] = useState([]);
    const [machines, setMachines] = useState([]);
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [form, setForm] = useState({
        part_id: '',
        txn_date: new Date().toISOString().split('T')[0],
        direction: 'OUT',
        quantity: '',
        unit_price: '',
        machine_id: '',
        notes: '',
    });

    useEffect(() => {
        loadParts();
        loadMachines();
        loadStock();
    }, []);

    const loadParts = async () => {
        try {
            const res = await getParts();
            setParts(res.data);
        } catch (err) {
            console.error('Failed to load parts', err);
        }
    };

    const loadMachines = async () => {
        try {
            const res = await getMachines();
            setMachines(res.data);
        } catch (err) {
            console.error('Failed to load machines', err);
        }
    };

    const loadStock = async () => {
        try {
            const res = await getCurrentStock();
            setStock(res.data);
        } catch (err) {
            console.error('Failed to load stock', err);
        }
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
            const payload = {
                part_id: parseInt(form.part_id),
                txn_date: form.txn_date,
                direction: form.direction,
                quantity: parseFloat(form.quantity),
                unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
                total_amount: form.unit_price ? parseFloat(form.unit_price) * parseFloat(form.quantity) : null,
                machine_id: form.direction === 'OUT' && form.machine_id ? parseInt(form.machine_id) : null,
                notes: form.notes || null,
            };
            await createStockTxn(payload);
            setSuccess(form.direction === 'IN' ? 'Stock received successfully' : 'Part issued successfully');
            setForm(f => ({
                ...f,
                part_id: '',
                quantity: '',
                unit_price: '',
                machine_id: '',
                notes: '',
            }));
            loadStock();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save transaction');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={{ margin: 0 }}>Spare Parts / Stock</h2>
                <button onClick={() => navigate('/dashboard')} style={styles.back}>← Dashboard</button>
            </div>

            <div style={styles.formBox}>
                <h3>Stock Transaction</h3>
                {error && <div style={styles.error}>{error}</div>}
                {success && <div style={styles.success}>{success}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={styles.row}>
                        <div style={styles.field}>
                            <label style={styles.label}>Direction</label>
                            <select style={styles.input} name="direction" value={form.direction} onChange={handleChange} required>
                                <option value="OUT">OUT — Issue to machine</option>
                                <option value="IN">IN — Receive stock</option>
                            </select>
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Date</label>
                            <input style={styles.input} type="date" name="txn_date" value={form.txn_date} onChange={handleChange} required />
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Part</label>
                        <select style={styles.input} name="part_id" value={form.part_id} onChange={handleChange} required>
                            <option value="">Select part</option>
                            {parts.map(p => <option key={p.part_id} value={p.part_id}>{p.name}</option>)}
                        </select>
                    </div>

                    {form.direction === 'OUT' && (
                        <div style={styles.field}>
                            <label style={styles.label}>Issue to machine</label>
                            <select style={styles.input} name="machine_id" value={form.machine_id} onChange={handleChange} required>
                                <option value="">Select machine</option>
                                {machines.map(m => <option key={m.machine_id} value={m.machine_id}>{m.code}</option>)}
                            </select>
                        </div>
                    )}

                    <div style={styles.row}>
                        <div style={styles.field}>
                            <label style={styles.label}>Quantity</label>
                            <input style={styles.input} type="number" name="quantity" value={form.quantity} onChange={handleChange} min="0" step="0.01" required />
                        </div>
                        <div style={styles.field}>
                            <label style={styles.label}>Unit Price (GHS)</label>
                            <input style={styles.input} type="number" name="unit_price" value={form.unit_price} onChange={handleChange} min="0" step="0.01" />
                        </div>
                    </div>

                    <div style={styles.field}>
                        <label style={styles.label}>Notes (optional)</label>
                        <input style={styles.input} type="text" name="notes" value={form.notes} onChange={handleChange} />
                    </div>

                    <button style={loading ? styles.btnDisabled : styles.btn} type="submit" disabled={loading}>
                        {loading ? 'Saving...' : (form.direction === 'IN' ? 'Receive Stock' : 'Issue Part')}
                    </button>
                </form>
            </div>

            <div style={styles.tableBox}>
                <h3>Current Stock</h3>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Part</th>
                            <th style={styles.th}>Available</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stock.map(s => (
                            <tr key={s.part_id} style={styles.tr}>
                                <td style={styles.td}>{s.name}</td>
                                <td style={styles.td}>{parseFloat(s.available).toLocaleString()}</td>
                            </tr>
                        ))}
                        {stock.length === 0 && (
                            <tr><td colSpan="2" style={{ textAlign: 'center', padding: '24px', color: '#999' }}>No stock recorded yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const styles = {
    container: { padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    back: { padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer' },
    formBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', marginBottom: '24px' },
    tableBox: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    field: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '4px', fontWeight: '500', color: '#333' },
    input: { width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' },
    btn: { padding: '10px 24px', backgroundColor: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
    btnDisabled: { padding: '10px 24px', backgroundColor: '#91caff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'not-allowed', fontSize: '14px' },
    error: { backgroundColor: '#fff2f0', border: '1px solid #ffccc7', color: '#cf1322', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px' },
    success: { backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', color: '#389e0d', padding: '8px 12px', borderRadius: '4px', marginBottom: '16px' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0', fontWeight: '600', color: '#555' },
    tr: { borderBottom: '1px solid #f0f0f0' },
    td: { padding: '12px', color: '#333' },
};