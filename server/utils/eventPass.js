import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'assets');
const FONTS = join(ASSETS, 'fonts');

const FONT_FILES = [
  join(FONTS, 'Poppins-Regular.ttf'),
  join(FONTS, 'Poppins-SemiBold.ttf'),
  join(FONTS, 'Poppins-Bold.ttf'),
];

// CareerX wordmark (white/blue-on-navy variant), embedded so the renderer
// needs no external fetch.
const LOGO_DATA_URI = (() => {
  try {
    return `data:image/png;base64,${readFileSync(join(ASSETS, 'careerx-logo.png')).toString('base64')}`;
  } catch {
    return '';
  }
})();

const EVENT = {
  date: process.env.EVENT_DATE || 'Saturday, 1 August 2026',
  time: process.env.EVENT_TIME || '9:30 AM onwards',
  venue: process.env.EVENT_VENUE || 'Bhatia Hall, Kuttikatoor, Kozhikode',
};

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const truncate = (s, n) => {
  const v = String(s ?? '').trim();
  return v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v;
};

/**
 * Build the branded CareerX entry pass for a confirmed registration and
 * return it as a PNG buffer. Renders deterministically (bundled Poppins font +
 * embedded QR/logo) so it looks identical on every platform.
 *
 * @param {object} reg  { fullName, registrationNumber, dopaStatus }
 * @returns {Promise<Buffer>}
 */
export const generateEventPass = async (reg) => {
  const code = String(reg.registrationNumber || '');

  const qrDataUri = await QRCode.toDataURL(code, {
    width: 560,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#0b1240', light: '#FFFFFF' },
  });

  const name = esc(truncate(reg.fullName, 20));
  const status = esc(reg.dopaStatus || '');
  const dateTime = esc(`${EVENT.date} · ${EVENT.time}`);
  const venue = esc(truncate(EVENT.venue, 48));

  // Layout grid: card inset 28; inner padding 44 -> content box x[72..1208] y[72..648].
  // Left column = QR (x 72, w 296); right column = info (x 440, right edge 1208).
  const RX = 440; // right column left edge
  const RR = 1208; // right column right edge

  const statusBlock = status
    ? `<text x="${RR}" y="258" text-anchor="end" font-family="Poppins" font-weight="600" font-size="19" letter-spacing="1.2" fill="#7fa4ff">CATEGORY</text>
  <text x="${RR}" y="300" text-anchor="end" font-family="Poppins" font-weight="700" font-size="30" fill="#00c2ff">${status}</text>`
    : '';

  const guestCount = Math.max(0, Math.trunc(Number(reg.guestCount) || 0));
  const guestsBlock = guestCount
    ? `<text x="${RR}" y="396" text-anchor="end" font-family="Poppins" font-weight="600" font-size="21" letter-spacing="2" fill="#7fa4ff">WITH GUESTS</text>
  <text x="${RR}" y="452" text-anchor="end" font-family="Poppins" font-weight="700" font-size="46" fill="#00c2ff">+${guestCount}</text>`
    : '';

  const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#05082b"/>
      <stop offset="1" stop-color="#020314"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#161ecf"/>
      <stop offset="1" stop-color="#050b95"/>
    </linearGradient>
    <clipPath id="cardClip"><rect x="28" y="28" width="1224" height="664" rx="40"/></clipPath>
  </defs>

  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="28" y="28" width="1224" height="664" rx="40" fill="url(#card)"/>

  <!-- decorative accent swooshes, clipped to the card -->
  <g clip-path="url(#cardClip)" opacity="0.9">
    <circle cx="1230" cy="70" r="220" fill="#00c2ff" opacity="0.16"/>
    <circle cx="1180" cy="40" r="120" fill="#4fc3ff" opacity="0.22"/>
    <rect x="1040" y="-40" width="320" height="58" rx="29" fill="#00c2ff" transform="rotate(35 1200 80)" opacity="0.5"/>
  </g>

  <!-- ===== LEFT COLUMN: QR ===== -->
  <rect x="72" y="72" width="216" height="62" rx="16" fill="#0a0e2e"/>
  <text x="180" y="111" font-family="Poppins" font-weight="600" font-size="25" letter-spacing="3" fill="#ffffff" text-anchor="middle">ENTRY PASS</text>

  <rect x="72" y="176" width="296" height="296" rx="26" fill="#ffffff"/>
  <image x="98" y="202" width="244" height="244" xlink:href="${qrDataUri}"/>
  <text x="220" y="512" font-family="Poppins" font-weight="500" font-size="21" fill="#c9d6ff" text-anchor="middle">Show this at the entry desk</text>

  <!-- ===== RIGHT COLUMN: INFO ===== -->
  <!-- Backing chip matches the logo file's own flat navy exactly, so its
       rectangular edge reads as a deliberate badge (like ENTRY PASS on the
       left) instead of a mismatched box against the card's gradient. -->
  ${LOGO_DATA_URI ? `<rect x="992" y="68" width="224" height="74" rx="14" fill="#050b95"/>
  <image x="1004" y="79" width="200" height="52" xlink:href="${LOGO_DATA_URI}"/>` : ''}

  <text x="${RX}" y="130" font-family="Poppins" font-weight="700" font-size="58" fill="#ffffff">CareerX</text>
  <text x="${RX}" y="168" font-family="Poppins" font-weight="500" font-size="22" fill="#c3d0ff">The Gateway to Medical Career</text>
  <line x1="${RX}" y1="202" x2="${RR}" y2="202" stroke="#ffffff" stroke-opacity="0.13" stroke-width="1.5"/>

  <text x="${RX}" y="258" font-family="Poppins" font-weight="600" font-size="21" letter-spacing="2" fill="#7fa4ff">DELEGATE NAME</text>
  <text x="${RX}" y="316" font-family="Poppins" font-weight="700" font-size="50" fill="#ffffff">${name}</text>
  ${statusBlock}

  <text x="${RX}" y="396" font-family="Poppins" font-weight="600" font-size="21" letter-spacing="2" fill="#7fa4ff">REGISTRATION CODE</text>
  <text x="${RX}" y="452" font-family="Poppins" font-weight="700" font-size="46" fill="#00c2ff">${esc(code)}</text>
  ${guestsBlock}

  <line x1="${RX}" y1="504" x2="${RR}" y2="504" stroke="#ffffff" stroke-opacity="0.13" stroke-width="1.5"/>

  <!-- footer details -->
  <text x="${RX}" y="544" font-family="Poppins" font-weight="600" font-size="19" letter-spacing="1.2" fill="#7fa4ff">DATE &amp; TIME</text>
  <text x="${RX}" y="580" font-family="Poppins" font-weight="600" font-size="24" fill="#ffffff">${dateTime}</text>

  <text x="${RX}" y="622" font-family="Poppins" font-weight="600" font-size="19" letter-spacing="1.2" fill="#7fa4ff">VENUE</text>
  <text x="${RX}" y="656" font-family="Poppins" font-weight="500" font-size="24" fill="#ffffff">${venue}</text>
</svg>`;

  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Poppins' },
    background: 'rgba(0,0,0,0)',
  });
  return resvg.render().asPng();
};

export default generateEventPass;
