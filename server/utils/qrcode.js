import QRCode from 'qrcode';

const QR_OPTS = {
  width: 320,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: '#001e5f', light: '#FFFFFF' },
};

/**
 * Generate a QR code PNG buffer for the given text (used as an email attachment).
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
export const generateQrBuffer = (text) => QRCode.toBuffer(text, { type: 'png', ...QR_OPTS });

/**
 * Generate a QR code as a data URL (base64 PNG).
 * @param {string} text
 * @returns {Promise<string>}
 */
export const generateQrDataUrl = (text) => QRCode.toDataURL(text, QR_OPTS);
