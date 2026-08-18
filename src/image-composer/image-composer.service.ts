import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import axios from 'axios';
import { GroqContentResult } from '../groq/groq.service';

export interface InfographicContent extends GroqContentResult {
  niche?: string;
}

@Injectable()
export class ImageComposerService {
  private readonly logger = new Logger(ImageComposerService.name);
  private readonly W = 1080;
  private readonly H = 1080;

  private readonly NICHE_BG_MAP: Record<string, string> = {
    technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&h=1080&q=80',
    business: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1080&h=1080&q=80',
    finance: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1080&h=1080&q=80',
    entertainment: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1080&h=1080&q=80',
    sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1080&h=1080&q=80',
    health: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1080&h=1080&q=80',
    science: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1080&h=1080&q=80',
    fashion: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1080&h=1080&q=80',
    food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1080&h=1080&q=80',
    travel: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1080&h=1080&q=80',
    gaming: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1080&h=1080&q=80',
    general: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1080&h=1080&q=80'
  };

  async composeInfographic(content: InfographicContent): Promise<Buffer> {
    this.logger.log(`Composing layout: ${content.layout} for niche: ${content.niche ?? 'general'}`);
    
    // Fetch background image as base64 dynamically
    const bgBase64 = await this.getBackgroundBase64(content.niche);

    let svg: string;
    switch (content.layout) {
      case 'NUMBERED_TABLE':   svg = this.buildNumberedTable(content, bgBase64); break;
      case 'CARD_SECTIONS':    svg = this.buildCardSections(content, bgBase64);  break;
      case 'GUIDE_MATRIX':     svg = this.buildGuideMatrix(content, bgBase64);   break;
      case 'STORY_CHECKLIST':
      default:                 svg = this.buildStoryChecklist(content, bgBase64); break;
    }
    return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
  }

  // ─── UTILITIES ───────────────────────────────────────────────

