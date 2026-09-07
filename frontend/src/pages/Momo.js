import React from 'react';
import Layout from '../components/Layout';
import * as ui from '../components/ui';

export default function Momo() {
    return (
        <Layout>
            <div style={{ ...ui.card, textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: '15px', fontWeight: '500', color: ui.colors.ink, marginBottom: '6px' }}>MOMO</div>
                <div style={{ fontSize: '13px', color: ui.colors.muted }}>Coming soon</div>
            </div>
        </Layout>
    );
}