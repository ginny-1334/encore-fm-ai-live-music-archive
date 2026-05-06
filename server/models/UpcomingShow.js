// server/models/UpcomingShow.js
//
// A scheduled future concert (no songs played yet).
// Kept as a separate collection from Setlist because:
//   - Setlists have songs[]; upcoming shows don't.
//   - Different query patterns: "future shows asc" vs "past shows desc".

const mongoose = require('mongoose');

const upcomingShowSchema = new mongoose.Schema(
  {
    artist:     { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
    artistName: { type: String, required: true, trim: true },
    artistSlug: { type: String, required: true, lowercase: true, index: true },

    date:       { type: Date, required: true, index: true },
    venueName:  { type: String, required: true, trim: true },
    venueCity:  { type: String, required: true, trim: true },
    venueYear:  { type: Number },

    ticketUrl:  { type: String, trim: true },
  },
  { timestamps: true }
);

// Auto-fill venueYear from date — parameterless sync hook.
upcomingShowSchema.pre('validate', function () {
  if (this.date && !this.venueYear) {
    this.venueYear = new Date(this.date).getFullYear();
  }
});

module.exports = mongoose.model('UpcomingShow', upcomingShowSchema);