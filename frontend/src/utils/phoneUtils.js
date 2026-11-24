/**
 * Phone Number Redaction Utility (DPDP Act & Telecom Privacy Compliance)
 * Masks the last 5 digits of any phone number / MSISDN with 'XXXXX'.
 */

export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return phone;

  // If already masked with XXXXX, return directly
  if (/[xX]{5}/.test(phone)) return phone;

  const digits = phone.replace(/\D/g, '');
  // Indian phone numbers have at least 10 digits (or 12 with +91)
  if (digits.length < 10) return phone;

  // Replace last 5 digits with XXXXX preserving prefix and spacing
  let count = 0;
  const chars = phone.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    if (/\d/.test(chars[i])) {
      chars[i] = 'X';
      count++;
      if (count === 5) break;
    }
  }
  return chars.join('');
}

export function maskPhoneInText(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/(\+91[\s-]?[6-9]\d{4})[\s-]?\d{5}/g, '$1 XXXXX')
    .replace(/(\+91[\s-]?[6-9]\d{3}[\s-]?\d)[\s-]?\d{5}/g, '$1 XXXXX')
    .replace(/\b([6-9]\d{4})\d{5}\b/g, '$1XXXXX')
    .replace(/(#98290)-[0-9]{5}/g, '$1-XXXXX');
}