  private x(s: any): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Fetch niche background image dynamically and encode to Base64 to bypass SVG sandbox limits */
  private async getBackgroundBase64(niche?: string): Promise<string> {
    const url = this.NICHE_BG_MAP[niche?.toLowerCase() ?? 'general'] ?? this.NICHE_BG_MAP.general;
    try {
      this.logger.log(`Fetching background image for niche: ${niche ?? 'general'}`);
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const base64 = Buffer.from(response.data).toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch background image: ${msg}. Using fallback colors.`);
      return '';
    }
  }

  /** Break a string into lines of max `maxChars` chars. Returns array of strings. */
  private wrap(text: string, maxChars: number, maxLines = 2): string[] {
    const words = String(text ?? '').split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if (lines.length >= maxLines) break;
      const test = cur ? `${cur} ${w}` : w;
      if (test.length <= maxChars) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = w.slice(0, maxChars);
      }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    return lines.length ? lines : [''];
  }

  /** Render multiline text as SVG tspan elements */
  private tspans(lines: string[], x: number, y: number, dy: number, attr = ''): string {
    return lines.map((l, i) =>
      `<tspan x="${x}" dy="${i === 0 ? 0 : dy}" ${attr}>${this.x(l)}</tspan>`
    ).join('');
  }

  /** Common SVG gradients, patterns, and filters for high-end styling */
  private buildSharedDefs(): string {
    return `
      <defs>
        <!-- Text Drop Shadow Filter -->
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.8"/>
        </filter>

        <!-- Background blur filter -->
        <filter id="glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="95" result="blur"/>
        </filter>

        <!-- Dot grid pattern -->
        <pattern id="dot-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="#ffffff" fill-opacity="0.08"/>
        </pattern>

        <!-- Gradients -->
        <linearGradient id="purple-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8B5CF6"/>
          <stop offset="100%" stop-color="#3B82F6"/>
        </linearGradient>
        <linearGradient id="orange-pink" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#EC4899"/>
        </linearGradient>
        <linearGradient id="emerald-teal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#06B6D4"/>
        </linearGradient>
        <linearGradient id="rose-red" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F43F5E"/>
          <stop offset="100%" stop-color="#E11D48"/>
        </linearGradient>
        <linearGradient id="silver-gray" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E5E7EB"/>
          <stop offset="100%" stop-color="#9CA3AF"/>
        </linearGradient>

        <!-- Glassmorphism Border Gradient -->
        <linearGradient id="border-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18"/>
          <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.04"/>
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.18"/>
        </linearGradient>
      </defs>
    `;
  }

  // ─── LAYOUT 1: NUMBERED TABLE ────────────────────────────────
  // Premium dark-mode leaderboard, glowing badges, clean design
  // ─────────────────────────────────────────────────────────────
  private buildNumberedTable(c: InfographicContent, bgBase64: string): string {
    const rows = (c.rows ?? []).slice(0, 10);
    const headers = c.tableHeaders ?? ['#', 'Category', 'Value'];

    // Dynamic row height based on number of rows
    const HEADER_AREA = 200;
    const FOOTER_AREA = 100;
    const TABLE_START = HEADER_AREA + 52;
    const TABLE_END = this.H - FOOTER_AREA;
    const ROWS_MAX_HEIGHT = TABLE_END - TABLE_START;
    const ROW_H = Math.floor(ROWS_MAX_HEIGHT / Math.max(rows.length, 1));
    const COL1_X = 60;
    const COL2_X = 180;
    const COL3_X = 720;
    const COL3_W = this.W - COL3_X - 60;

    const headerRow = `
      <rect x="${COL1_X}" y="${HEADER_AREA}" width="${this.W - 120}" height="52" fill="#1E293B" fill-opacity="0.8" rx="8" stroke="url(#border-grad)" stroke-width="1.5"/>
      <text x="${COL1_X + 40}" y="${HEADER_AREA + 33}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="22" font-weight="bold" fill="#F3F4F6"
        text-anchor="middle" filter="url(#shadow)">#</text>
      <text x="${(COL2_X + COL3_X) / 2}" y="${HEADER_AREA + 33}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="22" font-weight="bold" fill="#F3F4F6"
        text-anchor="middle" filter="url(#shadow)">${this.x(headers[1] ?? 'Category')}</text>
      <text x="${COL3_X + COL3_W / 2}" y="${HEADER_AREA + 33}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="22" font-weight="bold" fill="#F3F4F6"
        text-anchor="middle" filter="url(#shadow)">${this.x(headers[2] ?? 'Value')}</text>
    `;

    const tableRows = rows.map((row: any, i: number) => {
      const y = TABLE_START + i * ROW_H;
      const bg = i % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.06)';
      const badgeFill = i === 0 ? 'url(#orange-pink)' : (i < 3 ? '#3B82F6' : '#1E293B');
      const col1Lines = this.wrap(row.col1 ?? row.col2 ?? '', 28, 2);
      const col2Lines = this.wrap(row.col2 ?? row.col3 ?? '', 14, 2);
      const midY = y + ROW_H / 2;

      return `
        <rect x="${COL1_X}" y="${y}" width="${this.W - 120}" height="${ROW_H - 4}" fill="${bg}" rx="8" stroke="url(#border-grad)" stroke-width="1"/>
        <circle cx="${COL1_X + 40}" cy="${midY - 2}" r="22" fill="${badgeFill}"/>
        <text x="${COL1_X + 40}" y="${midY + 6}"
          font-family="'Montserrat', 'Inter', sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF"
          text-anchor="middle" filter="url(#shadow)">${row.number ?? i + 1}</text>
        <text x="${COL2_X + 12}" y="${midY + (col1Lines.length > 1 ? -8 : 6)}"
          font-family="'Inter', 'Segoe UI', sans-serif" font-size="24" font-weight="600" fill="#F3F4F6">
          ${this.tspans(col1Lines, COL2_X + 12, midY + (col1Lines.length > 1 ? -8 : 6), 26)}
        </text>
        <text x="${COL3_X + COL3_W / 2}" y="${midY + (col2Lines.length > 1 ? -8 : 6)}"
          font-family="'Montserrat', 'Inter', sans-serif" font-size="24" font-weight="bold" fill="url(#emerald-teal)"
          text-anchor="middle">
          ${this.tspans(col2Lines, COL3_X + COL3_W / 2, midY + (col2Lines.length > 1 ? -8 : 6), 26)}
        </text>
      `;
    }).join('');

    const hlLines = this.wrap(c.headline, 28, 2);
    const subLines = this.wrap(c.subheadline ?? '', 54, 2);
    let hlBaseY = 90;
    let subY = 145;
    if (hlLines.length > 1) {
      hlBaseY = 65;
      subY = 155;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.W}" height="${this.H}">
      <!-- Shared Definitions -->
      ${this.buildSharedDefs()}

      <!-- Base Background -->
      <rect width="${this.W}" height="${this.H}" fill="#0B0F19"/>

      <!-- Niche specific background image -->
      ${bgBase64 ? `<image href="${bgBase64}" width="${this.W}" height="${this.H}" preserveAspectRatio="xMidYMid slice" opacity="0.22"/>` : ''}

      <!-- Texture grid overlay -->
      <rect width="${this.W}" height="${this.H}" fill="url(#dot-grid)"/>

      <!-- Top stripe -->
      <rect width="${this.W}" height="10" fill="url(#orange-pink)"/>

      <!-- Title Badge -->
      <rect x="440" y="32" width="200" height="26" fill="#F59E0B" fill-opacity="0.15" rx="13" stroke="#F59E0B" stroke-opacity="0.4" stroke-width="1"/>
      <text x="540" y="49" font-family="'Montserrat', 'Inter', sans-serif" font-size="12" font-weight="900" fill="#FBBF24" letter-spacing="2" text-anchor="middle">TIPS &amp; INSIGHTS</text>

      <!-- Headline -->
      <text x="${this.W / 2}" y="${hlBaseY}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="48" font-weight="900"
        fill="url(#orange-pink)" text-anchor="middle" filter="url(#shadow)">
        ${this.tspans(hlLines, this.W / 2, hlBaseY, 52)}
      </text>

      <!-- Subheadline -->
      <text x="${this.W / 2}" y="${subY}"
        font-family="'Inter', 'Segoe UI', sans-serif" font-size="26" fill="#9CA3AF" text-anchor="middle">
        ${this.tspans(subLines, this.W / 2, subY, 30)}
      </text>

      <!-- Accent line -->
      <rect x="340" y="195" width="400" height="3" rx="1.5" fill="url(#orange-pink)"/>

      ${headerRow}
      ${tableRows}

      <!-- Footer note -->
      <text x="${this.W / 2}" y="${this.H - 40}"
        font-family="'Inter', 'Segoe UI', sans-serif" font-size="20" fill="#6B7280"
        text-anchor="middle" font-style="italic">
        ${this.x(c.footerNote ?? '')}
      </text>
      <!-- Bottom stripe -->
      <rect y="${this.H - 10}" width="${this.W}" height="10" fill="url(#orange-pink)"/>
    </svg>`;
  }

  // ─── LAYOUT 2: CARD SECTIONS ─────────────────────────────────
  // 2×2 grid of glassmorphic dashboard cards, SaaS theme
  // ─────────────────────────────────────────────────────────────
  private buildCardSections(c: InfographicContent, bgBase64: string): string {
    const sections = (c.sections ?? []).slice(0, 4);
    const GAP = 20;
    const CARD_W = (this.W - 80 - GAP) / 2;
    const START_Y = 260;
    const CARD_H = (this.H - START_Y - GAP - 110) / 2; // 345
    const START_X = 40;
    const SECTION_COLORS = ['#10B981','#3B82F6','#F59E0B','#EC4899'];

    const cards = sections.map((sec: any, i: number) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = START_X + col * (CARD_W + GAP);
      const cy = START_Y + row * (CARD_H + GAP);
      const color = sec.color ?? SECTION_COLORS[i % SECTION_COLORS.length];
      const items = (sec.items ?? []).slice(0, 4);
      const itemH = (CARD_H - 64) / Math.max(items.length, 1);

      const itemsSvg = items.map((item: any, j: number) => {
        const iy = cy + 64 + j * itemH;
        const labelLines = this.wrap(item.label ?? '', 18, 1);
        const valueLines = this.wrap(item.value ?? '', 12, 1);
        return `
          <text x="${cx + 20}" y="${iy + itemH / 2 + 6}"
            font-family="'Inter', 'Segoe UI', sans-serif" font-size="22" fill="#D1D5DB">
            ${this.tspans(labelLines, cx + 20, iy + itemH / 2 + 6, 26)}
          </text>
          <text x="${cx + CARD_W - 20}" y="${iy + itemH / 2 + 6}"
            font-family="'Montserrat', 'Inter', sans-serif" font-size="24" font-weight="bold"
            fill="${color}" text-anchor="end" filter="url(#shadow)">
            ${this.tspans(valueLines, cx + CARD_W - 20, iy + itemH / 2 + 6, 28)}
          </text>
          ${j < items.length - 1
            ? `<line x1="${cx + 16}" y1="${iy + itemH - 2}" x2="${cx + CARD_W - 16}" y2="${iy + itemH - 2}"
                stroke="rgba(255, 255, 255, 0.08)" stroke-width="1"/>`
            : ''}
        `;
      }).join('');

      return `
        <!-- Card base -->
        <rect x="${cx}" y="${cy}" width="${CARD_W}" height="${CARD_H}"
          fill="#111827" fill-opacity="0.65" rx="16" stroke="url(#border-grad)" stroke-width="1.5"/>
        
        <!-- Card top banner with accent border -->
        <rect x="${cx}" y="${cy}" width="${CARD_W}" height="54" fill="${color}" fill-opacity="0.08" rx="16"/>
        <path d="M ${cx} ${cy + 54} L ${cx} ${cy + 16} A 16 16 0 0 1 ${cx + 16} ${cy} L ${cx + CARD_W - 16} ${cy} A 16 16 0 0 1 ${cx + CARD_W} ${cy + 16} L ${cx + CARD_W} ${cy + 54} Z" fill="none" stroke="${color}" stroke-width="2"/>
        
        <!-- Card Header Text -->
        <text x="${cx + 20}" y="${cy + 34}"
          font-family="'Montserrat', 'Inter', sans-serif" font-size="22" font-weight="bold" fill="#FFFFFF" filter="url(#shadow)">
          ${this.x(sec.emoji ?? '')}  ${this.x(sec.title ?? '')}
        </text>
        
        ${itemsSvg}
      `;
    }).join('');

    const hlLines = this.wrap(c.headline, 20, 2);
    const subLines = this.wrap(c.subheadline ?? '', 54, 2);
    let hlBaseY = 110;
    let subY = 175;
    if (hlLines.length > 1) {
      hlBaseY = 85;
      subY = 210;
    }
    const totalLines = this.wrap(c.totalLine ?? '', 54, 2);
    const totalY = START_Y + 2 * CARD_H + GAP + 10;
    const totalH = 68;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.W}" height="${this.H}">
      <!-- Shared Definitions -->
      ${this.buildSharedDefs()}

