// server/models/Artist.js
//
// Represents a musical artist (band or solo musician).
//
// Design decisions:
//   - `slug` is the canonical URL key (e.g. /artist.html?name=my-bloody-valentine)
//     because it's human-readable and shareable. ObjectIds are not.
//   - We auto-generate the slug from `name` if not provided.
//   - Counter fields (showCount, upcomingCount, totalTracks) are denormalized
//     for fast reads on list pages.

const mongoose = require('mongoose');

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const artistSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true, unique: true, index: true },
    slug:     { type: String, lowercase: true, index: true },
    genre:    { type: String, trim: true },
    bio:      { type: String, trim: true },
    imageUrl: { type: String, trim: true },

    showCount:     { type: Number, default: 0 },
    upcomingCount: { type: Number, default: 0 },
    totalTracks:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Auto-derive slug from name before validation.
// Note: parameterless function — Mongoose 8 treats this as sync, no `next` callback.
artistSchema.pre('validate', function () {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }
});

artistSchema.statics.slugify = slugify;

module.exports = mongoose.model('Artist', artistSchema);