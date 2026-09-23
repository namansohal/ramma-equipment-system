import React, { useState } from 'react';
import Layout from '../components/Layout';
import * as ui from '../components/ui';

export default function Secret() {
    const [dirtyText, setDirtyText] = useState('');
    const [junkStrings, setJunkStrings] = useState('');
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const clean = async () => {
        if (!dirtyText.trim()) { setError('Paste the text to clean'); return; }
        setLoading(true); setError(''); setOutput('');

        const junks = junkStrings.split('\n').map(s => s.trim()).filter(Boolean);

        // First pass: simple string removal for exact matches
        let cleaned = dirtyText;
        for (const junk of junks) {
            if (junk) {
                cleaned = cleaned.split(junk).join('');
            }
        }
        // Clean up double spaces and extra blank lines left behind
        cleaned = cleaned.replace(/  +/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

        // Second pass: AI formatting for polished output
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1000,
                    messages: [{
                        role: 'user',
                        content: `The following text has had junk strings removed but may have leftover spacing issues, broken sentences, or formatting problems. Clean it up into well-formatted, readable paragraphs. Fix spacing and punctuation only — do not change the meaning or add new content. Return only the cleaned text, nothing else.\n\n${cleaned}`
                    }]
                })
            });
            const data = await response.json();
            const result = data.content?.[0]?.text || cleaned;
            setOutput(result);
        } catch (err) {
            // If AI fails, still show the basic cleaned version
            setOutput(cleaned);
        } finally {
            setLoading(false);
        }
    };

    const copyOutput = () => {
        navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Layout>
            <div style={ui.card}>
                <div style={ui.cardTitle}>Text Cleaner</div>
                {error && <div style={ui.alertError}>{error}</div>}
                <div style={styles.grid}>
                    <div style={ui.field}>
                        <label style={ui.label}>Paste dirty text here</label>
                        <textarea
                            style={styles.textarea}
                            value={dirtyText}
                            onChange={e => setDirtyText(e.target.value)}
                            placeholder="Paste the text with junk strings mixed in..."
                            rows={12}
                        />
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>Junk strings to remove (one per line)</label>
                        <textarea
                            style={styles.textarea}
                            value={junkStrings}
                            onChange={e => setJunkStrings(e.target.value)}
                            placeholder={"ubsvivbsudbvusdbvub\nanother_junk_string\n..."}
                            rows={12}
                        />
                    </div>
                </div>
                <button
                    onClick={clean}
                    style={loading ? ui.btnDisabled : ui.btn}
                    disabled={loading}
                >
                    {loading ? 'Cleaning...' : 'Clean & Format'}
                </button>
            </div>

            {output && (
                <div style={ui.card}>
                    <div style={styles.outputHeader}>
                        <div style={ui.cardTitle}>Cleaned Output</div>
                        <button onClick={copyOutput} style={styles.copyBtn}>
                            {copied ? '✓ Copied' : 'Copy'}
                        </button>
                    </div>
                    <div style={styles.output}>{output}</div>
                </div>
            )}
        </Layout>
    );
}

const styles = {
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
    textarea: { width: '100%', padding: '10px 12px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', color: ui.colors.ink, lineHeight: '1.6', boxSizing: 'border-box' },
    outputHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
    output: { fontSize: '14px', color: ui.colors.ink, lineHeight: '1.8', whiteSpace: 'pre-wrap', backgroundColor: '#f9f8f6', padding: '16px', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}` },
    copyBtn: { padding: '6px 14px', backgroundColor: ui.colors.ink, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
};  