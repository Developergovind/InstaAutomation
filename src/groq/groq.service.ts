import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { DynamicConfigService } from '../settings/settings.service';
import {
  GroqContentResult,
  TrendContentInput,
  LayoutType,
} from './interfaces/groq.interfaces';

export { GroqContentResult, LayoutType };

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);

  constructor(private readonly dynamicConfig: DynamicConfigService) {}

  async generateContent(
    trend: TrendContentInput,
  ): Promise<GroqContentResult> {
    const apiKey = await this.dynamicConfig.get('groq_api_key', 'GROQ_API_KEY');
    const model = await this.dynamicConfig.get(
      'groq_model',
      'GROQ_MODEL',
      'openai/gpt-oss-120b',
    );

    if (!apiKey) {
      throw new Error('Groq API key is not configured — set it in Settings');
    }

    const groq = new Groq({ apiKey });
    const newsContext = trend.relatedNews.slice(0, 3).map(n => n.title).join(' | ');

    // Step 1: Pick the best layout for this trend
    const layoutPick = await this.pickLayout(trend.keyword, newsContext, groq, model);

    // Step 2: Generate structured content for that layout
    const content = await this.generateStructuredContent(trend.keyword, newsContext, layoutPick, groq, model);

    // Normalize caption & hashtags for safety
    const caption = content.caption || '';
    let hashtagsVal = content.hashtags || [];
    if (typeof hashtagsVal === 'string') {
      hashtagsVal = hashtagsVal
        .split(',')
        .map((h: string) => h.trim().replace(/^#/, ''))
        .filter(Boolean);
    }
    const hashtags = Array.isArray(hashtagsVal)
      ? hashtagsVal.map((h: any) => String(h).trim().replace(/^#/, '')).filter(Boolean)
      : [];

    return {
      ...content,
      layout: layoutPick,
      caption,
      hashtags,
    };
  }

  private async pickLayout(keyword: string, newsContext: string, groq: Groq, model: string): Promise<LayoutType> {
    const completion = await groq.chat.completions.create({
      model,
      messages: [{
        role: 'user',
        content: `Trending topic: "${keyword}". News context: ${newsContext}.
        
Which layout fits BEST for an Instagram infographic about this topic?

NUMBERED_TABLE — Best for: rankings, salary scales, categories, tier lists, comparisons with values
  Example: "Salary categories in India", "Top 10 cities by cost of living"

CARD_SECTIONS — Best for: breakdowns, how-things-work, financial details, profiles, budgets
  Example: "Amit Shah net worth breakdown", "How to build an emergency fund"

STORY_CHECKLIST — Best for: tips, steps, strategies, life hacks, how-to guides, smart tricks
  Example: "How rich people pay EMI", "5 habits of successful people"

GUIDE_MATRIX — Best for: decision guides, comparison matrices, when-to-do-X, experience-based guides
  Example: "When to switch jobs", "Which investment is right for your age"

Return ONLY one of these four words, nothing else: NUMBERED_TABLE, CARD_SECTIONS, STORY_CHECKLIST, or GUIDE_MATRIX`
      }],
      temperature: 0.3,
      max_tokens: 20,
    });

    const raw = completion.choices[0]?.message?.content?.trim().toUpperCase() || '';
    if (['NUMBERED_TABLE','CARD_SECTIONS','STORY_CHECKLIST','GUIDE_MATRIX'].includes(raw)) {
      return raw as LayoutType;
    }
    return 'STORY_CHECKLIST'; // safe default
  }

  private async generateStructuredContent(
    keyword: string,
    newsContext: string,
    layout: LayoutType,
    groq: Groq,
    model: string,
  ): Promise<any> {
    const schemas: Record<LayoutType, string> = {
      NUMBERED_TABLE: `{
  "headline": "Bold question or statement, max 8 words, use Hindi if topic is India-specific",
  "subheadline": "Short subtitle, max 6 words",
  "tableHeaders": ["Column 1 name", "Column 2 name", "Column 3 name"],
  "rows": [
    { "number": 1, "col1": "value", "col2": "value", "col3": "value", "color": "#hex" }
  ],
  "footerNote": "One line disclaimer or source note, max 12 words",
  "caption": "Instagram caption, 60-80 words, hook + key insight + call to action. Use emojis naturally.",
  "hashtags": ["15 hashtags without #"]
}`,

      CARD_SECTIONS: `{
  "headline": "Person name or topic in LARGE BOLD, max 4 words",
  "subheadline": "Context line, max 8 words. Example: 'Net Worth: ₹65 Crores'",
  "sections": [
    {
      "title": "Section 1 Name",
      "emoji": "one relevant emoji",
      "color": "#hex accent color",
      "items": [
        { "label": "Metric 1 Name", "value": "₹X cr or X%" },
        { "label": "Metric 2 Name", "value": "₹Y cr or Y%" },
        { "label": "Metric 3 Name", "value": "₹Z cr or Z%" }
      ]
    },
    {
      "title": "Section 2 Name",
      "emoji": "one relevant emoji",
      "color": "#hex accent color",
      "items": [
        { "label": "Metric 1 Name", "value": "₹X cr or X%" },
        { "label": "Metric 2 Name", "value": "₹Y cr or Y%" },
        { "label": "Metric 3 Name", "value": "₹Z cr or Z%" }
      ]
    },
    {
      "title": "Section 3 Name",
      "emoji": "one relevant emoji",
      "color": "#hex accent color",
      "items": [
        { "label": "Metric 1 Name", "value": "₹X cr or X%" },
        { "label": "Metric 2 Name", "value": "₹Y cr or Y%" },
        { "label": "Metric 3 Name", "value": "₹Z cr or Z%" }
      ]
    },
    {
      "title": "Section 4 Name",
      "emoji": "one relevant emoji",
      "color": "#hex accent color",
      "items": [
        { "label": "Metric 1 Name", "value": "₹X cr or X%" },
        { "label": "Metric 2 Name", "value": "₹Y cr or Y%" },
        { "label": "Metric 3 Name", "value": "₹Z cr or Z%" }
      ]
    }
  ],
  "totalLine": "Total or summary line. Example: 'Total Net Worth: ₹65 Crores'",
  "sourceNote": "Source: name, max 8 words",
  "caption": "Instagram caption, 60-80 words, hook + data insights + call to action.",
  "hashtags": ["15 hashtags without #"]
}`,

      STORY_CHECKLIST: `{
  "headline": "Bold punchy headline, max 6 words, use Hindi if relevant. Example: 'अमीर लोग EMI ऐसे भरते हैं'",
  "steps": [
    { "icon": "✅", "text": "One clear action or fact, max 12 words", "highlight": false }
  ],
  "lessonTitle": "🧠 सीख — or 💡 Key Takeaway —",
  "lessonPoints": [
    "Core lesson, max 10 words"
  ],
  "ctaText": "Follow CTA, max 8 words. Example: '👉 Follow करें अमीर बनने के लिए'",
  "caption": "Instagram caption, 60-80 words.",
  "hashtags": ["15 hashtags without #"]
}`,

      GUIDE_MATRIX: `{
  "headline": "Decision question, max 6 words. Example: 'When Should You SWITCH JOBS?'",
  "subheadline": "Subtitle, max 6 words. Example: 'A Salary Guide for Professionals'",
  "matrixRows": [
    {
      "category": "Category label",
      "categoryColor": "#hex",
      "leftLabel": "Current Salary / Situation",
      "leftValue": "₹X-Y LPA or specific value",
      "switchIf": ["Reason 1, max 8 words"],
      "dontSwitchIf": ["Reason 1, max 8 words"]
    }
  ],
  "rules": [
    { "number": 1, "title": "Rule title", "body": "max 10 words" }
  ],
  "keyTakeaway": "Bold bottom line, max 12 words",
  "caption": "Instagram caption, 60-80 words.",
  "hashtags": ["15 hashtags without #"]
}`
    };

    const completion = await groq.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert Instagram content creator. You create highly viral, detailed, and engaging infographic content for an Indian audience.
          
RULES FOR ALL GENERATED CONTENT:
1. ZERO generic filler. Every layout must be fully packed with content so it looks dense, professional, and premium.
2. Layout Specific Counts and Rules:
   - For CARD_SECTIONS: Generate EXACTLY 3 to 4 sections (cards) in the "sections" array. Each section MUST contain exactly 2 to 3 items in the "items" array. The "value" field MUST be a specific short number/percentage/amount (e.g., "60%", "₹12 Cr", "High"). The "label" field MUST be the name of the metric (e.g., "New Hotspots", "Affected Countries"). NEVER swap them or put description sentences in "value".
   - For GUIDE_MATRIX: Generate EXACTLY 3 to 4 rows in the "matrixRows" array. Each row MUST have a unique, distinct, and creative category name (e.g., "Coaching Style", "CSK Connection", "Availability" — NEVER repeat category names). "switchIf" and "dontSwitchIf" arrays must contain exactly 2 distinct reasons each (each reason max 8 words). The "rules" array MUST contain EXACTLY 3 rules (numbers 1, 2, and 3).
   - For NUMBERED_TABLE: Generate EXACTLY 5 to 7 rows. Column 2 (Category) must be a clear description (5-8 words). Column 3 (Value) must be a specific metric or amount.
   - For STORY_CHECKLIST: Generate EXACTLY 5 steps. Each step must be a highly specific, concrete tip (10-15 words). "lessonPoints" MUST contain exactly 2 distinct takeaways.
3. Language: Use catchy Hinglish/Hindi for headlines when the topic is India-specific, lifestyle, or finance (e.g., "Magnum Croissant Trial Karein?", "अमीर लोग EMI ऐसे भरते हैं"). Keep body text/items in English for wide accessibility.
4. Always return valid, well-formed JSON matching the requested layout schema exactly.`
        },
        {
          role: 'user',
          content: `Trending topic: "${keyword}"
News context: ${newsContext}
Layout: ${layout}

Generate structured infographic content using this EXACT JSON schema:
${schemas[layout]}

RULES:
- All data must be REAL and SPECIFIC to "${keyword}" — no made-up numbers
- Use actual statistics from the news context provided
- If Hindi is used in headline, keep body text in English for wider reach
- Make it genuinely useful — something people will SAVE
- Return ONLY the JSON object, no markdown`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 1500,
    });

    let parsed: any;
    const rawContent = completion.choices[0]?.message?.content?.trim() || '';
    const cleanedContent = rawContent
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    try {
      parsed = JSON.parse(cleanedContent);
    } catch {
      const retry = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'user', content: `Return ONLY valid JSON for layout ${layout} about topic "${keyword}". Schema: ${schemas[layout]}. ONLY JSON, nothing else.` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1500,
      });
      const retryRaw = retry.choices[0]?.message?.content?.trim() || '';
      const retryCleaned = retryRaw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      parsed = JSON.parse(retryCleaned);
    }

    return parsed;
  }
}
