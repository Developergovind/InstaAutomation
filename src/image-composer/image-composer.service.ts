import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { GroqContentResult } from '../groq/interfaces/groq.interfaces';

export interface InfographicContent extends GroqContentResult {
  niche?: string;
  backgroundBuffer?: Buffer;
}

@Injectable()
export class ImageComposerService {
  private readonly logger = new Logger(ImageComposerService.name);
  private readonly W = 1080;
  private readonly H = 1080;

  async composeInfographic(content: InfographicContent): Promise<Buffer> {
    this.logger.log(`Composing viral news card for niche: ${content.niche ?? 'general'}`);

    const bgBuffer = content.backgroundBuffer;
    const bgBase64 = bgBuffer
      ? `data:image/jpeg;base64,${bgBuffer.toString('base64')}`
      : '';

    const highlightColor = content.highlightColor || '#00FF66';

    const svg = this.buildViralCard(content, bgBase64, highlightColor);
    return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
  }

  async composePostSlides(content: InfographicContent): Promise<Buffer[]> {
    const buffer = await this.composeInfographic(content);
    return [buffer];
  }

  // ─── VIRAL NEWS CARD (Matches Top-Tier Instagram Media Accounts) ───
  private buildViralCard(
    c: InfographicContent,
    bgBase64: string,
    highlightColor: string,
  ): string {
    const highlightLines = c.highlightLines || [1, 3];

    // Build 2 to 3 distinct headline lines
    let l1 = c.headlineLine1?.trim();
    let l2 = c.headlineLine2?.trim();
    let l3 = c.headlineLine3?.trim();

    if (!l1 || !l2) {
      const words = (c.headline || 'BREAKING UPDATE').toUpperCase().split(' ');
      if (words.length <= 4) {
        l1 = words.slice(0, 2).join(' ');
        l2 = words.slice(2).join(' ');
      } else if (words.length <= 7) {
        l1 = words.slice(0, 3).join(' ');
        l2 = words.slice(3, 5).join(' ');
        l3 = words.slice(5).join(' ');
      } else {
        l1 = words.slice(0, 4).join(' ');
        l2 = words.slice(4, 7).join(' ');
        l3 = words.slice(7).join(' ');
      }
    }

    const lines = [
      { text: l1, isHighlight: highlightLines.includes(1) },
      { text: l2, isHighlight: highlightLines.includes(2) },
      ...(l3 ? [{ text: l3, isHighlight: highlightLines.includes(3) }] : []),
    ].filter((l) => Boolean(l.text));

    const lineCount = lines.length;
    const fontSize = lineCount >= 3 ? 62 : 68;
    const lineHeight = lineCount >= 3 ? 74 : 84;
    const startY = lineCount >= 3 ? 730 : 775;
    const dividerY = startY - 70;

    const headlineSvg = lines
      .map((line, i) => {
        const y = startY + i * lineHeight;
        const fill = line.isHighlight ? highlightColor : '#FFFFFF';
        return `
        <text x="${this.W / 2}" y="${y}"
          font-family="'Montserrat', 'Arial Black', 'Impact', sans-serif"
          font-size="${fontSize}"
          font-weight="900"
          text-anchor="middle"
          fill="${fill}"
          filter="url(#text-shadow)"
          letter-spacing="0.5">
          ${this.x(line.text)}
        </text>`;
      })
      .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.W}" height="${this.H}">
      <defs>
        <!-- Deep 3D text shadow for contrast -->
        <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.95"/>
        </filter>

        <!-- Deep smooth bottom gradient vignette -->
        <linearGradient id="bottom-vignette" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0B0F19" stop-opacity="0"/>
          <stop offset="35%" stop-color="#0B0F19" stop-opacity="0.15"/>
          <stop offset="55%" stop-color="#0B0F19" stop-opacity="0.8"/>
          <stop offset="75%" stop-color="#0B0F19" stop-opacity="0.96"/>
          <stop offset="100%" stop-color="#0B0F19" stop-opacity="1"/>
        </linearGradient>

        <!-- Divider line subtle fade gradient -->
        <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0"/>
          <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <!-- 1. Background Base -->
      <rect width="${this.W}" height="${this.H}" fill="#0B0F19"/>

      <!-- 2. High-Resolution AI Visual -->
      ${
        bgBase64
          ? `<image href="${bgBase64}" width="${this.W}" height="${this.H}" preserveAspectRatio="xMidYMid slice"/>`
          : ''
      }

      <!-- 3. Bottom Gradient Vignette -->
      <rect y="380" width="${this.W}" height="700" fill="url(#bottom-vignette)"/>

      <!-- 4. Centered Hairline Divider & Shield Badge Icon -->
      <line x1="80" y1="${dividerY}" x2="480" y2="${dividerY}" stroke="url(#line-grad)" stroke-width="1.5"/>
      <g transform="translate(${this.W / 2 - 12}, ${dividerY - 14})">
        <path d="M 12 0 L 24 6 L 24 16 C 24 24 12 30 12 30 C 12 30 0 24 0 16 L 0 6 Z" fill="${highlightColor}" opacity="0.95"/>
        <path d="M 8 15 L 11 18 L 17 11" stroke="#0B0F19" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </g>
      <line x1="600" y1="${dividerY}" x2="1000" y2="${dividerY}" stroke="url(#line-grad)" stroke-width="1.5"/>

      <!-- 5. Dynamic 2-Tone Punchy Headline -->
      ${headlineSvg}

      <!-- 6. Clean Professional Branding Footer (NO fake swipe, NO fake dots) -->
      <rect x="${this.W / 2 - 110}" y="980" width="220" height="34" rx="17" fill="#1E293B" fill-opacity="0.8" stroke="${highlightColor}" stroke-opacity="0.4" stroke-width="1"/>
      <text x="${this.W / 2}" y="1002"
        font-family="'Montserrat', 'Inter', sans-serif"
        font-size="13"
        font-weight="900"
        text-anchor="middle"
        fill="${highlightColor}"
        letter-spacing="2">
        DAILY INSIGHTS
      </text>
    </svg>`;
  }

  private x(s: any): string {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
