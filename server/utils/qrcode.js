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
 * Composite the DOPA logo directly over the centre of a QR PNG — no white card.
 *
 * Instead of knocking out a solid white pad (which looks like a sticker), the
 * wordmark is given a soft, feathered white glow so it lifts cleanly off the
 * busy QR pattern and stays legible against both the dark modules and the light
 * gaps. The wordmark is wide but thin, so it covers only a small *area* of the
 * code — verified to still decode across the full code range at level-H error
 * correction.
 * @param {Buffer} qrPng
 * @returns {Promise<Buffer>}
 */
const overlayLogo = async (qrPng) => {
  const logoWidth = Math.round(SIZE * 0.34); // ~34% of the QR width
  const logo = await sharp(LOGO_PATH).resize({ width: logoWidth }).png().toBuffer();
  const { width: lw, height: lh } = await sharp(logo).metadata();

  // Soft white glow: a white silhouette of the wordmark, padded and blurred so
  // its edges feather out. Composited twice to deepen it, then the crisp logo on
  // top. This separates the logo from the QR without a hard white background.
  const GLOW_PAD = 40;
  const glow = await sharp(logo)
    .tint({ r: 255, g: 255, b: 255 })
    .extend({
      top: GLOW_PAD,
      bottom: GLOW_PAD,
      left: GLOW_PAD,
      right: GLOW_PAD,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .blur(9)
    .png()
    .toBuffer();
  const { width: gw, height: gh } = await sharp(glow).metadata();

  const glowPos = { left: Math.round((SIZE - gw) / 2), top: Math.round((SIZE - gh) / 2) };
  const logoPos = { left: Math.round((SIZE - lw) / 2), top: Math.round((SIZE - lh) / 2) };

  return sharp(qrPng)
    .composite([
      { input: glow, ...glowPos },
      { input: glow, ...glowPos },
      { input: logo, ...logoPos },
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
