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

// DOPA wordmark, embedded so the renderer needs no external fetch.
const LOGO_DATA_URI = (() => {
  try {
    return `data:image/png;base64,${readFileSync(join(ASSETS, 'dopa-logo.png')).toString('base64')}`;
  } catch {
    return '';
  }
})();

const EVENT = {
  date: process.env.EVENT_DATE || '12 July 2026',
  time: process.env.EVENT_TIME || '9:30 AM – 4:00 PM',
  venue: process.env.EVENT_VENUE || 'Yamaniya Hall, Kuttikattor',
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
 * Build the branded NEET CON 2026 entry pass for a confirmed registration and
 * return it as a PNG buffer. Renders deterministically (bundled Poppins font +
 * embedded QR/logo) so it looks identical on every platform.
 *
 * @param {object} reg  { fullName, registrationNumber, preparingFor }
 * @returns {Promise<Buffer>}
 */
export const generateEventPass = async (reg) => {
  const code = String(reg.registrationNumber || '');

  const qrDataUri = await QRCode.toDataURL(code, {
    width: 560,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: { dark: '#0b1733', light: '#FFFFFF' },
  });

  const name = esc(truncate(reg.fullName, 20));
  const prep = esc(reg.preparingFor || reg.currentStatus || '');
  const date = esc(EVENT.date);
  const time = esc(EVENT.time);
  const venue = esc(truncate(EVENT.venue, 32));

  // Layout grid: card inset 28; inner padding 44 -> content box x[72..1208] y[72..648].
  // Left column = QR (x 72, w 296); right column = info (x 440, right edge 1208).
  const RX = 440; // right column left edge
  const RR = 1208; // right column right edge

  const categoryBlock = prep
    ? `<text x="${RR}" y="544" text-anchor="end" font-family="Poppins" font-weight="600" font-size="20" letter-spacing="1.5" fill="#6f9bff">CATEGORY</text>
  <text x="${RR}" y="580" text-anchor="end" font-family="Poppins" font-weight="600" font-size="27" fill="#ffffff">${prep}</text>`
    : '';

  const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#060a16"/>
      <stop offset="1" stop-color="#02040c"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2c49ff"/>
      <stop offset="1" stop-color="#0a1d8c"/>
    </linearGradient>
    <clipPath id="cardClip"><rect x="28" y="28" width="1224" height="664" rx="40"/></clipPath>
  </defs>

  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="28" y="28" width="1224" height="664" rx="40" fill="url(#card)"/>

  <!-- decorative accent swooshes, clipped to the card -->
  <g clip-path="url(#cardClip)" opacity="0.9">
    <circle cx="1230" cy="70" r="220" fill="#00aff5" opacity="0.16"/>
    <circle cx="1180" cy="40" r="120" fill="#5b93ff" opacity="0.22"/>
    <rect x="1040" y="-40" width="320" height="58" rx="29" fill="#00aff5" transform="rotate(35 1200 80)" opacity="0.5"/>
  </g>

  <!-- ===== LEFT COLUMN: QR ===== -->
  <rect x="72" y="72" width="216" height="62" rx="16" fill="#0a1020"/>
  <text x="180" y="111" font-family="Poppins" font-weight="600" font-size="25" letter-spacing="3" fill="#ffffff" text-anchor="middle">ENTRY PASS</text>

  <rect x="72" y="176" width="296" height="296" rx="26" fill="#ffffff"/>
  <image x="98" y="202" width="244" height="244" xlink:href="${qrDataUri}"/>
  <text x="220" y="512" font-family="Poppins" font-weight="500" font-size="21" fill="#cdd9ff" text-anchor="middle">Show this at the entry desk</text>

  <!-- ===== RIGHT COLUMN: INFO ===== -->
  ${LOGO_DATA_URI ? `<image x="1032" y="78" width="176" height="50" xlink:href="${LOGO_DATA_URI}"/>` : ''}

  <text x="${RX}" y="130" font-family="Poppins" font-weight="700" font-size="58" fill="#ffffff">NEET CON 2026</text>
  <text x="${RX}" y="168" font-family="Poppins" font-weight="500" font-size="22" fill="#b9c7ff">Kerala's NEET counselling &amp; strategy conclave</text>
  <line x1="${RX}" y1="202" x2="${RR}" y2="202" stroke="#ffffff" stroke-opacity="0.13" stroke-width="1.5"/>

  <text x="${RX}" y="258" font-family="Poppins" font-weight="600" font-size="21" letter-spacing="2" fill="#6f9bff">DELEGATE NAME</text>
  <text x="${RX}" y="316" font-family="Poppins" font-weight="700" font-size="50" fill="#ffffff">${name}</text>

  <text x="${RX}" y="396" font-family="Poppins" font-weight="600" font-size="21" letter-spacing="2" fill="#6f9bff">REGISTRATION CODE</text>
  <text x="${RX}" y="452" font-family="Poppins" font-weight="700" font-size="46" fill="#00d0ff">${esc(code)}</text>

  <line x1="${RX}" y1="504" x2="${RR}" y2="504" stroke="#ffffff" stroke-opacity="0.13" stroke-width="1.5"/>

  <!-- footer details -->
  <text x="${RX}" y="544" font-family="Poppins" font-weight="600" font-size="20" letter-spacing="1.5" fill="#6f9bff">DATE</text>
  <text x="${RX}" y="580" font-family="Poppins" font-weight="600" font-size="27" fill="#ffffff">${date}</text>
  <text x="720" y="544" font-family="Poppins" font-weight="600" font-size="20" letter-spacing="1.5" fill="#6f9bff">TIME</text>
  <text x="720" y="580" font-family="Poppins" font-weight="600" font-size="27" fill="#ffffff">${time}</text>
  ${categoryBlock}

  <text x="${RX}" y="624" font-family="Poppins" font-weight="600" font-size="20" letter-spacing="1.5" fill="#6f9bff">VENUE</text>
  <text x="${RX}" y="658" font-family="Poppins" font-weight="500" font-size="24" fill="#ffffff">${venue}</text>
</svg>`;

  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Poppins' },
    background: 'rgba(0,0,0,0)',
  });
  return resvg.render().asPng();
};

export default generateEventPass;
