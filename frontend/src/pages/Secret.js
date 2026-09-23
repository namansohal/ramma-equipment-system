import React, { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import * as ui from '../components/ui';

export default function Secret() {
    const [dirtyText, setDirtyText] = useState('');
    const [junkStrings, setJunkStrings] = useState('');
    const [output, setOutput] = useState('');
    const [cleaning, setCleaning] = useState(false);
    const [cleanError, setCleanError] = useState('');
    const [copied, setCopied] = useState(false);

    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatBottomRef = useRef(null);

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const clean = async () => {
        if (!dirtyText.trim()) { setCleanError('Paste the text to clean'); return; }
        setCleaning(true); setCleanError(''); setOutput('');

        const junks = junkStrings.split('\n').map(s => s.trim()).filter(Boolean);
        let cleaned = dirtyText;
        for (const junk of junks) {
            cleaned = cleaned.split(junk).join('');
        }
        cleaned = cleaned.replace(/  +/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

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
            setOutput(data.content?.[0]?.text || cleaned);
        } catch {
            setOutput(cleaned);
        } finally {
            setCleaning(false);
        }
    };

    const copyOutput = () => {
        navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sendMessage = async () => {
        const text = chatInput.trim();
        if (!text) return;

        const newMessages = [...messages, { role: 'user', content: text }];
        setMessages(newMessages);
        setChatInput('');
        setChatLoading(true);

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1000,
                    system: 'You are a helpful assistant. When given multiple choice questions, identify the correct answer and explain why clearly and concisely. For other questions, give direct, accurate answers.',
                    messages: newMessages.map(m => ({ role: m.role, content: m.content }))
                })
            });
            const data = await response.json();
            const reply = data.content?.[0]?.text || 'No response received.';
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to AI. Please try again.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => setMessages([]);

    return (
        <Layout>
            {/* Text Cleaner */}
            <div style={ui.card}>
                <div style={ui.cardTitle}>Text Cleaner</div>
                {cleanError && <div style={ui.alertError}>{cleanError}</div>}
                <div style={styles.grid}>
                    <div style={ui.field}>
                        <label style={ui.label}>Paste dirty text here</label>
                        <textarea
                            style={styles.textarea}
                            value={dirtyText}
                            onChange={e => setDirtyText(e.target.value)}
                            placeholder="Paste the text with junk strings mixed in..."
                            rows={10}
                        />
                    </div>
                    <div style={ui.field}>
                        <label style={ui.label}>Junk strings to remove (one per line)</label>
                        <textarea
                            style={styles.textarea}
                            value={junkStrings}
                            onChange={e => setJunkStrings(e.target.value)}
                            placeholder={"ubsvivbsudbvusdbvub\nanother_junk_string"}
                            rows={10}
                        />
                    </div>
                </div>
                <button onClick={clean} style={cleaning ? ui.btnDisabled : ui.btn} disabled={cleaning}>
                    {cleaning ? 'Cleaning...' : 'Clean & Format'}
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

            {/* AI Chat */}
            <div style={ui.card}>
                <div style={styles.outputHeader}>
                    <div style={ui.cardTitle}>Ask AI</div>
                    {messages.length > 0 && (
                        <button onClick={clearChat} style={styles.clearBtn}>Clear chat</button>
                    )}
                </div>

                {messages.length === 0 && (
                    <div style={styles.emptyChat}>
                        Paste a question, MCQ, or anything you want answered. Press Enter to send.
                    </div>
                )}

                {messages.length > 0 && (
                    <div style={styles.chatBox}>
                        {messages.map((m, i) => (
                            <div key={i} style={m.role === 'user' ? styles.userMsg : styles.assistantMsg}>
                                <div style={styles.msgLabel}>{m.role === 'user' ? 'You' : 'AI'}</div>
                                <div style={styles.msgContent}>{m.content}</div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div style={styles.assistantMsg}>
                                <div style={styles.msgLabel}>AI</div>
                                <div style={{ ...styles.msgContent, color: ui.colors.muted }}>Thinking...</div>
                            </div>
                        )}
                        <div ref={chatBottomRef} />
                    </div>
                )}

                <div style={styles.inputRow}>
                    <textarea
                        style={styles.chatInput}
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a question or paste an MCQ... (Enter to send, Shift+Enter for new line)"
                        rows={3}
                        disabled={chatLoading}
                    />
                    <button
                        onClick={sendMessage}
                        style={chatLoading || !chatInput.trim() ? styles.sendBtnDisabled : styles.sendBtn}
                        disabled={chatLoading || !chatInput.trim()}
                    >
                        Send
                    </button>
                </div>
            </div>
        </Layout>
    );
}

const styles = {
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
    textarea: { width: '100%', padding: '10px 12px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', color: ui.colors.ink, lineHeight: '1.6', boxSizing: 'border-box' },
    outputHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
    output: { fontSize: '14px', color: ui.colors.ink, lineHeight: '1.8', whiteSpace: 'pre-wrap', backgroundColor: '#f9f8f6', padding: '16px', borderRadius: '8px', border: `0.5px solid ${ui.colors.border}` },
    copyBtn: { padding: '6px 14px', backgroundColor: ui.colors.ink, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
    clearBtn: { padding: '6px 14px', backgroundColor: '#fff', color: ui.colors.inkSoft, border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    emptyChat: { fontSize: '13px', color: ui.colors.muted, padding: '16px 0', marginBottom: '12px' },
    chatBox: { maxHeight: '400px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
    userMsg: { alignSelf: 'flex-end', maxWidth: '75%', backgroundColor: ui.colors.accentSoft, borderRadius: '12px 12px 2px 12px', padding: '10px 14px' },
    assistantMsg: { alignSelf: 'flex-start', maxWidth: '85%', backgroundColor: '#f5f3f0', borderRadius: '12px 12px 12px 2px', padding: '10px 14px' },
    msgLabel: { fontSize: '10px', fontWeight: '600', color: ui.colors.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' },
    msgContent: { fontSize: '13px', color: ui.colors.ink, lineHeight: '1.7', whiteSpace: 'pre-wrap' },
    inputRow: { display: 'flex', gap: '10px', alignItems: 'flex-end' },
    chatInput: { flex: 1, padding: '10px 12px', border: `0.5px solid ${ui.colors.borderStrong}`, borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'none', color: ui.colors.ink, lineHeight: '1.6' },
    sendBtn: { padding: '10px 20px', backgroundColor: ui.colors.accent, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', alignSelf: 'flex-end' },
    sendBtnDisabled: { padding: '10px 20px', backgroundColor: ui.colors.muted, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'not-allowed', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', alignSelf: 'flex-end' },
};