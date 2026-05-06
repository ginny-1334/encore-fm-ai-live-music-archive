// server/routes/setlists.js
//
// Endpoints related to setlists (past concerts with songs).
//
// Routes:
//   GET  /api/setlists?artistId=<idOrSlug>   List setlists, optionally for one artist
//   GET  /api/setlists/predict?artistId=...  Song Predictor (must come before /:id)
//   GET  /api/setlists/:id                   Single setlist
//   POST /api/setlists                        Submit a new setlist (used by add.html)

const express = require('express');
const mongoose = require('mongoose');
const Setlist = require('../models/Setlist');
const Artist = require('../models/Artist');
const Review = require('../models/Review');
const { predict } = require('../controllers/predictController');

const router = express.Router();

// IMPORTANT: /predict must be registered BEFORE /:id, otherwise Express
// will treat "predict" as an ObjectId and the predictor never runs.
router.get('/predict', predict);

// GET /api/setlists?artistId=<idOrSlug>&limit=20
router.get('/', async (req, res, next) => {
  try {
    const { artistId } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const filter = {};
    if (artistId) {
      if (mongoose.isValidObjectId(artistId)) {
        filter.artist = artistId;
      } else {
        filter.artistSlug = String(artistId).toLowerCase();
      }
    }

    const setlists = await Setlist.find(filter)
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    res.json(setlists);
  } catch (err) {
    next(err);
  }
});

// GET /api/setlists/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid setlist id' });
    }
    const setlist = await Setlist.findById(req.params.id).lean();
    if (!setlist) return res.status(404).json({ error: 'Setlist not found' });
    res.json(setlist);
  } catch (err) {
    next(err);
  }
});

// POST /api/setlists
//
// Body shape from add.html:
//   {
//     artist: "My Bloody Valentine",        // NAME, not id — we find-or-create
//     venue:  "Royal Albert Hall",
//     city:   "London, UK",
//     date:   "2025-04-15",
//     songs:  [{ name: "Only Shallow", order: 1 }, ...],
//     review: "Was amazing..."              // optional
//   }
//
// What this does:
//   1. Find-or-create the artist by name (auto-slugifies).
//   2. Create the setlist, normalizing songs into our embedded schema.
//   3. If review text was provided, create a Review document linked to the setlist.
//   4. Update the artist's denormalized counters.
//   5. Return the new setlist (front-end can redirect to /setlist.html?id=<id>).
router.post('/', async (req, res, next) => {
  try {
    const { artist: artistName, venue, city, date, songs, review } = req.body;

    // Validate required fields up front.
    if (!artistName || !venue || !city || !date) {
      return res.status(400).json({
        error: 'artist, venue, city, and date are all required',
      });
    }
    if (!Array.isArray(songs) || songs.length === 0) {
      return res.status(400).json({ error: 'songs must be a non-empty array' });
    }

    // Find-or-create the artist (case-insensitive match on name).
    const slug = Artist.slugify(artistName);
    let artist = await Artist.findOne({ slug });
    if (!artist) {
      artist = await Artist.create({ name: artistName.trim() });
    }

    // Normalize songs into our embedded schema. Trust the order the user
    // dragged things into; renumber sequentially as a defense against gaps.
    const normalizedSongs = songs
      .map((s, i) => ({
        number: typeof s.order === 'number' ? s.order : i + 1,
        name: String(s.name || '').trim(),
        special: i === 0 ? 'Opener' : i === songs.length - 1 ? 'Closer' : '',
      }))
      .filter(s => s.name.length > 0);

    if (normalizedSongs.length === 0) {
      return res.status(400).json({ error: 'No valid songs provided' });
    }

    // Re-number after the filter (in case some songs were dropped).
    normalizedSongs.forEach((s, i) => { s.number = i + 1; });

    // Create the setlist.
    const setlist = await Setlist.create({
      artist: artist._id,
      artistName: artist.name,
      artistSlug: artist.slug,
      venue: venue.trim(),
      city: city.trim(),
      date: new Date(date),
      songs: normalizedSongs,
      vibePreview: review ? review.slice(0, 60) : '',
    });

    // Optionally attach a review if the user filled in the textarea.
    if (review && review.trim().length >= 5) {
      await Review.create({
        setlist: setlist._id,
        artistName: artist.name,
        text: review.trim(),
        rating: 5, // submitter implicitly rates 5 by default
      });
    }

    // Maintain denormalized counters on the artist.
    const newTotalTracks = (artist.totalTracks || 0) + normalizedSongs.length;
    const newShowCount = (artist.showCount || 0) + 1;
    await Artist.findByIdAndUpdate(artist._id, {
      showCount: newShowCount,
      totalTracks: newTotalTracks,
    });

    res.status(201).json(setlist);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
