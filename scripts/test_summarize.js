const fs = require('fs');

const STOPWORDS = new Set((
  'a,able,about,across,after,again,all,almost,also,am,among,an,and,any,are,as,at,be,because,been,but,by,can,'+
  'cannot,could,dear,did,do,does,either,else,ever,every,for,from,get,got,had,has,have,he,her,hers,him,his,how,'+
  'however,i,if,in,into,is,it,its,just,least,let,like,likely,may,me,might,most,must,my,neither,no,nor,not,of,'+
  'off,often,on,only,or,other,our,own,rather,said,say,says,she,should,since,so,some,than,that,the,their,them,'+
  'then,there,these,they,this,tis,to,too,twas,us,wants,was,we,were,what,when,where,which,while,who,whom,why,will,'+
  'with,would,yet,you,your'
).split(','));

function topKeywords(text, limit = 8) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const freq = {};
  for (const w of words) {
    if (w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0, limit).map(x=>x[0]);
}

function simpleSummarizeText(text) {
  if (!text || !text.trim()) return 'No content to summarize.';
  const sentences = text.match(/[^\.\!\?]+[\.\!\?]+|[^\.\!\?]+$/g) || [];
  const first = sentences.slice(0,3).join(' ').trim();
  const last = sentences.slice(-2).join(' ').trim();
  const keywords = topKeywords(text, 6);
  const totalWords = text.split(/\s+/).filter(Boolean).length;
  return `Approx. ${totalWords} words. Key topics: ${keywords.join(', ') || 'none'}.
\nIntro: ${first || 'N/A'}\n\nConclusion: ${last || 'N/A'}`;
}

(async ()=>{
  try {
    const p = process.argv[2] || 'test_doc.txt';
    const text = fs.readFileSync(p, 'utf8');
    console.log('File:', p);
    console.log('--- Summary ---');
    console.log(simpleSummarizeText(text));
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
