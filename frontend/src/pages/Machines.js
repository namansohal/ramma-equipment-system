import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { getMachines, getDowntime } from '../services/api';
import * as ui from '../components/ui';

const { colors } = ui;

export default function Machines() {
    const navigate = useNavigate();
    const [machines, setMachines] = useState([]);
    const [down, setDown] = useState({});

    useEffect(() => {
        getMachines().then(res => setMachines(res.data)).catch(e => console.error(e));
        // Open downtime records (no end date) mark a machine as down.
        getDowntime().then(res => {
            const open = {};
            res.data.filter(d => d.ongoing).forEach(d => { open[d.machine_id] = d.reason; });
            setDown(open);
        }).catch(() => {});
    }, []);

    return (
        <Layout>
            <div style={styles.intro}>
                <span>Select a machine to view its full history — parts used, expenses, and activity.</span>
                <span style={styles.legend}>
                    <span style={styles.legendItem}><span style={{ ...styles.dot, backgroundColor: '#15803D' }} />Available</span>
                    <span style={styles.legendItem}><span style={{ ...styles.dot, backgroundColor: colors.accent }} />Down</span>
                </span>
            </div>
            <div className="rs-fleet">
                {machines.map(m => {
                    const isDown = m.machine_id in down;
                    return (
                        <button
                            type="button"
                            key={m.machine_id}
                            style={{ ...styles.tile, borderTopColor: isDown ? colors.accent : '#15803D' }}
                            onClick={() => navigate(`/machines/${m.machine_id}`)}
                        >
                            <span style={styles.code}>{m.code}</span>
                            <span style={styles.label}>Excavator</span>
                            <span style={isDown ? styles.downPill : styles.okPill}>{isDown ? 'Down' : 'Available'}</span>
                            {isDown && down[m.machine_id] && <span style={styles.reason}>{down[m.machine_id]}</span>}
                        </button>
                    );
                })}
            </div>
        </Layout>
    );
}

const styles = {
    intro: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', fontSize: '14px', color: colors.muted, marginBottom: '18px' },
    legend: { display: 'flex', gap: '14px', fontSize: '13px' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '6px' },
    dot: { width: '10px', height: '10px', borderRadius: '2px', display: 'inline-block' },
    tile: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', backgroundColor: '#fff', border: `1px solid ${colors.border}`, borderTop: '5px solid', borderRadius: '4px', padding: '14px', cursor: 'pointer', textAlign: 'left', color: colors.ink },
    code: { fontFamily: ui.condensed, fontSize: '30px', fontWeight: '700', lineHeight: 1 },
    label: { fontSize: '12px', color: colors.muted, marginBottom: '8px' },
    okPill: { fontSize: '12px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', backgroundColor: colors.greenSoft, color: colors.green },
    downPill: { fontSize: '12px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', backgroundColor: colors.accentSoft, color: colors.accent },
    reason: { fontSize: '13px', color: colors.muted, marginTop: '6px' },
};
