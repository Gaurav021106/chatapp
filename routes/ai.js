const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Message = require('../models/message');
const Group = require('../models/group');
const Conversation = require('../models/conversation');
const authenticateToken = require('../middleware/auth');
const upload = require('../middleware/chatUpload');

// Basic stopwords list for lightweight summarization
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

function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }
  const OpenAI = require('openai');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getOpenAIModel() {
  return process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
}

function getChatSystemPrompt() {
  return 'You are a helpful assistant. Keep answers concise, friendly, and correct any grammar or clarity issues when asked.';
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

// Summarize chat messages (friend or group)
router.post('/summarize/chat', authenticateToken, async (req, res) => {
  try {
    const { chatId, type } = req.body;
    if (!chatId || !type) return res.status(400).json({ success:false, message:'chatId and type required' });

    let text = '';
    if (type === 'group') {
      const group = await Group.findById(chatId).populate('members').lean();
      if (!group) return res.status(404).json({ success:false, message:'Group not found' });
      const msgs = group.messages || [];
      text = msgs.map(m => `${m.sender}: ${m.content}`).join('\n');
    } else {
      // friend/direct messages
      const userId = req.user._id;
      const msgs = await Message.find({
        $or: [
          { from: userId, to: chatId },
          { from: chatId, to: userId }
        ]
      }).sort({ createdAt: 1 }).lean();
      text = msgs.map(m => `${m.from}: ${m.content}`).join('\n');
    }

    const summary = simpleSummarizeText(text);
    res.json({ success:true, summary });
  } catch (error) {
    console.error('Error summarizing chat:', error);
    res.status(500).json({ success:false, message:'Error summarizing chat' });
  }
});

// Summarize uploaded document (supports .txt and .pdf)
router.post('/summarize/document', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';
    if (ext === '.txt' || ext === '.md') {
      text = fs.readFileSync(req.file.path, 'utf8');
    } else if (ext === '.pdf') {
      // lazy-load pdf-parse to avoid breaking if dependency not installed
      let pdfParse;
      try { pdfParse = require('pdf-parse'); } catch (e) {
        return res.status(500).json({ success:false, message:'pdf-parse not installed on server' });
      }
      const data = await pdfParse(fs.readFileSync(req.file.path));
      text = data.text || '';
    } else {
      return res.status(400).json({ success:false, message:'Unsupported file for summarization. Use .txt or .pdf' });
    }

    const summary = simpleSummarizeText(text);
    res.json({ success:true, summary });
  } catch (error) {
    console.error('Error summarizing document:', error);
    res.status(500).json({ success:false, message:'Error summarizing document' });
  }
});

router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, message: 'OPENAI_API_KEY not set on server' });
    }

    const openai = createOpenAIClient();

    let conv = await Conversation.findOne({ user: req.user._id });
    if (!conv) {
      conv = new Conversation({ user: req.user._id, messages: [] });
    }

    const CONTEXT_MSGS = 12;
    const recent = conv.messages.slice(-CONTEXT_MSGS).map(m => ({ role: m.role, content: m.content }));
    const messages = [{ role: 'system', content: getChatSystemPrompt() }, ...recent, { role: 'user', content: message }];

    const resp = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages,
      max_tokens: 800,
      temperature: 0.7,
    });

    const reply = resp?.choices?.[0]?.message?.content || '';

    // Persist user message + assistant reply
    try {
      await conv.append('user', message);
      await conv.append('assistant', reply);
    } catch (e) {
      console.warn('Could not persist conversation:', e.message || e);
    }

    return res.json({ success: true, reply });
  } catch (err) {
    console.error('Error calling OpenAI:', err);
    return res.status(500).json({ success: false, message: 'Error contacting OpenAI' });
  }
});