      <!-- Base Background -->
      <rect width="${this.W}" height="${this.H}" fill="#0B0F19"/>

      <!-- Niche specific background image -->
      ${bgBase64 ? `<image href="${bgBase64}" width="${this.W}" height="${this.H}" preserveAspectRatio="xMidYMid slice" opacity="0.22"/>` : ''}

      <!-- Texture grid overlay -->
      <rect width="${this.W}" height="${this.H}" fill="url(#dot-grid)"/>

      <!-- Top stripe -->
      <rect width="${this.W}" height="10" fill="url(#orange-pink)"/>

      <!-- Title Badge -->
      <rect x="440" y="32" width="200" height="26" fill="#EC4899" fill-opacity="0.15" rx="13" stroke="#EC4899" stroke-opacity="0.4" stroke-width="1"/>
      <text x="540" y="49" font-family="'Montserrat', 'Inter', sans-serif" font-size="12" font-weight="900" fill="#F472B6" letter-spacing="2" text-anchor="middle">DATA BREAKDOWN</text>

      <!-- Headline -->
      <text x="${this.W / 2}" y="${hlBaseY}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="56" font-weight="900"
        fill="url(#orange-pink)" text-anchor="middle" filter="url(#shadow)">
        ${this.tspans(hlLines, this.W / 2, hlBaseY, 60)}
      </text>
      <!-- Subheadline -->
      <text x="${this.W / 2}" y="${subY}"
        font-family="'Inter', 'Segoe UI', sans-serif" font-size="28" fill="#9CA3AF" text-anchor="middle">
        ${this.tspans(subLines, this.W / 2, subY, 32)}
      </text>

