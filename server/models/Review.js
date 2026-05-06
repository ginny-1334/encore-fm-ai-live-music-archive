// server/models/Review.js
//
// User-submitted concert review.
// Used to (a) display raw reviews on the setlist page, and
// (b) feed the LLM that synthesizes the per-show Vibe Check summary.

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    setlist:    { type: mongoose.Schema.Types.ObjectId, ref: 'Setlist', required: true, index: true },
    artistName: { type: String, required: true, trim: true }, // denormalized for cross-artist queries

    username:   { type: String, trim: true, default: 'anonymous' },
    rating:     { type: Number, min: 1, max: 5 },
    text:       { type: String, required: true, trim: true, minlength: 5, maxlength: 5000 },

    // Per-review sentiment (optional — populated if we run sentiment per-review;
    // currently we aggregate at the setlist level via vibeCheck on Setlist).
    vibeScore:  { type: Number, min: -1, max: 1 },
    vibeLabel:  { type: String, enum: ['negative', 'mixed', 'positive'] },
  },
  { timestamps: true }
);

reviewSchema.index({ createdAt: -1 }); // for /api/reviews/recent

module.exports = mongoose.model('Review', reviewSchema);

