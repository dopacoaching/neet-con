/**
 * Generate a unique order id per payment attempt.
 * Format: DOPA-<timestamp>-<random5>
 * @returns {string}
 */
const generateOrderId = () => {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `DOPA-${ts}-${rand}`;
};

export default generateOrderId;
