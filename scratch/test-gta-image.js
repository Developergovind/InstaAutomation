const fs = require('fs');
const OpenAI = require('D:/instaAutomation/instagram-automation/node_modules/openai').OpenAI;

const envPath = 'D:/instaAutomation/instagram-automation/.env';
const envContent = fs.readFileSync(envPath, 'utf8');

let apiKey = '';
let model = 'flux-2-max';

envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    const val = valueParts.join('=').trim();
    if (key.trim() === 'CLUSTER_API_KEY') apiKey = val;
  }
});

console.log('Cluster API Key:', apiKey ? apiKey.substring(0, 10) + '...' : 'undefined');

const client = new OpenAI({
  baseURL: 'https://api.clusterprotocol.ai/v1',
  apiKey,
});

const headline = "2026 Gaming Trends: GTA, RE9, AI & EA";
const keyPoints = [
  "GTA 6 trailer racked up 30 million views in 24 hours - a Rockstar record.",
  "Official launch slated for Q4 2025, fueling 2026 hype.",
  "Resident Evil 9 leak hints at a new bioweapon plot set in 2028.",
  "EA CEO predicts AI will shave up to 30 % off game development cycles.",
  "AIdriven titles projected to generate $2.3 billion in revenue by 202"
];
const keyword = "GTA 6, Resident Evil 9, AI and EA: Gaming trends to watch in 2026 - BBC";

const pointsText = keyPoints
  .map((p, i) => `${i + 1}. ${p}`)
  .join('  |  ');

const imagePrompt = `Create a clean, modern, professional Instagram infographic poster. \
Background: deep navy blue (#0d1b2a). \
TOP SECTION: Large bold white sans-serif headline text reading exactly: "${headline}". \
MIDDLE SECTION: 5 numbered key facts in white text on slightly lighter cards, reading: ${pointsText}. \
Each fact on its own row with a small cyan (•) bullet. \
BOTTOM SECTION: Topic tag reading "#${keyword.replace(/\s+/g, '')}" in gradient cyan-to-purple text. \
Thin horizontal accent line (cyan to orange gradient) separating sections. \
Style: premium Canva infographic, Apple-level typography, high contrast, \
NO people, NO faces, NO landscapes, NO abstract art. \
The design is text-first — the text IS the content. \
Square 1:1 format, ultra sharp, 1080x1080px quality.`;

function sanitizePrompt(prompt) {
  const trademarkMap = {
    'gta\\s*6': 'popular open world game',
    'gta': 'popular open world game',
    'grand\\s*theft\\s*auto': 'popular open world game',
    'resident\\s*evil\\s*9': 'popular horror game 9',
    'resident\\s*evil': 'popular horror game',
    're9': 'horror game 9',
    'playstation': 'gaming console',
    'xbox': 'gaming console',
    'nintendo': 'gaming brand',
    'ea': 'gaming publisher',
    'intel': 'processor brand',
    'nvidia': 'gpu brand',
    'amd': 'gpu brand',
    'apple': 'tech brand',
    'google': 'search giant',
    'microsoft': 'software giant',
    'rockstar': 'game developer',
  };

  let sanitized = prompt;
  for (const [trademark, replacement] of Object.entries(trademarkMap)) {
    const regex = new RegExp(`\\b${trademark}\\b`, 'gi');
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

async function test(label, promptStr) {
  try {
    console.log(`--- ${label} ---`);
    const sanitized = sanitizePrompt(promptStr);
    console.log('Sanitized Prompt:', sanitized);
    const response = await client.images.generate({
      model,
      prompt: sanitized,
      n: 1,
      size: '1024x1024',
    });
    console.log('Success! Result b64 length:', response.data[0].b64_json ? response.data[0].b64_json.length : 'no b64');
  } catch (err) {
    console.error('Failed with error:', err.message);
  }
}

async function main() {
  await test('TEST I: Sanitized Full Infographic Prompt', imagePrompt);
}

main();
