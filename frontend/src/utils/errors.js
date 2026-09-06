export function getErrorMessage(err, fallback = 'Something went wrong') {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail.map(d => (typeof d === 'string' ? d : d.msg || 'Invalid input')).join(', ');
    }
    if (detail && typeof detail === 'object' && detail.msg) return detail.msg;
    return fallback;
}