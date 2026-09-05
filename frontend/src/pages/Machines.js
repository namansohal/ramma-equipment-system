import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { getMachines } from '../services/api';
import { colors } from '../components/ui';

export default function Machines() {
    const navigate = useNavigate();
    const [machines, setMachines] = useState([]);
    const [hover, setHover] = useState(null);

    useEffect(() => {
        getMachines().then(res => setMachines(res.data)).catch(e => console.error(e));
    }, []);

    return (
        <Layout>
            <div style={styles.intro}>Select a machine to view its full history — parts used, expenses, and activity.</div>
            <div style={styles.grid}>
                {machines.map(m => (
                    <div
                        key={m.machine_id}
                        style={{ ...styles.tile, ...(hover === m.machine_id ? styles.tileHover : {}) }}
                        onMouseEnter={() => setHover(m.machine_id)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => navigate(`/machines/${m.machine_id}`)}
                    >
                        <div style={styles.left}>
                            <div style={styles.code}>{m.code}</div>
                            <div style={styles.label}>Excavator</div>
                        </div>
                        <div style={styles.arrow}>→</div>
                    </div>
                ))}
            </div>
        </Layout>
    );
}

const styles = {
    intro: { fontSize: '14px', color: colors.muted, marginBottom: '20px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' },
    tile: { backgroundColor: '#fff', border: `0.5px solid ${colors.border}`, borderRadius: '10px', padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.12s' },
    tileHover: { borderColor: colors.accent, backgroundColor: '#fffdfd' },
    left: { display: 'flex', alignItems: 'baseline', gap: '10px' },
    code: { fontSize: '18px', fontWeight: '500', color: colors.ink, letterSpacing: '-0.3px' },
    label: { fontSize: '12px', color: colors.muted },
    arrow: { fontSize: '15px', color: colors.muted },
};