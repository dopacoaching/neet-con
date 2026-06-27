import QRCode from 'qrcode';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, '..', 'assets', 'dopa-logo.png');

// Render at a high resolution so the centered logo stays crisp.
const SIZE = 512;

// Error-correction level H (~30% recovery) so the centered DOPA logo can cover
// part of the code without breaking scannability.
const QR_OPTS = {
  width: SIZE,
  margin: 2,
  errorCorrectionLevel: 'H',
  color: { dark: '#001e5f', light: '#FFFFFF' },
};

/**
 * Composite the DOPA logo (on a white rounded pad) into the centre of a QR PNG.
 * The DOPA wordmark is wide but thin, so it covers only a small *area* of the
 * code — well within level-H's recovery budget, keeping the QR scannable.
 * @param {Buffer} qrPng
 * @returns {Promise<Buffer>}
 */
const overlayLogo = async (qrPng) => {
  const logoWidth = Math.round(SIZE * 0.26); // ~26% of the QR width
  const logo = await sharp(LOGO_PATH).resize({ width: logoWidth }).png().toBuffer();
  const { width: lw, height: lh } = await sharp(logo).metadata();

  // Knock out a clean, balanced rounded card behind the wide-thin wordmark so
  // it has even breathing room on all sides (not a cramped sliver) and stays
  // clearly separated from the surrounding QR modules. The pad is taller than
  // the logo (height = 0.5 × width) for vertical margin, and kept to ~6% of the
  // QR area — verified to still decode across the full code range (001–999) at
  // level-H error correction.
  const padX = 20;
  const padW = lw + padX * 2;
  const padH = Math.round(padW * 0.5);
  const radius = 20;
  const pad = await sharp(
    Buffer.from(
      `<svg width="${padW}" height="${padH}"><rect width="${padW}" height="${padH}" rx="${radius}" ry="${radius}" fill="#FFFFFF"/></svg>`
    )
  )
    .png()
    .toBuffer();

  return sharp(qrPng)
    .composite([
      { input: pad, left: Math.round((SIZE - padW) / 2), top: Math.round((SIZE - padH) / 2) },
      { input: logo, left: Math.round((SIZE - lw) / 2), top: Math.round((SIZE - lh) / 2) },
    ])
    .png()
    .toBuffer();
};

/**
 * Generate a branded QR code PNG buffer (DOPA logo centred) for the given text.
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
export const generateQrBuffer = async (text) => {
  const qr = await QRCode.toBuffer(text, { type: 'png', ...QR_OPTS });
  return overlayLogo(qr);
};

/**
 * Generate a branded QR code as a data URL (base64 PNG).
 * @param {string} text
 * @returns {Promise<string>}
 */
export const generateQrDataUrl = async (text) => {
  const buffer = await generateQrBuffer(text);
  return `data:image/png;base64,${buffer.toString('base64')}`;
};
