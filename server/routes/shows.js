// server/routes/shows.js
//
// Endpoints for upcoming (future) shows.
//
// Routes:
//   GET /api/shows/upcoming                       All upcoming shows
//   GET /api/shows/upcoming?artistId=<idOrSlug>   Upcoming shows for an artist
//   GET /api/shows/upcoming/:id                   Single upcoming show by ID

const express = require('express');
const mongoose = require('mongoose');
const UpcomingShow = require('../models/UpcomingShow');

const router = express.Router();

// IMPORTANT: register the more-specific /upcoming/:id BEFORE /upcoming,
// otherwise Express tries to match /:id first against the wrong route.
// (Both start with /upcoming so the order matters less here, but it's a good habit.)

// GET /api/shows/upcoming/:id
// Returns a single upcoming show (used by the dedicated prediction page).
router.get('/upcoming/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid show id' });
    }
    const show = await UpcomingShow.findById(req.params.id).lean();
    if (!show) return res.status(404).json({ error: 'Upcoming show not found' });
    res.json(show);
  } catch (err) {
    next(err);
  }
});

// GET /api/shows/upcoming?artistId=<idOrSlug>&limit=10
router.get('/upcoming', async (req, res, next) => {
  try {
    const { artistId } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    // Always filter to future shows only.
    const filter = { date: { $gte: new Date() } };
    if (artistId) {
      if (mongoose.isValidObjectId(artistId)) {
        filter.artist = artistId;
      } else {
        filter.artistSlug = String(artistId).toLowerCase();
      }
    }

    const shows = await UpcomingShow.find(filter)
      .sort({ date: 1 })   // soonest first
      .limit(limit)
      .lean();

    res.json(shows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;



