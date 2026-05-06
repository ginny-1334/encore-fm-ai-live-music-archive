// server/routes/artists.js
//
// Endpoints related to artists.
//
// Routes:
//   GET  /api/artists              List/search artists
//   GET  /api/artists/:slugOrId    Single artist (by slug or ObjectId)
//   POST /api/artists              Create new artist (used by setlist POST internally)

const express = require('express');
const mongoose = require('mongoose');
const Artist = require('../models/Artist');

const router = express.Router();

// Escapes regex special chars so user input can't break our queries.
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/artists
//   ?sort=trending  -> highest showCount first (used by index.html trending cards)
//   ?sort=alpha     -> alphabetical (default)
//   ?q=<text>       -> case-insensitive name prefix search
//   ?limit=N        -> cap results (default 50, hard max 100)
router.get('/', async (req, res, next) => {
  try {
    const { q, sort } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const filter = q ? { name: { $regex: `${escapeRegex(q)}`, $options: 'i' } } : {};

    let cursor = Artist.find(filter);
    if (sort === 'trending') {
      cursor = cursor.sort({ showCount: -1, name: 1 });
    } else {
      cursor = cursor.sort({ name: 1 });
    }

    const artists = await cursor.limit(limit).lean();
    res.json(artists);
  } catch (err) {
    next(err);
  }
});

// GET /api/artists/:slugOrId
// Accepts either a slug ("my-bloody-valentine") or a Mongo ObjectId.
// Front-end uses ?name=<slug> in URLs, so slug is the primary path.
router.get('/:slugOrId', async (req, res, next) => {
  try {
    const { slugOrId } = req.params;
    let artist = null;

    if (mongoose.isValidObjectId(slugOrId)) {
      artist = await Artist.findById(slugOrId).lean();
    }
    if (!artist) {
      artist = await Artist.findOne({ slug: String(slugOrId).toLowerCase() }).lean();
    }
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    res.json(artist);
  } catch (err) {
    next(err);
  }
});

// POST /api/artists -> create.
// Used internally by the setlist POST when a user submits a show for an
// artist that doesn't exist yet. Open to direct calls too for admin / seeding.
router.post('/', async (req, res, next) => {
  try {
    const { name, genre, bio, imageUrl } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const artist = await Artist.create({ name, genre, bio, imageUrl });
    res.status(201).json(artist);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Artist with this name already exists' });
    }
    next(err);
  }
});

module.exports = router;