// Streaming-like endpoint: returns chunked JSON lines
router.post('/chat/stream', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, message: 'OPENAI_API_KEY not set on server' });
    }

    const openai = createOpenAIClient();

    let conv = await Conversation.findOne({ user: req.user._id });
    if (!conv) conv = new Conversation({ user: req.user._id, messages: [] });
    const CONTEXT_MSGS = 12;
    const recent = conv.messages.slice(-CONTEXT_MSGS).map(m => ({ role: m.role, content: m.content }));
    const messages = [{ role: 'system', content: getChatSystemPrompt() }, ...recent, { role: 'user', content: message }];

    const apiResp = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages,
      max_tokens: 800,
      temperature: 0.7,
    });
    const reply = apiResp?.choices?.[0]?.message?.content || '';

    // Persist
    try {
      await conv.append('user', message);
      await conv.append('assistant', reply);
    } catch (e) {
      console.warn('Could not persist conversation:', e.message || e);
    }

    // Stream back as NDJSON (one JSON object per line)
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders && res.flushHeaders();

    // Chunk the reply into small pieces
    const CHUNK_SIZE = 120;
    for (let i = 0; i < reply.length; i += CHUNK_SIZE) {
      const chunk = reply.slice(i, i + CHUNK_SIZE);
      res.write(JSON.stringify({ chunk }) + '\n');
      // allow event loop to breathe
      await new Promise(r => setTimeout(r, 20));
    }

    // indicate completion
    res.write(JSON.stringify({ done: true }) + '\n');
    return res.end();
  } catch (err) {
    console.error('Error in stream endpoint:', err);
    return res.status(500).json({ success: false, message: 'Error contacting OpenAI' });
  }
});

// ChatGPT-based summarization of a chat (friend or group)
router.post('/summarize/chat-ai', authenticateToken, async (req, res) => {
  try {
    const { chatId, type } = req.body;
    if (!chatId || !type) return res.status(400).json({ success:false, message:'chatId and type required' });

    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ success:false, message:'OPENAI_API_KEY not set' });

    let text = '';
    if (type === 'group') {
      const group = await Group.findById(chatId).lean();
      if (!group) return res.status(404).json({ success:false, message:'Group not found' });
      const msgs = group.messages || [];
      text = msgs.map(m => `${m.sender}: ${m.content}`).join('\n');
    } else {
      // direct messages
      const userId = req.user._id;
      const msgs = await Message.find({
        $or: [
          { from: userId, to: chatId },
          { from: chatId, to: userId }
        ]
      }).sort({ createdAt: 1 }).lean();
      text = msgs.map(m => `${m.from}: ${m.content}`).join('\n');
    }

    if (!text) return res.json({ success:true, summary: 'No messages to summarize.' });

    // limit length to avoid hitting token limits
    const MAX_CHARS = 16000;
    if (text.length > MAX_CHARS) text = text.slice(-MAX_CHARS);

    const openai = createOpenAIClient();

    const system = 'You are an assistant that summarizes chat conversations. Produce: 1) A short TL;DR (1-2 sentences). 2) Key points (bullet list). 3) Action items or follow-ups (bullet list). Keep it concise.';

    const resp = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Summarize the following conversation for me:\n\n${text}` }
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const summary = resp?.choices?.[0]?.message?.content || '';
    return res.json({ success:true, summary });
  } catch (err) {
    console.error('Error summarizing chat via OpenAI:', err);
    return res.status(500).json({ success:false, message:'Error contacting OpenAI' });
  }
});

router.post('/correct', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Text is required' });

    const openai = createOpenAIClient();
    const prompt = `Edit and correct the following message for clarity, grammar, and tone while preserving the original meaning. Return only the corrected message without additional commentary:\n\n${text}`;

    const resp = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: 'You are a helpful message editor that improves grammar, spelling, clarity, and tone.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 250,
      temperature: 0.2,
    });

    const corrected = resp?.choices?.[0]?.message?.content?.trim() || '';
    return res.json({ success: true, corrected });
  } catch (err) {
    console.error('Error correcting text via OpenAI:', err);
    return res.status(500).json({ success:false, message:'Error contacting OpenAI' });
  }
});

module.exports = router;
