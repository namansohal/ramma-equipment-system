// Ramma design system — Warm Stone palette
export const colors = {
    page: '#faf9f7',
    card: '#ffffff',
    border: '#e7e4df',
    borderStrong: '#d6d1ca',
    ink: '#292524',
    inkSoft: '#57534e',
    muted: '#a8a29e',
    accent: '#b91c1c',
    accentSoft: '#fef2f2',
    amber: '#b45309',
    amberSoft: '#fffbeb',
};

export const card = {
    backgroundColor: colors.card,
    borderRadius: '12px',
    border: `0.5px solid ${colors.border}`,
    padding: '24px',
    marginBottom: '20px',
};

export const cardTitle = {
    fontSize: '14px',
    fontWeight: '500',
    color: colors.ink,
    marginTop: 0,
    marginBottom: '18px',
};

export const label = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '500',
    color: colors.inkSoft,
    fontSize: '13px',
};

export const input = {
    width: '100%',
    padding: '10px 12px',
    border: `0.5px solid ${colors.borderStrong}`,
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
    backgroundColor: '#fff',
    color: colors.ink,
    outline: 'none',
};

export const btn = {
    padding: '11px 24px',
    backgroundColor: colors.accent,
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
};

export const btnDisabled = {
    ...btn,
    backgroundColor: '#e6a5a5',
    cursor: 'not-allowed',
};

export const btnSecondary = {
    padding: '9px 18px',
    backgroundColor: '#fff',
    color: colors.ink,
    border: `0.5px solid ${colors.borderStrong}`,
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
};

export const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' };
export const field = { marginBottom: '18px' };

export const alertError = {
    backgroundColor: colors.accentSoft,
    border: `0.5px solid #fecaca`,
    color: colors.accent,
    padding: '11px 14px',
    borderRadius: '8px',
    marginBottom: '18px',
    fontSize: '13px',
};

export const alertSuccess = {
    backgroundColor: '#f0fdf4',
    border: '0.5px solid #bbf7d0',
    color: '#15803d',
    padding: '11px 14px',
    borderRadius: '8px',
    marginBottom: '18px',
    fontSize: '13px',
};

export const table = { width: '100%', borderCollapse: 'collapse' };
export const th = { padding: '11px 14px', textAlign: 'left', borderBottom: `0.5px solid ${colors.border}`, fontWeight: '500', color: colors.muted, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' };
export const tr = { borderBottom: `0.5px solid ${colors.border}` };
export const td = { padding: '13px 14px', color: colors.ink, fontSize: '14px' };