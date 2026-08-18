const axios = require('D:/instaAutomation/instagram-automation/node_modules/axios');
const { XMLParser } = require('D:/instaAutomation/instagram-automation/node_modules/fast-xml-parser');

const url = 'https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en-IN&gl=IN&ceid=IN:en';

const RSS_HEADERS = {
  Accept: 'application/rss+xml, application/xml, text/xml, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function main() {
  try {
    console.log('Fetching Google News HEALTH RSS...');
    const response = await axios.get(url, { headers: RSS_HEADERS });
    const xmlData = response.data;
    console.log('Fetched successfully. XML length:', xmlData.length);

    console.log('\n--- TEST 1: Default XMLParser ---');
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });
      const result = parser.parse(xmlData);
      console.log('Success! Items found:', result.rss.channel.item.length);
    } catch (err) {
      console.error('Failed with error:', err.message);
    }

    console.log('\n--- TEST 2: XMLParser with processEntities: false ---');
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        processEntities: false,
      });
      const result = parser.parse(xmlData);
      console.log('Success! Items found:', result.rss.channel.item.length);
    } catch (err) {
      console.error('Failed with error:', err.message);
    }
  } catch (error) {
    console.error('Fetch failed:', error.message);
  }
}

main();
