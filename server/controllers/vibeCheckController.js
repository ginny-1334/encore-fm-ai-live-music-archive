// server/controllers/vibeCheckController.js
//
// Vibe Check — synthesizes all reviews of a setlist into a single AI-generated
// paragraph + 4 keyword tags. Used by setlist.html (sidebar widget) and the
// home page recent-reviews cards.
//
// Pipeline:
//   1. Fetch all reviews for the setlist.
//   2. Send their text to Claude with a structured prompt that asks for JSON.
//   3. Parse the response, cache it on the Setlist document.
//   4. Return { vibeText, tags } to the front-end.
//
// Why we cache on Setlist.vibeCheck:
//   - LLM calls cost money and take ~1-3 seconds. Caching means each show's
//     vibe check is computed once and re-served instantly.
//   - The "Regenerate" button does an explicit POST that bypasses the cache.

const Anthropic = require('@anthropic-ai/sdk');
const Setlist = require('../models/Setlist');
const Review = require('../models/Review');

// Lazy-init: only construct the client if/when we actually need it.
// Means the server can start even if the API key isn't set yet (we'll just
// fail at request time rather than boot time).
let _client = null;
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in .env');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// Calls Claude with the reviews and returns { vibeText, tags }.
async function callClaude(artistName, venue, reviews) {
  const prompt = `You are summarizing concert reviews into a "Vibe Check" for a music archive site.

Artist: ${artistName}
Venue: ${venue}
Number of reviews: ${reviews.length}

Reviews:
${reviews.map((r, i) => `[Review ${i + 1}, ${r.rating || '?'} stars] ${r.text}`).join('\n\n')}

Synthesize these reviews into:
1. A single vivid paragraph (2-4 sentences) capturing the overall vibe — crowd energy, sound quality, standout moments. Write in present tense, evocative but not overwrought.
2. Four short keyword tags (1-2 words each) that capture the dominant feelings. Examples: "Transcendent", "Wall of Sound", "Mosh Pit", "Emotional", "Cathartic", "Intimate".

Respond with ONLY valid JSON in this exact shape, no other text:
{
  "vibeText": "your paragraph here",
  "tags": ["Tag One", "Tag Two", "Tag Three", "Tag Four"]
}`;

  const message = await client().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0]?.text || '';
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`);
  }

  if (!parsed.vibeText || !Array.isArray(parsed.tags)) {
    throw new Error('Claude response missing required fields');
  }

  return {
    vibeText: String(parsed.vibeText).trim(),
    tags: parsed.tags.slice(0, 4).map(t => String(t).trim()),
  };
}

function shapeResponse(setlist) {
  return {
    setlistId: setlist._id,
    vibeText: setlist.vibeCheck?.vibeText || '',
    tags: setlist.vibeCheck?.tags || [],
    reviewCount: setlist.vibeCheck?.reviewCount || 0,
    generatedAt: setlist.vibeCheck?.generatedAt || null,
  };
}

// GET /api/reviews/vibecheck?setlistId=X
async function getVibeCheck(req, res, next) {
  try {
    const { setlistId } = req.query;
    if (!setlistId) {
      return res.status(400).json({ error: 'setlistId query param is required' });
    }

    const setlist = await Setlist.findById(setlistId);
    if (!setlist) return res.status(404).json({ error: 'Setlist not found' });

    if (setlist.vibeCheck && setlist.vibeCheck.vibeText) {
      return res.json(shapeResponse(setlist));
    }

    const reviews = await Review.find({ setlist: setlist._id }).lean();
    if (reviews.length === 0) {
      return res.json({
        setlistId: setlist._id,
        vibeText: 'No reviews yet for this show. Be the first to share what the night was like.',
        tags: [],
        reviewCount: 0,
        generatedAt: null,
      });
    }

    const result = await callClaude(setlist.artistName, setlist.venue, reviews);
    setlist.vibeCheck = {
      vibeText: result.vibeText,
      tags: result.tags,
      reviewCount: reviews.length,
      generatedAt: new Date(),
    };
    await setlist.save();

    res.json(shapeResponse(setlist));
  } catch (err) {
    next(err);
  }
}

// POST /api/reviews/vibecheck/generate?setlistId=X
async function regenerateVibeCheck(req, res, next) {
  try {
    const setlistId = req.query.setlistId || req.body.setlistId;
    if (!setlistId) {
      return res.status(400).json({ error: 'setlistId is required' });
    }

    const setlist = await Setlist.findById(setlistId);
    if (!setlist) return res.status(404).json({ error: 'Setlist not found' });

    const reviews = await Review.find({ setlist: setlist._id }).lean();
    if (reviews.length === 0) {
      return res.status(400).json({ error: 'Cannot generate vibe check — no reviews yet' });
    }

    const result = await callClaude(setlist.artistName, setlist.venue, reviews);
    setlist.vibeCheck = {
      vibeText: result.vibeText,
      tags: result.tags,
      reviewCount: reviews.length,
      generatedAt: new Date(),
    };
    await setlist.save();

    res.json(shapeResponse(setlist));
  } catch (err) {
    next(err);
  }
}

module.exports = { getVibeCheck, regenerateVibeCheck };