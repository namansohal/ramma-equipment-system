import React from 'react';
import { colors } from './ui';

export default function ChipSelect({ options, value, onChange }) {
    return (
        <div style={styles.row}>
            {options.map(o => (
                <div
                    key={o.value}
                    onClick={() => onChange(o.value)}
                    style={String(o.value) === String(value) ? styles.chipActive : styles.chip}
                >
                    {o.label}
                </div>
            ))}
        </div>
    );
}

const styles = {
    row: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
    chip: { padding: '8px 16px', border: `0.5px solid ${colors.borderStrong}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: '#fff', userSelect: 'none', fontSize: '13px', color: colors.ink },
    chipActive: { padding: '8px 16px', border: `0.5px solid ${colors.accent}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: colors.accentSoft, color: colors.accent, userSelect: 'none', fontSize: '13px', fontWeight: '500' },
};