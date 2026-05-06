// server/routes/reviews.js
//
// Endpoints related to user-submitted reviews.
//
// Routes:
//   GET  /api/reviews/recent              Recent reviews aggregated for home-page cards
//   GET  /api/reviews/vibecheck            Cached AI vibe check for a setlist
//   POST /api/reviews/vibecheck/generate   Force-regenerate the vibe check (LLM call)
//   GET  /api/reviews?setlistId=<id>       All reviews for one setlist
//   POST /api/reviews                       Submit a new review

const express = require('express');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Setlist = require('../models/Setlist');
const Artist = require('../models/Artist');
const { getVibeCheck, regenerateVibeCheck } = require('../controllers/vibeCheckController');

const router = express.Router();

// IMPORTANT: specific paths registered before /:id catch-alls.

// GET /api/reviews/recent
router.get('/recent', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 3, 20);

    const recent = await Review.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$setlist',
          reviewCount: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          latestText: { $first: '$text' },
          latestCreatedAt: { $first: '$createdAt' },
        },
      },
      { $sort: { latestCreatedAt: -1 } },
      { $limit: limit },
    ]);

    const setlistIds = recent.map(r => r._id);
    const setlists = await Setlist.find({ _id: { $in: setlistIds } }).lean();
    const byId = new Map(setlists.map(s => [String(s._id), s]));

    const cards = recent.map(r => {
      const s = byId.get(String(r._id));
      if (!s) return null;
      return {
        setlistId: s._id,
        artistName: s.artistName,
        artistSlug: s.artistSlug,
        venueName: s.venue,
        city: s.city,
        reviewCount: r.reviewCount,
        rating: Math.round(r.avgRating * 10) / 10,
        vibeText: (s.vibeCheck && s.vibeCheck.vibeText) || r.latestText,
        tags: (s.vibeCheck && s.vibeCheck.tags) || [],
      };
    }).filter(Boolean);

    res.json(cards);
  } catch (err) {
    next(err);
  }
});

// Vibe Check endpoints (delegated to controller).
router.get('/vibecheck', getVibeCheck);
router.post('/vibecheck/generate', regenerateVibeCheck);

// GET /api/reviews?setlistId=<id>
router.get('/', async (req, res, next) => {
  try {
    const { setlistId } = req.query;
    const filter = {};
    if (setlistId) {
      if (!mongoose.isValidObjectId(setlistId)) {
        return res.status(400).json({ error: 'Invalid setlistId' });
      }
      filter.setlist = setlistId;
    }
    const reviews = await Review.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews
router.post('/', async (req, res, next) => {
  try {
    const { setlistId, username, rating, text } = req.body;

    if (!setlistId || !text) {
      return res.status(400).json({ error: 'setlistId and text are required' });
    }
    if (!mongoose.isValidObjectId(setlistId)) {
      return res.status(400).json({ error: 'Invalid setlistId' });
    }

    const setlist = await Setlist.findById(setlistId);
    if (!setlist) return res.status(404).json({ error: 'Setlist not found' });

    const review = await Review.create({
      setlist: setlist._id,
      artistName: setlist.artistName,
      username: username || 'anonymous',
      rating,
      text: text.trim(),
    });

    // Invalidate cached vibe check so the next view triggers regeneration.
    setlist.vibeCheck = { vibeText: '', tags: [], reviewCount: 0, generatedAt: null };
    await setlist.save();

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

