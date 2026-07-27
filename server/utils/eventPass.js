import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode';
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

const EVENT = {
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
 * Boarding-pass style: a dark navy QR stub on the left, torn away (via
 * perforation notches + a dashed divider) from a light info panel on the
 * right — modeled on a real event ticket rather than a generic dashboard card.
 *
 * @param {object} reg  { fullName, registrationNumber, dopaStatus, guestCount }
 * @returns {Promise<Buffer>}
 */
export const generateEventPass = async (reg) => {
  const code = String(reg.registrationNumber || '');

  // High error-correction so the code still scans if printed small or partly
  // covered by a thumb — this is what a gate scanner actually reads.
  const qrDataUri = await QRCode.toDataURL(code, {
    width: 560,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#0a0f3d', light: '#FFFFFF' },
  });

  const name = esc(truncate(reg.fullName, 22));
  const status = esc(reg.dopaStatus || '');
  const time = esc(EVENT.time);
  const venue = esc(truncate(EVENT.venue, 46));
  const guestCount = Math.max(0, Math.trunc(Number(reg.guestCount) || 0));

  // Layout: card inset 28, radius 40 -> outer box x[28..1252] y[28..692].
  // Stub (QR side): x[28..392]. Divider seam: x=392. Panel (info side): x[392..1252].
  const SEAM = 392;
  const PX = 440; // panel content left edge
  const PR = 1204; // panel content right edge

  const statusPill = status
    ? `<rect x="${PX}" y="336" width="${Math.max(120, status.length * 15 + 48)}" height="42" rx="21" fill="#eaf4ff"/>
  <text x="${PX + 24}" y="363" font-family="Poppins" font-weight="700" font-size="19" fill="#0a58c7">${status}</text>`
    : '';

  const guestsPill = guestCount
    ? `<rect x="${PR - 150}" y="336" width="150" height="42" rx="21" fill="#e9fbf3"/>
  <text x="${PR - 75}" y="363" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="19" fill="#0a8a58">+${guestCount} guest${guestCount === 1 ? '' : 's'}</text>`
    : '';

  // Perforation: a dashed seam + small "torn" notches cut into the card edge
  // at top and bottom (filled with the outer canvas colour so they read as
  // punched through), like a real ticket stub.
  const perforation = `
  <line x1="${SEAM}" y1="52" x2="${SEAM}" y2="668" stroke="#c7d2e8" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round"/>
  <circle cx="${SEAM}" cy="28" r="22" fill="#05082b"/>
  <circle cx="${SEAM}" cy="692" r="22" fill="#05082b"/>`;

  const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#05082b"/>
      <stop offset="1" stop-color="#020314"/>
    </linearGradient>
    <linearGradient id="stub" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1720d6"/>
      <stop offset="1" stop-color="#050b95"/>
    </linearGradient>
    <clipPath id="cardClip"><rect x="28" y="28" width="1224" height="664" rx="40"/></clipPath>
  </defs>

  <rect width="1280" height="720" fill="url(#bg)"/>

  <g clip-path="url(#cardClip)">
    <!-- panel (right, light) -->
    <rect x="28" y="28" width="1224" height="664" fill="#f5f7fd"/>
    <!-- stub (left, dark) -->
    <rect x="28" y="28" width="${SEAM - 28}" height="664" fill="url(#stub)"/>
    <!-- decorative accent glow on the stub -->
    <circle cx="70" cy="640" r="180" fill="#00c2ff" opacity="0.18"/>
    <!-- thin top accent bar on the panel -->
    <rect x="${SEAM}" y="28" width="${1252 - SEAM}" height="8" fill="#00c2ff"/>
  </g>
  <rect x="28" y="28" width="1224" height="664" rx="40" fill="none" stroke="#e3e8f5" stroke-width="1.5"/>

  <!-- ===== STUB: QR ===== -->
  <text x="${(28 + SEAM) / 2}" y="96" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="22" letter-spacing="3" fill="#ffffff">ENTRY PASS</text>

  <rect x="66" y="150" width="260" height="260" rx="24" fill="#ffffff"/>
  <image x="80" y="164" width="232" height="232" xlink:href="${qrDataUri}"/>

  <text x="${(28 + SEAM) / 2}" y="452" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="19" fill="#c3d0ff">Show this at the entry desk</text>

  <text x="${(28 + SEAM) / 2}" y="600" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="17" letter-spacing="2" fill="#7fa4ff">TICKET ID</text>
  <text x="${(28 + SEAM) / 2}" y="632" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="30" fill="#00e0ff">${esc(code)}</text>

  ${perforation}

  <!-- ===== PANEL: INFO ===== -->
  <text x="${PX}" y="112" font-family="Poppins" font-weight="800" font-size="46" fill="#0a0f3d">CareerX</text>
  <text x="${PX}" y="146" font-family="Poppins" font-weight="500" font-size="20" fill="#5b6478">The Gateway to Medical Career</text>

  <line x1="${PX}" y1="182" x2="${PR}" y2="182" stroke="#0a0f3d" stroke-opacity="0.08" stroke-width="1.5"/>

  <text x="${PX}" y="234" font-family="Poppins" font-weight="600" font-size="19" letter-spacing="2" fill="#8b93ab">DELEGATE</text>
  <text x="${PX}" y="288" font-family="Poppins" font-weight="700" font-size="44" fill="#0a0f3d">${name}</text>

  ${statusPill}
  ${guestsPill}

  <line x1="${PX}" y1="410" x2="${PR}" y2="410" stroke="#0a0f3d" stroke-opacity="0.08" stroke-width="1.5"/>

  <!-- Date pending notice — deliberately prominent since the date isn't final yet -->
  <rect x="${PX}" y="440" width="${PR - PX}" height="64" rx="16" fill="#fff4dd"/>
  <text x="${PX + 22}" y="465" font-family="Poppins" font-weight="700" font-size="17" letter-spacing="1.5" fill="#9a6400">DATE</text>
  <text x="${PX + 22}" y="491" font-family="Poppins" font-weight="700" font-size="22" fill="#7a4e00">Will be notified soon</text>

  <text x="${PX}" y="556" font-family="Poppins" font-weight="600" font-size="17" letter-spacing="2" fill="#8b93ab">TIME</text>
  <text x="${PX}" y="586" font-family="Poppins" font-weight="700" font-size="25" fill="#0a0f3d">${time}</text>

  <text x="${PX}" y="626" font-family="Poppins" font-weight="600" font-size="17" letter-spacing="2" fill="#8b93ab">VENUE</text>
  <text x="${PX}" y="656" font-family="Poppins" font-weight="600" font-size="23" fill="#0a0f3d">${venue}</text>
</svg>`;

  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Poppins' },
    background: 'rgba(0,0,0,0)',
  });
  return resvg.render().asPng();
};

export default generateEventPass;
