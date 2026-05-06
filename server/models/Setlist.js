// server/models/Setlist.js
//
// Represents a single concert performance that already happened.
// Distinct from UpcomingShow (planned future event with no songs yet).
//
// Design decisions:
//   - Songs are EMBEDDED in the setlist (no separate Songs collection).
//     Concerts have variable, ordered song lists; embedding means one read
//     per setlist instead of a join.
//   - artistName + artistSlug are denormalized so list pages render without
//     a join lookup against the Artists collection.
//   - vibeCheck is cached on the document — we don't re-call the LLM on every
//     page view. It's regenerated when a user clicks "Regenerate Vibe Check".

const mongoose = require('mongoose');

// Embedded song subdocument.
// `special` is a free-text label the front-end displays as a badge:
// "Opener" / "Closer" / "Rare ✦". Keeps schema flexible for future labels.
const songSchema = new mongoose.Schema(
  {
    number:  { type: Number, required: true },
    name:    { type: String, required: true, trim: true },
    special: { type: String, trim: true, default: '' },
  },
  { _id: false } // don't generate ids for embedded subdocs — saves space
);

// Cached AI-synthesized summary of all reviews for this show.
const vibeCheckSchema = new mongoose.Schema(
  {
    vibeText:    { type: String, default: '' },
    tags:        { type: [String], default: [] },
    reviewCount: { type: Number, default: 0 },
    generatedAt: { type: Date },
  },
  { _id: false }
);

const setlistSchema = new mongoose.Schema(
  {
    artist:     { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
    artistName: { type: String, required: true, trim: true },     // denormalized
    artistSlug: { type: String, required: true, lowercase: true, index: true },

    venue:      { type: String, required: true, trim: true },
    city:       { type: String, required: true, trim: true },
    country:    { type: String, trim: true, default: 'US' },
    date:       { type: Date, required: true, index: true },

    songs:      { type: [songSchema], default: [] },

    // Short snippet from a representative review — shown on artist-page show cards
    // as the italic preview text ("Transcendent, wall of sound...").
    vibePreview: { type: String, trim: true, default: '' },

    // Cached AI summary of all reviews for this show.
    vibeCheck:  { type: vibeCheckSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Compound index — most queries filter by artist and sort by date desc.
setlistSchema.index({ artist: 1, date: -1 });

module.exports = mongoose.model('Setlist', setlistSchema);

