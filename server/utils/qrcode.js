import QRCode from 'qrcode';

// Render at a high resolution so the code stays crisp when printed/scanned.
const SIZE = 512;

const QR_OPTS = {
  width: SIZE,
  margin: 2,
  errorCorrectionLevel: 'H',
  color: { dark: '#001e5f', light: '#FFFFFF' },
};

/**
 * Generate the entry QR code (encodes the registration code) as a PNG buffer.
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
export const generateQrBuffer = async (text) => QRCode.toBuffer(text, { type: 'png', ...QR_OPTS });

/**
 * Generate the entry QR code as a data URL (base64 PNG).
 * @param {string} text
 * @returns {Promise<string>}
 */
export const generateQrDataUrl = async (text) => QRCode.toDataURL(text, QR_OPTS);