      ${cards}

      <!-- Total bar -->
      <rect x="40" y="${totalY}" width="${this.W - 80}" height="${totalH}" fill="#111827" fill-opacity="0.75" rx="12" stroke="url(#orange-pink)" stroke-width="2"/>
      <text x="${this.W / 2}" y="${totalY + (totalLines.length > 1 ? 26 : 42)}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="24" font-weight="bold"
        fill="#FFFFFF" text-anchor="middle" filter="url(#shadow)">
        ${this.tspans(totalLines, this.W / 2, totalY + (totalLines.length > 1 ? 26 : 42), 26)}
      </text>

      <!-- Source note -->
      <text x="${this.W / 2}" y="${this.H - 28}"
        font-family="'Inter', 'Segoe UI', sans-serif" font-size="20" fill="#6B7280"
        text-anchor="middle" font-style="italic">
        ${this.x(c.sourceNote ?? '')}
      </text>
      <rect y="${this.H - 10}" width="${this.W}" height="10" fill="url(#orange-pink)"/>
    </svg>`;
  }

  // ─── LAYOUT 3: STORY CHECKLIST ───────────────────────────────
  // Premium step cards, glowing margins, custom takeaway panel
  // ─────────────────────────────────────────────────────────────
  private buildStoryChecklist(c: InfographicContent, bgBase64: string): string {
    const steps = (c.steps ?? []).slice(0, 5);
    const lessons = (c.lessonPoints ?? []).slice(0, 2);

    // Calculate dynamic heights
    const HEADER_H = 180;
    const STEPS_AREA = 680;
    const STEP_H = Math.floor(STEPS_AREA / Math.max(steps.length, 1));
    const STEP_GAP = 10;

    const stepsSvg = steps.map((step: any, i: number) => {
      const y = HEADER_H + i * STEP_H + STEP_GAP / 2;
      const h = STEP_H - STEP_GAP;
      const leftBorder = step.highlight ? 'url(#orange-pink)' : '#3B82F6';
      const textLines = this.wrap(step.text ?? '', 38, 2);
      const textStartY = y + h / 2 + (textLines.length > 1 ? -12 : 6);

      return `
        <!-- Step card -->
        <rect x="60" y="${y}" width="${this.W - 120}" height="${h}"
          fill="#111827" fill-opacity="0.5" rx="12" stroke="url(#border-grad)" stroke-width="1.2"/>
        
