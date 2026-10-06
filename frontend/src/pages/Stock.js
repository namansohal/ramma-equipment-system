import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import PartPicker from '../components/PartPicker';
import ChipSelect from '../components/ChipSelect';
import { getParts, getCurrentStock, getStockHistory, createStockTxn, deleteStockTxn, purchaseSparePart, getPurchaseHistory, getMachines, extractReceipt, isViewer } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import * as ui from '../components/ui';

export default function Stock() {
    const viewer = isViewer();
    const [parts, setParts] = useState([]);
    const [machines, setMachines] = useState([]);
    const [stock, setStock] = useState([]);
    const [history, setHistory] = useState([]);
    const [mode, setMode] = useState('issue');
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmId, setConfirmId] = useState(null);
    const [priceHistory, setPriceHistory] = useState(null);
    const [reviewRows, setReviewRows] = useState(null);
    const [savingReview, setSavingReview] = useState(false);
    const fileInputRef = useRef(null);

    const [issueForm, setIssueForm] = useState({
        part_id: '', txn_date: new Date().toISOString().split('T')[0],
        direction: 'OUT', quantity: '', machine_id: '', notes: '',
    });
    const [buyForm, setBuyForm] = useState({
        part_id: '', quantity: '', unit_price: '', txn_date: new Date().toISOString().split('T')[0],
        supplier: '', notes: '',
    });

    useEffect(() => {
        loadParts(); loadMachines(); loadStock(); loadHistory();
    }, []);

    const loadParts = async () => { try { const r = await getParts(); setParts(r.data); } catch (e) { console.error(e); } };
    const loadMachines = async () => { try { const r = await getMachines(); setMachines(r.data); } catch (e) { console.error(e); } };
    const loadStock = async () => { try { const r = await getCurrentStock(); setStock(r.data); } catch (e) { console.error(e); } };
    const loadHistory = async () => { try { const r = await getStockHistory(); setHistory(r.data); } catch (e) { console.error(e); } };

    const refreshAll = () => { loadStock(); loadHistory(); };

    const handleBuyPartChange = async (partId) => {
        setBuyForm(f => ({ ...f, part_id: partId }));
        setPriceHistory(null);
        if (partId) {
            try {
                const res = await getPurchaseHistory(partId);
                setPriceHistory(res.data);
            } catch (e) { console.error(e); }
        }
    };

    const handleReceiptUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setExtracting(true);
        setError(''); setSuccess(''); setReviewRows(null);
        try {
            const res = await extractReceipt(file, 'spare_parts');
            const rows = res.data.rows || [];
            if (rows.length === 0) {
                setError('Could not read any details from that photo. Try a clearer photo.');
            } else {
                const partNameMap = {};
                parts.forEach(p => {
                    partNameMap[p.name.toLowerCase().trim()] = p.part_id;
                });

                const prepared = rows.map((r, i) => {
                    const itemLower = (r.item || '').toLowerCase().trim();
                    const matchedPartId = partNameMap[itemLower] || '';
                    return {
                        key: i,
                        selected: true,
                        item_raw: r.item || '',
                        part_id: matchedPartId,
                        supplier: r.supplier || '',
                        quantity: r.quantity != null ? String(r.quantity) : '',
                        unit_price: r.unit_price != null ? String(r.unit_price) : '',
                        txn_date: new Date().toISOString().split('T')[0],
                        notes: r.notes || '',
                        unmatched: !matchedPartId,
                    };
                });
                setReviewRows(prepared);
                setSuccess(`Found ${rows.length} item(s). Match each to a catalog part, review quantities and prices, then add.`);
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Could not read the photo. Try a clearer image.'));
        } finally {
            setExtracting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const updateReviewRow = (key, field, value) => {
        setReviewRows(rows => rows.map(r => r.key === key ? { ...r, [field]: value } : r));
    };

    const toggleReviewRow = (key) => {
        setReviewRows(rows => rows.map(r => r.key === key ? { ...r, selected: !r.selected } : r));
    };

    const saveReviewRows = async () => {
        const toSave = reviewRows.filter(r => r.selected);
        if (toSave.length === 0) { setError('No rows selected'); return; }
        for (const r of toSave) {
            if (!r.part_id) { setError('Every selected row needs a part selected from the catalog'); return; }
            if (!r.quantity || parseFloat(r.quantity) <= 0) { setError('Every selected row needs a valid quantity'); return; }
            if (!r.unit_price || parseFloat(r.unit_price) <= 0) { setError('Every selected row needs a unit price'); return; }
        }
        setSavingReview(true); setError(''); setSuccess('');
        let ok = 0; let fail = 0;
        for (const r of toSave) {
            try {
                const res = await purchaseSparePart({
                    part_id: parseInt(r.part_id),
                    quantity: parseFloat(r.quantity),
                    unit_price: parseFloat(r.unit_price),
                    txn_date: r.txn_date,
                    supplier: r.supplier || null,
                    notes: r.notes || null,
                });
                ok++;
                if (res.data.overpaid) {
                    setSuccess(prev => (prev || '') + ` ⚠ ${res.data.overpay_warning}`);
                }
            } catch { fail++; }
        }
        setSavingReview(false);
        setReviewRows(null);
        setSuccess((fail === 0 ? `${ok} item(s) added to stock` : `${ok} added, ${fail} failed`) + (success ? ` — ${success}` : ''));
        refreshAll();
    };

    const submitIssue = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setSuccess('');
        try {
            await createStockTxn({
                part_id: parseInt(issueForm.part_id),
                txn_date: issueForm.txn_date,
                direction: 'OUT',
                quantity: parseFloat(issueForm.quantity),
                unit_price: null,
                total_amount: null,
                machine_id: issueForm.machine_id ? parseInt(issueForm.machine_id) : null,
                notes: issueForm.notes || null,
            });
            setSuccess('Part issued');
            setIssueForm(f => ({ ...f, part_id: '', quantity: '', machine_id: '', notes: '' }));
            refreshAll();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to issue part'));
        } finally { setLoading(false); }
    };

    const submitBuy = async (e) => {
        e.preventDefault();
        setLoading(true); setError(''); setSuccess('');
        try {
            const res = await purchaseSparePart({
                part_id: parseInt(buyForm.part_id),
                quantity: parseFloat(buyForm.quantity),
                unit_price: parseFloat(buyForm.unit_price),
                txn_date: buyForm.txn_date,
                supplier: buyForm.supplier || null,
                notes: buyForm.notes || null,
            });
            if (res.data.overpaid) {
                setSuccess(`${res.data.message} ⚠ ${res.data.overpay_warning}`);
            } else {
                setSuccess(res.data.message);
            }
            setBuyForm(f => ({ ...f, part_id: '', quantity: '', unit_price: '', supplier: '', notes: '' }));
            setPriceHistory(null);
            refreshAll();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to record purchase'));
        } finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        setError(''); setSuccess('');
        try {
            const res = await deleteStockTxn(id);
            setSuccess(res.data.message);
            setConfirmId(null);
            refreshAll();
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to delete'));
            setConfirmId(null);
        }
    };

    const buyTotal = (parseFloat(buyForm.quantity) || 0) * (parseFloat(buyForm.unit_price) || 0);
    const machineOptions = machines.map(m => ({ value: m.machine_id, label: m.code }));
    const enteredPrice = parseFloat(buyForm.unit_price) || 0;
    const showPriceWarning = priceHistory && priceHistory.lowest_price !== null && enteredPrice > priceHistory.lowest_price;
    const selectedReviewCount = reviewRows ? reviewRows.filter(r => r.selected).length : 0;

    return (
        <Layout>
            {!viewer && (
                <div style={ui.card}>
                    <div style={styles.tabRow}>
                        <button onClick={() => { setMode('issue'); setReviewRows(null); setError(''); setSuccess(''); }} style={mode === 'issue' ? styles.tabActive : styles.tab}>Issue to Machine</button>
                        <button onClick={() => { setMode('purchase'); setError(''); setSuccess(''); }} style={mode === 'purchase' ? styles.tabActive : styles.tab}>Buy / Receive Stock</button>
                    </div>
                    {error && <div style={ui.alertError}>{error}</div>}
                    {success && !reviewRows && <div style={ui.alertSuccess}>{success}</div>}

                    {mode === 'issue' ? (
                        <form onSubmit={submitIssue}>
                            <div style={ui.field}>
                                <label style={ui.label}>Part</label>
                                <PartPicker parts={parts} value={issueForm.part_id ? parseInt(issueForm.part_id) : ''} onChange={(id) => setIssueForm(f => ({ ...f, part_id: id }))} />
                            </div>
                            <div style={ui.field}>
                                <label style={ui.label}>Issue to machine</label>
                                <ChipSelect options={machineOptions} value={issueForm.machine_id} onChange={(v) => setIssueForm(f => ({ ...f, machine_id: v }))} />
                            </div>
                            <div style={ui.row2}>
                                <div style={ui.field}>
                                    <label style={ui.label}>Quantity</label>
                                    <input style={ui.input} type="number" value={issueForm.quantity} onChange={e => setIssueForm(f => ({ ...f, quantity: e.target.value }))} min="0" step="0.01" required />
                                </div>
                                <div style={ui.field}>
                                    <label style={ui.label}>Date</label>
                                    <input style={ui.input} type="date" value={issueForm.txn_date} onChange={e => setIssueForm(f => ({ ...f, txn_date: e.target.value }))} required />
                                </div>
                            </div>
                            <div style={ui.field}>
                                <label style={ui.label}>Notes (optional)</label>
                                <input style={ui.input} type="text" value={issueForm.notes} onChange={e => setIssueForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>
                            <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                                {loading ? 'Saving...' : 'Issue Part'}
                            </button>
                        </form>
                    ) : (
                        <>
                            <div style={styles.uploadRow}>
                                <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                                    onChange={handleReceiptUpload} style={{ display: 'none' }} id="stock-upload" />
                                <label htmlFor="stock-upload" style={extracting ? styles.uploadBtnDisabled : styles.uploadBtn}>
                                    {extracting ? 'Reading photo...' : '📷 Upload Parts List Photo'}
                                </label>
                                <span style={styles.uploadHint}>Reads every item — match to catalog, review qty/price, then add</span>
                            </div>

                            {reviewRows && (
                                <div style={styles.reviewBox}>
                                    <div style={styles.reviewHeader}>
                                        <div style={styles.reviewTitle}>{success}</div>
                                        <button onClick={() => { setReviewRows(null); setSuccess(''); }} style={styles.cancelBtn}>Discard All</button>
                                    </div>
                                    <div style={styles.reviewTable}>
                                        {reviewRows.map(r => (
                                            <div key={r.key} style={r.selected ? styles.reviewRowWrap : styles.reviewRowWrapOff}>
                                                <div style={styles.reviewRowMain}>
                                                    <input type="checkbox" checked={r.selected} onChange={() => toggleReviewRow(r.key)} style={{ flexShrink: 0 }} />
                                                    <div style={styles.reviewItemRaw} title={r.item_raw}>
                                                        {r.item_raw || '(no name)'}
                                                        {r.unmatched && r.selected && <span style={styles.warn}> ⚠ not matched</span>}
                                                    </div>
                                                    <div style={styles.reviewPartWrap}>
                                                        <PartPicker
                                                            parts={parts}
                                                            value={r.part_id ? parseInt(r.part_id) : ''}
                                                            onChange={(id) => updateReviewRow(r.key, 'part_id', id)}
                                                        />
                                                    </div>
                                                    <input type="text" value={r.supplier} onChange={ev => updateReviewRow(r.key, 'supplier', ev.target.value)} style={styles.reviewSupplierInput} placeholder="Supplier" disabled={!r.selected} />
                                                    <input type="number" value={r.quantity} onChange={ev => updateReviewRow(r.key, 'quantity', ev.target.value)} style={styles.reviewSmallInput} placeholder="Qty" min="0" step="0.01" disabled={!r.selected} />
                                                    <input type="number" value={r.unit_price} onChange={ev => updateReviewRow(r.key, 'unit_price', ev.target.value)} style={styles.reviewSmallInput} placeholder="Unit ₵" min="0" step="0.01" disabled={!r.selected} />
                                                    <input type="date" value={r.txn_date} onChange={ev => updateReviewRow(r.key, 'txn_date', ev.target.value)} style={styles.reviewDateInput} disabled={!r.selected} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={styles.reviewFooter}>
                                        <span style={styles.reviewCount}>{selectedReviewCount} of {reviewRows.length} selected</span>
                                        <button onClick={saveReviewRows} style={savingReview ? ui.btnDisabled : ui.btn} disabled={savingReview}>
                                            {savingReview ? 'Adding...' : `Add ${selectedReviewCount} Selected`}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={submitBuy}>
                                <div style={styles.hint}>Enter the price of ONE item — the total is calculated automatically. This adds stock AND records the expense.</div>
                                <div style={ui.field}>
                                    <label style={ui.label}>Part</label>
                                    <PartPicker parts={parts} value={buyForm.part_id ? parseInt(buyForm.part_id) : ''} onChange={handleBuyPartChange} />
                                </div>

                                {priceHistory && (
                                    <div style={styles.historyBox}>
                                        {priceHistory.lowest_price !== null ? (
                                            <>
                                                <div style={styles.historyTitle}>Price history for this part</div>
                                                <div style={styles.historyLowest}>Lowest ever paid: ₵{priceHistory.lowest_price.toLocaleString()}/unit</div>
                                                <div style={styles.historyList}>
                                                    {priceHistory.history.slice(0, 5).map((h, i) => (
                                                        <div key={i} style={styles.historyRow}>
                                                            <span>{h.date}</span>
                                                            <span>₵{h.unit_price.toLocaleString()}/unit</span>
                                                            <span>{h.quantity} units</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <div style={styles.historyTitle}>No price history yet for this part — this will be the first recorded price.</div>
                                        )}
                                    </div>
                                )}

                                <div style={ui.row2}>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Quantity Bought</label>
                                        <input style={ui.input} type="number" value={buyForm.quantity} onChange={e => setBuyForm(f => ({ ...f, quantity: e.target.value }))} min="0" step="0.01" required />
                                    </div>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Price of 1 Item (GHS)</label>
                                        <input style={ui.input} type="number" value={buyForm.unit_price} onChange={e => setBuyForm(f => ({ ...f, unit_price: e.target.value }))} min="0" step="0.01" required />
                                    </div>
                                </div>

                                {showPriceWarning && (
                                    <div style={styles.warnBox}>
                                        ⚠ This is ₵{(enteredPrice - priceHistory.lowest_price).toFixed(2)} above the lowest price ever paid (₵{priceHistory.lowest_price}/unit). This will be reported to management.
                                    </div>
                                )}

                                {buyTotal > 0 && (
                                    <div style={styles.totalHint}>Total: ₵{buyTotal.toLocaleString()}</div>
                                )}
                                <div style={ui.row2}>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Supplier / Shop</label>
                                        <input style={ui.input} type="text" value={buyForm.supplier} onChange={e => setBuyForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Shop name" />
                                    </div>
                                    <div style={ui.field}>
                                        <label style={ui.label}>Date</label>
                                        <input style={ui.input} type="date" value={buyForm.txn_date} onChange={e => setBuyForm(f => ({ ...f, txn_date: e.target.value }))} required />
                                    </div>
                                </div>
                                <div style={ui.field}>
                                    <label style={ui.label}>Notes (optional)</label>
                                    <input style={ui.input} type="text" value={buyForm.notes} onChange={e => setBuyForm(f => ({ ...f, notes: e.target.value }))} />
                                </div>
                                <button style={loading ? ui.btnDisabled : ui.btn} type="submit" disabled={loading}>
                                    {loading ? 'Saving...' : 'Record Purchase'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}

            <div style={ui.card}>
                <div style={ui.cardTitle}>Current Stock</div>
                <table style={ui.table}>
                    <thead><tr><th style={ui.th}>Part</th><th style={ui.th}>Available</th></tr></thead>
                    <tbody>
                        {stock.map(s => {
                            const qty = parseFloat(s.available);
                            const low = qty <= 5;
                            return (
                                <tr key={s.part_id} style={ui.tr}>
                                    <td style={ui.td}>{s.name}</td>
                                    <td style={ui.td}><span style={low ? styles.lowBadge : styles.okText}>{qty.toLocaleString()}</span></td>
                                </tr>
                            );
                        })}
                        {stock.length === 0 && (
                            <tr><td colSpan="2" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No stock recorded yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div style={ui.card}>
                <div style={ui.cardTitle}>Recent Transactions</div>
                <table style={ui.table}>
                    <thead>
                        <tr><th style={ui.th}>Date</th><th style={ui.th}>Part</th><th style={ui.th}>Direction</th><th style={ui.th}>Qty</th><th style={ui.th}>Machine</th><th style={ui.th}></th></tr>
                    </thead>
                    <tbody>
                        {history.map(h => (
                            <tr key={h.stock_txn_id} style={ui.tr}>
                                <td style={ui.td}>{h.date}</td>
                                <td style={ui.td}>{h.part}</td>
                                <td style={ui.td}>{h.direction}</td>
                                <td style={ui.td}>{h.quantity}</td>
                                <td style={ui.td}>{h.machine || '-'}</td>
                                <td style={{ ...ui.td, textAlign: 'right' }}>
                                    {!viewer && (confirmId === h.stock_txn_id ? (
                                        <span style={styles.wrap}>
                                            <button onClick={() => handleDelete(h.stock_txn_id)} style={styles.yes}>Delete</button>
                                            <button onClick={() => setConfirmId(null)} style={styles.no}>Cancel</button>
                                        </span>
                                    ) : (
                                        <button onClick={() => setConfirmId(h.stock_txn_id)} style={styles.del}>Delete</button>
                                    ))}
                                </td>
                            </tr>
                        ))}
                        {history.length === 0 && (
                            <tr><td colSpan="6" style={{ ...ui.td, textAlign: 'center', color: ui.colors.muted, padding: '24px' }}>No transactions yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
}

const styles = {
    tabRow: { display: 'flex', gap: '8px', marginBottom: '18px' },
    tab: { padding: '9px 16px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    tabActive: { padding: '9px 16px', backgroundColor: ui.colors.ink, color: '#fff', border: `1px solid ${ui.colors.ink}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
    hint: { fontSize: '12px', color: ui.colors.muted, marginBottom: '14px' },
    totalHint: { fontSize: '13px', color: ui.colors.ink, fontWeight: '500', marginBottom: '14px', marginTop: '-6px' },
    lowBadge: { fontSize: '13px', fontWeight: '500', color: ui.colors.accent, backgroundColor: ui.colors.accentSoft, padding: '2px 10px', borderRadius: '20px' },
    okText: { fontSize: '14px', color: ui.colors.ink },
    del: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.accent, border: `0.5px solid #f0c0c0`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    wrap: { display: 'inline-flex', gap: '6px' },
    yes: { padding: '5px 12px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    no: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    historyBox: { backgroundColor: '#f5f3f0', border: `0.5px solid ${ui.colors.border}`, borderRadius: '8px', padding: '14px', marginBottom: '16px' },
    historyTitle: { fontSize: '13px', fontWeight: '500', color: ui.colors.ink, marginBottom: '6px' },
    historyLowest: { fontSize: '12px', color: ui.colors.inkSoft, marginBottom: '10px' },
    historyList: { display: 'flex', flexDirection: 'column', gap: '4px' },
    historyRow: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: ui.colors.muted },
    warnBox: { backgroundColor: ui.colors.accentSoft, border: `0.5px solid #f0c0c0`, borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: ui.colors.accent, fontWeight: '500' },
    uploadRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', padding: '12px', backgroundColor: '#f5f3f0', borderRadius: '8px' },
    uploadBtn: { padding: '9px 16px', backgroundColor: ui.colors.ink, color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
    uploadBtnDisabled: { padding: '9px 16px', backgroundColor: ui.colors.muted, color: '#fff', borderRadius: '8px', cursor: 'not-allowed', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap' },
    uploadHint: { fontSize: '12px', color: ui.colors.muted },
    reviewBox: { border: `1px solid ${ui.colors.accent}`, borderRadius: '10px', padding: '16px', marginBottom: '20px', backgroundColor: '#fffaf8' },
    reviewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
    reviewTitle: { fontSize: '13px', fontWeight: '500', color: ui.colors.ink },
    cancelBtn: { padding: '5px 12px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    reviewTable: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto', marginBottom: '14px' },
    reviewRowWrap: { backgroundColor: '#fff', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}`, padding: '8px' },
    reviewRowWrapOff: { backgroundColor: '#f5f3f0', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}`, padding: '8px', opacity: 0.55 },
    reviewRowMain: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
    reviewItemRaw: { fontSize: '12px', color: ui.colors.ink, minWidth: '120px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    reviewPartWrap: { width: '180px', flexShrink: 0 },
    reviewSupplierInput: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '110px' },
    reviewSmallInput: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '80px' },
    reviewDateInput: { padding: '5px 6px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', fontSize: '12px', width: '130px' },
    warn: { color: ui.colors.accent, fontSize: '11px' },
    reviewFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    reviewCount: { fontSize: '12px', color: ui.colors.muted },
};