// Ramma design system — Site Control palette
// `accent` stays red: across the app it means danger / negative (delete, low stock, errors).
// `brand` is the yellow used for primary actions and highlights.
export const colors = {
    page: '#ECEEF1',
    card: '#FFFFFF',
    border: '#E1E4E8',
    borderStrong: '#C3C8CF',
    ink: '#15181C',
    inkSoft: '#3F4752',
    muted: '#5B6470',
    accent: '#B42318',
    accentSoft: '#FDECEA',
    amber: '#92400E',
    amberSoft: '#FEF3C7',
    brand: '#F2B705',
    brandSoft: '#FFF4CC',
    green: '#166534',
    greenSoft: '#E7F4EC',
    side: '#15181C',
};

export const condensed = "'Barlow Condensed', 'Barlow', sans-serif";

export const card = {
    backgroundColor: colors.card,
    borderRadius: '6px',
    padding: '20px',
    marginBottom: '20px',
};

export const cardTitle = {
    fontFamily: condensed,
    fontSize: '20px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: colors.ink,
    marginTop: 0,
    marginBottom: '16px',
};

export const label = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '600',
    color: colors.inkSoft,
    fontSize: '13px',
};

export const input = {
    width: '100%',
    minHeight: '44px',
    padding: '10px 12px',
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: '4px',
    fontSize: '15px',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    color: colors.ink,
};

export const btn = {
    minHeight: '44px',
    padding: '0 22px',
    backgroundColor: colors.brand,
    color: colors.ink,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
};

export const btnDisabled = {
    ...btn,
    backgroundColor: '#F7DC8A',
    cursor: 'not-allowed',
};

export const btnSecondary = {
    minHeight: '40px',
    padding: '0 16px',
    backgroundColor: '#fff',
    color: colors.ink,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
};

export const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' };
export const field = { marginBottom: '18px' };

export const alertError = {
    backgroundColor: colors.accentSoft,
    border: `1px solid #F1B8B2`,
    color: colors.accent,
    fontWeight: '600',
    padding: '11px 14px',
    borderRadius: '4px',
    marginBottom: '18px',
    fontSize: '13px',
};

export const alertSuccess = {
    backgroundColor: '#f0fdf4',
    border: '1px solid #B7DEC4',
    color: colors.green,
    fontWeight: '600',
    padding: '11px 14px',
    borderRadius: '4px',
    marginBottom: '18px',
    fontSize: '13px',
};

export const table = { width: '100%', borderCollapse: 'collapse' };
export const th = { padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${colors.border}`, fontWeight: '600', color: colors.muted, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', backgroundColor: '#F7F8FA', whiteSpace: 'nowrap' };
export const tr = { borderBottom: '1px solid #EEF0F2' };
export const td = { padding: '11px 12px', color: colors.ink, fontSize: '14px' };

// Summary number tiles (dashboard, machine detail)
export const stat = { backgroundColor: colors.card, borderRadius: '6px', padding: '16px 20px', borderTop: '4px solid transparent' };
export const statLabel = { fontSize: '12px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.muted };
export const statValue = { marginTop: '4px', fontFamily: condensed, fontWeight: '700', fontSize: '38px', lineHeight: '1.1', color: colors.ink };