        <!-- Accent left border -->
        <rect x="60" y="${y}" width="6" height="${h}"
          fill="${leftBorder}" rx="3"/>
          
        <!-- Step number circle badge -->
        <circle cx="115" cy="${y + h / 2}" r="22" fill="${leftBorder}"/>
        <text x="115" y="${y + h / 2 + 8}"
          font-family="'Montserrat', 'Inter', sans-serif" font-size="22" font-weight="bold"
          fill="white" text-anchor="middle" filter="url(#shadow)">${i + 1}</text>
          
        <!-- Emoji -->
        <text x="165" y="${y + h / 2 + 10}"
          font-family="Arial" font-size="28">${this.x(step.icon ?? '✅')}</text>
          
        <!-- Step text -->
        <text x="210" y="${textStartY}"
          font-family="'Inter', 'Segoe UI', sans-serif" font-size="24" font-weight="600" fill="#F3F4F6">
          ${this.tspans(textLines, 210, textStartY, 30)}
        </text>
      `;
    }).join('');

    const lessonY = HEADER_H + steps.length * STEP_H;
    const lessonLines = [
      ...(lessons[0] ? this.wrap(`• ${lessons[0]}`, 48, 2) : []),
      ...(lessons[1] ? this.wrap(`• ${lessons[1]}`, 48, 2) : [])
    ];
    const ctaLines = this.wrap(c.ctaText ?? '👉 Follow for more!', 50, 1);

    const hlLines = this.wrap(c.headline, 24, 2);
    const subLines = this.wrap(c.subheadline ?? '', 54, 2);
    let hlBaseY = 95;
    let subY = 145;
    if (hlLines.length > 1) {
      hlBaseY = 70;
      subY = 160;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.W}" height="${this.H}">
      <!-- Shared Definitions -->
      ${this.buildSharedDefs()}

      <!-- Base Background -->
      <rect width="${this.W}" height="${this.H}" fill="#0B0F19"/>

      <!-- Niche specific background image -->
      ${bgBase64 ? `<image href="${bgBase64}" width="${this.W}" height="${this.H}" preserveAspectRatio="xMidYMid slice" opacity="0.22"/>` : ''}

      <!-- Texture grid overlay -->
      <rect width="${this.W}" height="${this.H}" fill="url(#dot-grid)"/>

      <!-- Top stripe -->
      <rect width="${this.W}" height="10" fill="url(#emerald-teal)"/>

      <!-- Title Badge -->
      <rect x="440" y="32" width="200" height="26" fill="#10B981" fill-opacity="0.15" rx="13" stroke="#10B981" stroke-opacity="0.4" stroke-width="1"/>
      <text x="540" y="49" font-family="'Montserrat', 'Inter', sans-serif" font-size="12" font-weight="900" fill="#34D399" letter-spacing="2" text-anchor="middle">STRATEGY GUIDE</text>

      <!-- Headline -->
      <text x="${this.W / 2}" y="${hlBaseY}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="48" font-weight="900"
        fill="url(#orange-pink)" text-anchor="middle" filter="url(#shadow)">
        ${this.tspans(hlLines, this.W / 2, hlBaseY, 52)}
      </text>
      <!-- Subheadline -->
      <text x="${this.W / 2}" y="${subY}"
        font-family="'Inter', 'Segoe UI', sans-serif" font-size="24" fill="#9CA3AF" text-anchor="middle">
        ${this.tspans(subLines, this.W / 2, subY, 28)}
      </text>

      ${stepsSvg}

      <!-- Lesson box -->
      <rect x="60" y="${lessonY + 10}" width="${this.W - 120}" height="118"
        fill="#111827" fill-opacity="0.6" rx="12" stroke="url(#emerald-teal)" stroke-width="2"/>
      <text x="84" y="${lessonY + 38}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="24" font-weight="bold" fill="url(#emerald-teal)" filter="url(#shadow)">
        ${this.x(c.lessonTitle ?? '💡 Key Takeaway')}
      </text>
      <text x="84" y="${lessonY + 64}"
        font-family="'Inter', 'Segoe UI', sans-serif" font-size="22" font-weight="600" fill="#F3F4F6">
        ${this.tspans(lessonLines, 84, lessonY + 64, 26)}
      </text>

      <!-- CTA bar -->
      <rect x="60" y="${lessonY + 135}" width="${this.W - 120}" height="50"
        fill="url(#orange-pink)" rx="12"/>
      <text x="${this.W / 2}" y="${lessonY + 167}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="26" font-weight="bold"
        fill="white" text-anchor="middle" filter="url(#shadow)">
        ${this.tspans(ctaLines, this.W / 2, lessonY + 167, 28)}
      </text>

      <!-- Bottom stripe -->
      <rect y="${this.H - 10}" width="${this.W}" height="10" fill="url(#emerald-teal)"/>
    </svg>`;
  }

  // ─── LAYOUT 4: GUIDE MATRIX ──────────────────────────────────
  // Dual-column comparison panel (Switch vs Don't), neon green/red
  // ─────────────────────────────────────────────────────────────
  private buildGuideMatrix(c: InfographicContent, bgBase64: string): string {
    const mRows = (c.matrixRows ?? []).slice(0, 4);
    const rules = (c.rules ?? []).slice(0, 3);

    const HEADER_H = 210;
    const COL_HEADER_H = 44;
    const RULES_H = rules.length ? 130 : 0;
    const TAKEAWAY_H = 64;
    const FOOTER_H = RULES_H + TAKEAWAY_H + 20;
    const MATRIX_AREA = this.H - HEADER_H - COL_HEADER_H - FOOTER_H - 20;
    const ROW_H = Math.floor(MATRIX_AREA / Math.max(mRows.length, 1));

    const BADGE_X = 40;
    const BADGE_W = 180;
    const GAP = 12;
    const SWITCH_X = BADGE_X + BADGE_W + GAP;
    const SWITCH_W = (this.W - BADGE_X - BADGE_W - GAP * 3 - 40) / 2;
    const DONT_X = SWITCH_X + SWITCH_W + GAP;
    const DONT_W = SWITCH_W;

    const COL_TOP = HEADER_H;
    const ROW_TOP = COL_TOP + COL_HEADER_H;

    const colHeaders = `
      <rect x="${SWITCH_X}" y="${COL_TOP}" width="${SWITCH_W}" height="${COL_HEADER_H}"
        fill="#065F46" rx="6" stroke="url(#border-grad)" stroke-width="1"/>
      <text x="${SWITCH_X + SWITCH_W / 2}" y="${COL_TOP + 30}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="24" font-weight="bold"
        fill="#A7F3D0" text-anchor="middle" filter="url(#shadow)">✅ SWITCH IF</text>
        
      <rect x="${DONT_X}" y="${COL_TOP}" width="${DONT_W}" height="${COL_HEADER_H}"
        fill="#991B1B" rx="6" stroke="url(#border-grad)" stroke-width="1"/>
      <text x="${DONT_X + DONT_W / 2}" y="${COL_TOP + 30}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="24" font-weight="bold"
        fill="#FCA5A5" text-anchor="middle" filter="url(#shadow)">❌ DON'T IF</text>
    `;

    const CAT_COLORS = ['#1E3A8A','#065F46','#9A3412','#581C87'];

    const matrixSvg = mRows.map((row: any, i: number) => {
      const ry = ROW_TOP + i * ROW_H;
      const rh = ROW_H - 6;
      const color = row.categoryColor ?? CAT_COLORS[i % CAT_COLORS.length];
      const catLines = this.wrap(row.category ?? '', 13, 3);
      const valLines = this.wrap(row.leftValue ?? '', 14, 2);
      const sw = (row.switchIf ?? []).slice(0, 2);
      const ds = (row.dontSwitchIf ?? []).slice(0, 2);
      const itemH = rh / 2;

      const swSvg = sw.map((s: string, j: number) => {
        const lines = this.wrap(s, 32, 2);
        const ty = ry + 6 + j * itemH + itemH / 2;
        return `
          <text x="${SWITCH_X + 16}" y="${ty}"
            font-family="'Inter', 'Segoe UI', sans-serif" font-size="20" font-weight="600" fill="#D1D5DB">
            ${this.tspans(lines, SWITCH_X + 16, ty, 22)}
          </text>`;
      }).join('');

      const dsSvg = ds.map((s: string, j: number) => {
        const lines = this.wrap(s, 32, 2);
        const ty = ry + 6 + j * itemH + itemH / 2;
        return `
          <text x="${DONT_X + 16}" y="${ty}"
            font-family="'Inter', 'Segoe UI', sans-serif" font-size="20" font-weight="600" fill="#D1D5DB">
            ${this.tspans(lines, DONT_X + 16, ty, 22)}
          </text>`;
      }).join('');

      const catTextY = ry + rh / 2 - (catLines.length > 1 ? (catLines.length - 1) * 22 / 2 : 0);

      return `
        <!-- Category Badge (Glassmorphic, no blocky fills) -->
        <rect x="${BADGE_X}" y="${ry}" width="${BADGE_W}" height="${rh}"
          fill="#1E293B" fill-opacity="0.6" rx="10" stroke="url(#border-grad)" stroke-width="1.5"/>
        <!-- Category Accent Indicator Left -->
        <rect x="${BADGE_X}" y="${ry}" width="6" height="${rh}" fill="${color}" rx="3"/>
        
        <text x="${BADGE_X + BADGE_W / 2 + 3}" y="${catTextY}"
          font-family="'Montserrat', 'Inter', sans-serif" font-size="20" font-weight="bold"
          fill="#FFFFFF" text-anchor="middle" filter="url(#shadow)">
          ${this.tspans(catLines, BADGE_X + BADGE_W / 2 + 3, catTextY, 22)}
        </text>
        <text x="${BADGE_X + BADGE_W / 2 + 3}" y="${ry + rh - 28}"
          font-family="'Inter', 'Segoe UI', sans-serif" font-size="18" font-weight="600" fill="#9CA3AF" text-anchor="middle">
          ${this.tspans(valLines, BADGE_X + BADGE_W / 2 + 3, ry + rh - 28, 20)}
        </text>
        
        <!-- Switch Column glass panel -->
        <rect x="${SWITCH_X}" y="${ry}" width="${SWITCH_W}" height="${rh}"
          fill="#111827" fill-opacity="0.4" rx="8" stroke="url(#border-grad)" stroke-width="1"/>
        <rect x="${SWITCH_X}" y="${ry}" width="4" height="${rh}" fill="#10B981" rx="2"/>
        ${swSvg}
        
        <!-- Don't Column glass panel -->
        <rect x="${DONT_X}" y="${ry}" width="${DONT_W}" height="${rh}"
          fill="#111827" fill-opacity="0.4" rx="8" stroke="url(#border-grad)" stroke-width="1"/>
        <rect x="${DONT_X}" y="${ry}" width="4" height="${rh}" fill="#EF4444" rx="2"/>
        ${dsSvg}
      `;
    }).join('');

    const rulesY = ROW_TOP + mRows.length * ROW_H + 10;
    const ruleW = rules.length
      ? (this.W - 80 - (rules.length - 1) * GAP) / rules.length
      : 0;

    const rulesSvg = rules.map((rule: any, i: number) => {
      const rx2 = 40 + i * (ruleW + GAP);
      const bodyLines = this.wrap(rule.body ?? '', Math.floor(ruleW / 10), 2);
      return `
        <rect x="${rx2}" y="${rulesY}" width="${ruleW}" height="${RULES_H - 10}"
          fill="#1E1B4B" fill-opacity="0.5" rx="10" stroke="url(#border-grad)" stroke-width="1"/>
        <circle cx="${rx2 + 18}" cy="${rulesY + 28}" r="14" fill="#3B82F6"/>
        <text x="${rx2 + 18}" y="${rulesY + 34}"
          font-family="'Montserrat', 'Inter', sans-serif" font-size="16" font-weight="bold"
          fill="white" text-anchor="middle" filter="url(#shadow)">${rule.number ?? i + 1}</text>
        <text x="${rx2 + 42}" y="${rulesY + 28}"
          font-family="'Montserrat', 'Inter', sans-serif" font-size="20" font-weight="bold" fill="#F3F4F6" filter="url(#shadow)">
          ${this.x(rule.title ?? '')}
        </text>
        <text x="${rx2 + 12}" y="${rulesY + 58}"
          font-family="'Inter', 'Segoe UI', sans-serif" font-size="18" fill="#D1D5DB">
          ${this.tspans(bodyLines, rx2 + 12, rulesY + 58, 22)}
        </text>
      `;
    }).join('');

    const takeawayY = rulesY + RULES_H + 4;
    const taLines = this.wrap(c.keyTakeaway ?? '', 54, 2);
    
    const hlLines = this.wrap(c.headline ?? '', 24, 2);
    const subLines = this.wrap(c.subheadline ?? '', 54, 2);
    let hlBaseY = 95;
    let subY = 150;
    if (hlLines.length > 1) {
      hlBaseY = 75;
      subY = 178;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.W}" height="${this.H}">
      <!-- Shared Definitions -->
      ${this.buildSharedDefs()}

      <!-- Base Background -->
      <rect width="${this.W}" height="${this.H}" fill="#0B0F19"/>

      <!-- Niche specific background image -->
      ${bgBase64 ? `<image href="${bgBase64}" width="${this.W}" height="${this.H}" preserveAspectRatio="xMidYMid slice" opacity="0.22"/>` : ''}

      <!-- Texture grid overlay -->
      <rect width="${this.W}" height="${this.H}" fill="url(#dot-grid)"/>

      <!-- Top stripe -->
      <rect width="${this.W}" height="10" fill="url(#orange-pink)"/>

      <!-- Title Badge -->
      <rect x="440" y="32" width="200" height="26" fill="#F59E0B" fill-opacity="0.15" rx="13" stroke="#F59E0B" stroke-opacity="0.4" stroke-width="1"/>
      <text x="540" y="49" font-family="'Montserrat', 'Inter', sans-serif" font-size="12" font-weight="900" fill="#FBBF24" letter-spacing="2" text-anchor="middle">DECISION GUIDE</text>

      <!-- Headline -->
      <text x="${this.W / 2}" y="${hlBaseY}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="54" font-weight="900"
        fill="url(#orange-pink)" text-anchor="middle" filter="url(#shadow)">
        ${this.tspans(hlLines, this.W / 2, hlBaseY, 58)}
      </text>
      <!-- Subheadline -->
      <text x="${this.W / 2}" y="${subY}"
        font-family="'Inter', 'Segoe UI', sans-serif" font-size="28" fill="#9CA3AF" text-anchor="middle">
        ${this.tspans(subLines, this.W / 2, subY, 32)}
      </text>

      ${colHeaders}
      ${matrixSvg}
      ${rulesSvg}

      <!-- Key takeaway -->
      <rect x="40" y="${takeawayY}" width="${this.W - 80}" height="${TAKEAWAY_H}"
        fill="#111827" fill-opacity="0.8" rx="10" stroke="url(#orange-pink)" stroke-width="2"/>
      <text x="${this.W / 2}" y="${takeawayY + (taLines.length > 1 ? 26 : 40)}"
        font-family="'Montserrat', 'Inter', sans-serif" font-size="24" font-weight="bold"
        fill="white" text-anchor="middle" filter="url(#shadow)">
        ${this.tspans(taLines, this.W / 2, takeawayY + (taLines.length > 1 ? 26 : 40), 26)}
      </text>

      <rect y="${this.H - 10}" width="${this.W}" height="10" fill="url(#orange-pink)"/>
    </svg>`;
  }
}
