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

// CareerX wordmark, white/blue-on-transparent — the pass card's glass
// surface is dark, so this is the same variant used on the site's navy
// pages. Genuinely transparent (chroma-keyed), so it blends on any
// background rather than needing a matching solid-color chip behind it.
const LOGO_DATA_URI = (() => {
  try {
    return `data:image/png;base64,${readFileSync(join(ASSETS, 'careerx-logo-dark.png')).toString('base64')}`;
  } catch {
    return '';
  }
})();

const EVENT = {
  date: process.env.EVENT_DATE || 'Saturday, 8 August 2026',
  time: process.env.EVENT_TIME || '9:30 AM Reg · 10:00 AM Start',
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
 * Immersive glass-card design: a vivid gradient backdrop with soft glow
 * orbs, one glassmorphic card on top holding the QR (in a halo'd white
 * chip) and delegate details (gradient wordmark, glass pills, a glowing
 * ticket-id chip) — aiming for a premium event-badge feel rather than a
 * flat dashboard card.
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

  const name = esc(truncate(reg.fullName, 20));
  const status = esc(reg.dopaStatus || '');
  const venue = esc(truncate(EVENT.venue, 42));
  const eventDate = esc(truncate(EVENT.date, 26));
  const eventTime = esc(truncate(EVENT.time, 34));
  const guestCount = Math.max(0, Math.trunc(Number(reg.guestCount) || 0));

  const CX1 = 460; // right column left edge (inside card)
  const CX2 = 1188; // right column right edge (inside card)

  const statusPill = status
    ? `<rect x="${CX1}" y="278" width="${Math.max(126, status.length * 15 + 56)}" height="46" rx="23" fill="#ffffff" fill-opacity="0.12" stroke="#7fc8ff" stroke-opacity="0.55" stroke-width="1.3"/>
  <text x="${CX1 + 26}" y="307" font-family="Poppins" font-weight="700" font-size="19" fill="#bfe6ff">${status}</text>`
    : '';

  const guestsPill = guestCount
    ? `<rect x="${CX2 - 166}" y="278" width="166" height="46" rx="23" fill="#ffffff" fill-opacity="0.12" stroke="#7dffc4" stroke-opacity="0.55" stroke-width="1.3"/>
  <text x="${CX2 - 83}" y="307" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="19" fill="#bdffdf">+${guestCount} guest${guestCount === 1 ? '' : 's'}</text>`
    : '';

  const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#070a2e"/>
      <stop offset="0.55" stop-color="#0b1264"/>
      <stop offset="1" stop-color="#001d3d"/>
    </linearGradient>
    <linearGradient id="wordmark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#5fd9ff"/>
    </linearGradient>
    <linearGradient id="cardStroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.06"/>
    </linearGradient>
    <linearGradient id="ticketGlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#00e5ff"/>
      <stop offset="1" stop-color="#6a8bff"/>
    </linearGradient>
    <filter id="blurLg" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="70"/>
    </filter>
    <filter id="blurMd" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <clipPath id="canvasClip"><rect width="1280" height="720"/></clipPath>
    <clipPath id="cardClip"><rect x="30" y="30" width="1220" height="660" rx="38"/></clipPath>
  </defs>

  <!-- ===== Backdrop ===== -->
  <rect width="1280" height="720" fill="url(#bg)"/>
  <g clip-path="url(#canvasClip)">
    <circle cx="1180" cy="60" r="260" fill="#00c2ff" opacity="0.30" filter="url(#blurLg)"/>
    <circle cx="60" cy="700" r="220" fill="#7a5cff" opacity="0.28" filter="url(#blurLg)"/>
    <circle cx="640" cy="760" r="180" fill="#00e5ff" opacity="0.14" filter="url(#blurLg)"/>
  </g>
  <!-- faint dot-grid texture, matches the site's hero pattern -->
  <g clip-path="url(#canvasClip)" opacity="0.05">
    <path d="M0 40H1280 M0 100H1280 M0 160H1280 M0 220H1280 M0 280H1280 M0 340H1280 M0 400H1280 M0 460H1280 M0 520H1280 M0 580H1280 M0 640H1280 M0 700H1280" stroke="#ffffff" stroke-width="1"/>
    <path d="M40 0V720 M100 0V720 M160 0V720 M220 0V720 M280 0V720 M340 0V720 M400 0V720 M460 0V720 M520 0V720 M580 0V720 M640 0V720 M700 0V720 M760 0V720 M820 0V720 M880 0V720 M940 0V720 M1000 0V720 M1060 0V720 M1120 0V720 M1180 0V720 M1240 0V720" stroke="#ffffff" stroke-width="1"/>
  </g>

  <!-- ===== Glass card ===== -->
  <rect x="30" y="30" width="1220" height="660" rx="38" fill="#0a0f3d" fill-opacity="0.38"/>
  <rect x="30" y="30" width="1220" height="660" rx="38" fill="none" stroke="url(#cardStroke)" stroke-width="1.5"/>

  <g clip-path="url(#cardClip)">
    <circle cx="1250" cy="90" r="170" fill="#00c2ff" opacity="0.16" filter="url(#blurMd)"/>

    <!-- Header: the logo image already includes the "Gateway to Medical
         Career" tagline, so only the text fallback repeats it separately. -->
    ${LOGO_DATA_URI
      ? `<image x="76" y="70" width="230" height="60" xlink:href="${LOGO_DATA_URI}"/>`
      : `<text x="76" y="128" font-family="Poppins" font-weight="800" font-size="52" fill="url(#wordmark)">CareerX</text>
    <text x="76" y="162" font-family="Poppins" font-weight="500" font-size="21" fill="#a9c3ff" opacity="0.85">The Gateway to Medical Career</text>`}

    <rect x="1000" y="70" width="188" height="46" rx="23" fill="#ffffff" fill-opacity="0.10" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.3"/>
    <text x="1094" y="99" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="18" letter-spacing="2.5" fill="#ffffff">ENTRY PASS</text>

    <line x1="76" y1="152" x2="1188" y2="152" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1.5"/>

    <!-- Left: QR with glow halo -->
    <circle cx="216" cy="336" r="180" fill="#00e5ff" opacity="0.22" filter="url(#blurMd)"/>
    <rect x="76" y="196" width="280" height="280" rx="28" fill="#ffffff"/>
    <image x="92" y="212" width="248" height="248" xlink:href="${qrDataUri}"/>
    <text x="216" y="512" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="19" fill="#d7e4ff">Show this at the entry desk</text>

    <!-- Right: delegate info -->
    <text x="${CX1}" y="206" font-family="Poppins" font-weight="600" font-size="18" letter-spacing="2.5" fill="#8fb2ff">DELEGATE</text>
    <text x="${CX1}" y="260" font-family="Poppins" font-weight="700" font-size="46" fill="#ffffff">${name}</text>

    ${statusPill}
    ${guestsPill}

    <line x1="${CX1}" y1="354" x2="${CX2}" y2="354" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1.5"/>

    <text x="${CX1}" y="402" font-family="Poppins" font-weight="600" font-size="17" letter-spacing="2.5" fill="#8fb2ff">TICKET ID</text>
    <rect x="${CX1}" y="418" width="340" height="70" rx="18" fill="#ffffff" fill-opacity="0.08" stroke="url(#ticketGlow)" stroke-opacity="0.65" stroke-width="1.5"/>
    <text x="${CX1 + 24}" y="463" font-family="Poppins" font-weight="700" font-size="34" fill="url(#ticketGlow)">${esc(code)}</text>

    <rect x="${CX1 + 358}" y="418" width="${CX2 - CX1 - 358}" height="70" rx="18" fill="#ffbf4a" fill-opacity="0.14" stroke="#ffbf4a" stroke-opacity="0.5" stroke-width="1.3"/>
    <text x="${CX1 + 382}" y="437" font-family="Poppins" font-weight="700" font-size="13" letter-spacing="1.2" fill="#ffd88a">DATE &amp; TIME</text>
    <text x="${CX1 + 382}" y="458" font-family="Poppins" font-weight="700" font-size="15" fill="#ffe9bc">${eventDate}</text>
    <text x="${CX1 + 382}" y="477" font-family="Poppins" font-weight="600" font-size="13" fill="#ffe9bc" opacity="0.9">${eventTime}</text>

    <text x="${CX1}" y="532" font-family="Poppins" font-weight="600" font-size="17" letter-spacing="2.5" fill="#8fb2ff">VENUE</text>
    <text x="${CX1}" y="562" font-family="Poppins" font-weight="600" font-size="23" fill="#eef3ff">${venue}</text>

    <text x="${CX1}" y="626" font-family="Poppins" font-weight="500" font-size="15" letter-spacing="1.5" fill="#7d93c9">DOPA COACHING · FREE ENTRY</text>
  </g>
</svg>`;

  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Poppins' },
    background: 'rgba(0,0,0,0)',
  });
  return resvg.render().asPng();
};

export default generateEventPass;
