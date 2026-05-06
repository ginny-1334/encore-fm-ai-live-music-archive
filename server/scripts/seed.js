// server/scripts/seed.js
//
// Wipes the database and repopulates it with synthetic but realistic data.
// Run with: npm run seed
//
// Why synthetic data:
//   - Full control over data quality for the demo (predictor produces clean,
//     interpretable bars instead of noisy real-world results).
//   - No scraping, no rate limits, no licensing questions.
//   - Reproducible: anyone on the team can run `npm run seed` and get an
//     identical database state.
//
// Data shape engineered to make features shine:
//   - "Core" songs appear in every show (predictor → "guaranteed", high %)
//   - "Frequent" songs appear in most shows (predictor → "very_likely")
//   - "Occasional" songs in some shows (predictor → "possible")
//   - "Rare" songs appear in 1 show only (predictor → "deep_cut", flagged)

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db/connection');

const Artist = require('../models/Artist');
const Setlist = require('../models/Setlist');
const Review = require('../models/Review');
const UpcomingShow = require('../models/UpcomingShow');

// ---------- Helpers ----------

// Build a date N days ago from today.
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Build a date N days in the future from today.
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// Build a songs array from a list of titles, marking opener/closer/rare.
function buildSongs(titles, { rareTitles = [] } = {}) {
  return titles.map((name, i) => {
    let special = '';
    if (i === 0) special = 'Opener';
    else if (i === titles.length - 1) special = 'Closer';
    else if (rareTitles.includes(name)) special = 'Rare ✦';
    return { number: i + 1, name, special };
  });
}

// ---------- Synthetic dataset ----------
// Each artist has:
//   - core[]       songs played at every show
//   - frequent[]   songs played at most shows
//   - occasional[] songs played at some shows
//   - rare[]       songs that appear in exactly one show as a deep cut
//   - shows[]      the actual concerts (we generate songs[] per show below)

const ARTISTS = [
  {
    name: 'My Bloody Valentine',
    genre: 'Shoegaze · Alternative',
    bio: 'Irish-English shoegaze band formed in Dublin in 1983. Pioneers of the wall-of-sound aesthetic, best known for their 1991 album Loveless.',
    core: ['Only Shallow', 'When You Sleep', 'You Made Me Realise'],
    frequent: ['Cigarette in Your Bed', 'Honey Power', 'Soon', 'Wonder 2'],
    occasional: ['New You', 'Slow', 'Feed Me with Your Kiss', 'Thorn'],
    rare: ['Blown', 'Lose My Breath'],
    shows: [
      { date: daysAgo(40),  venue: 'Royal Albert Hall',    city: 'London',        country: 'UK' },
      { date: daysAgo(60),  venue: 'Brixton Academy',      city: 'London',        country: 'UK' },
      { date: daysAgo(85),  venue: 'Madison Square Garden',city: 'New York',      country: 'US' },
      { date: daysAgo(120), venue: 'Hollywood Bowl',       city: 'Los Angeles',   country: 'US' },
      { date: daysAgo(170), venue: 'Olympia',              city: 'Paris',         country: 'FR' },
      { date: daysAgo(200), venue: 'Budokan',              city: 'Tokyo',         country: 'JP' },
    ],
    upcoming: [
      { date: daysFromNow(15), venueName: 'O2 Arena',  venueCity: 'London, UK' },
      { date: daysFromNow(28), venueName: 'Zenith',    venueCity: 'Paris, France' },
      { date: daysFromNow(36), venueName: 'Paradiso',  venueCity: 'Amsterdam, Netherlands' },
    ],
  },
  {
    name: 'Slowdive',
    genre: 'Shoegaze · Dream Pop',
    bio: 'English shoegaze band formed in Reading in 1989. Reformed in 2014 after a 19-year hiatus, releasing acclaimed albums Slowdive (2017) and everything is alive (2023).',
    core: ['Shanty', 'Catch the Breeze', 'Alison'],
    frequent: ['When the Sun Hits', 'Star Roving', 'Sugar for the Pill', 'Souvlaki Space Station'],
    occasional: ['Crazy for You', 'Avalyn', '40 Days', 'Dagger'],
    rare: ['Golden Hair', 'Machine Gun'],
    shows: [
      { date: daysAgo(30),  venue: 'Brooklyn Steel',  city: 'Brooklyn',      country: 'US' },
      { date: daysAgo(50),  venue: 'Roadrunner',      city: 'Boston',        country: 'US' },
      { date: daysAgo(75),  venue: 'The Salt Shed',   city: 'Chicago',       country: 'US' },
      { date: daysAgo(110), venue: 'The Fillmore',    city: 'San Francisco', country: 'US' },
      { date: daysAgo(150), venue: 'Roundhouse',      city: 'London',        country: 'UK' },
    ],
    upcoming: [
      { date: daysFromNow(20), venueName: 'Brooklyn Paramount', venueCity: 'Brooklyn, USA' },
      { date: daysFromNow(33), venueName: 'House of Blues',     venueCity: 'Boston, USA' },
    ],
  },
  {
    name: 'Cocteau Twins',
    genre: 'Dream Pop · Ethereal Wave',
    bio: 'Scottish band formed in Grangemouth in 1979. Pioneers of dream pop, known for Elizabeth Fraser\'s ethereal vocals and Robin Guthrie\'s lush guitar textures.',
    core: ['Heaven or Las Vegas', 'Iceblink Luck', 'Cherry-Coloured Funk'],
    frequent: ['Pearly Dewdrops\' Drops', 'Carolyn\'s Fingers', 'Lorelei', 'Aikea-Guinea'],
    occasional: ['Pitch the Baby', 'Bluebeard', 'Half-Gifts', 'Violaine'],
    rare: ['Pink Orange Red', 'Frou-Frou Foxes in Midsummer Fires'],
    shows: [
      { date: daysAgo(45),  venue: 'Beacon Theatre',  city: 'New York',      country: 'US' },
      { date: daysAgo(70),  venue: 'Orpheum Theatre', city: 'Boston',        country: 'US' },
      { date: daysAgo(95),  venue: 'Riviera Theatre', city: 'Chicago',       country: 'US' },
      { date: daysAgo(135), venue: 'Warfield Theatre',city: 'San Francisco', country: 'US' },
    ],
    upcoming: [],
  },
  {
    name: 'Radiohead',
    genre: 'Art Rock · Alternative',
    bio: 'English rock band formed in Abingdon in 1985. One of the most critically acclaimed bands of their generation, known for albums OK Computer (1997) and Kid A (2000).',
    core: ['Idioteque', 'Everything in Its Right Place', 'Karma Police'],
    frequent: ['Lucky', 'No Surprises', 'Pyramid Song', 'Reckoner', 'Weird Fishes'],
    occasional: ['How to Disappear Completely', '15 Step', 'Bodysnatchers', 'Daydreaming'],
    rare: ['True Love Waits', 'Talk Show Host'],
    shows: [
      { date: daysAgo(35),  venue: 'Madison Square Garden', city: 'New York',     country: 'US' },
      { date: daysAgo(55),  venue: 'United Center',         city: 'Chicago',      country: 'US' },
      { date: daysAgo(80),  venue: 'The Forum',             city: 'Los Angeles',  country: 'US' },
      { date: daysAgo(115), venue: 'O2 Arena',              city: 'London',       country: 'UK' },
      { date: daysAgo(145), venue: 'AccorHotels Arena',     city: 'Paris',        country: 'FR' },
    ],
    upcoming: [
      { date: daysFromNow(50), venueName: 'Glastonbury Pyramid Stage', venueCity: 'Somerset, UK' },
    ],
  },
  {
    name: 'Portishead',
    genre: 'Trip-Hop',
    bio: 'English trip-hop band formed in Bristol in 1991. Their 1994 debut Dummy is a landmark of the genre, characterized by Beth Gibbons\' haunting vocals and dark, atmospheric production.',
    core: ['Glory Box', 'Roads', 'Wandering Star'],
    frequent: ['Sour Times', 'Mysterons', 'Numb', 'Cowboys'],
    occasional: ['Strangers', 'Over', 'It Could Be Sweet'],
    rare: ['Magic Doors'],
    shows: [
      { date: daysAgo(90),  venue: 'Hammerstein Ballroom', city: 'New York', country: 'US' },
      { date: daysAgo(125), venue: 'The Wiltern',          city: 'Los Angeles', country: 'US' },
      { date: daysAgo(180), venue: 'Le Trianon',           city: 'Paris',     country: 'FR' },
    ],
    upcoming: [],
  },
];

// Vibe previews — short snippets shown on artist-page show cards.
const VIBE_PREVIEWS = [
  'Transcendent, wall of sound',
  'Euphoric, dream-like energy',
  'Sold out, crowd in trance',
  'Outdoor magic, perfect mix',
  'Intimate, devastating beauty',
  'Rare deep cuts, legendary set',
  'Cathartic, every word sung back',
  'Hypnotic, completely silent crowd',
];

// Sample review texts — assigned to setlists at random with personas.
const REVIEW_AUTHORS = ['kevin_s', 'billinda_b', 'scene_chaser', 'vinyl_kid', 'subway_show', 'wall_of_sound'];
const REVIEW_TEXTS = [
  'Best show I\'ve ever seen. The wall of noise during the closer lasted what felt like 20 minutes. Crowd just stood still, hypnotized.',
  'Sound mix took a few songs to settle but once it locked in, every track hit perfectly. Venue acoustics were everything.',
  'Crowd was completely transported. No mosh pit — everyone just standing still with eyes closed. Sound was crushing but somehow also delicate.',
  'Arrived late and missed the opener but from the second song onwards it was absolutely perfect. The unexpected deep cut sent me.',
  'Pure catharsis. The kind of show where you leave a different person than you walked in. Can\'t stop thinking about it.',
  'Visuals were incredible, lights synced perfectly. The band barely moved but it didn\'t matter, the songs do all the work.',
  'Honestly a slog if you don\'t know the deep cuts. Audio was crystal clear though, no complaints there.',
  'Incredible energy from the very first note. Crowd moshed relentlessly. They left with their ears ringing for two days.',
];

// Builds a song titles array for one show, drawing from core/frequent/occasional/rare.
// Engineered to give the predictor obvious patterns:
//   - All core songs always appear (likelihood ~100%)
//   - Most frequent songs appear (~75%)
//   - Some occasional songs appear (~40%)
//   - Rare songs appear in just one show across the full set
function pickSongsForShow(artistData, showIndex, totalShows) {
  const titles = [];

  // Core: always.
  titles.push(...artistData.core);

  // Frequent: skip ~1 in 4 shows pseudo-deterministically.
  for (const f of artistData.frequent) {
    if ((showIndex + f.length) % 4 !== 0) titles.push(f);
  }

  // Occasional: include ~40% of them per show.
  for (let i = 0; i < artistData.occasional.length; i++) {
    if ((showIndex + i) % 3 === 0) titles.push(artistData.occasional[i]);
  }

  // Rare: stuff one rare song into one specific show per rare title.
  artistData.rare.forEach((rareTitle, i) => {
    if (showIndex === i % totalShows) titles.push(rareTitle);
  });

  return titles;
}

// ---------- Main seed routine ----------

async function seed() {
  await connectDB();

  console.log('[seed] Wiping existing data...');
  await Promise.all([
    Artist.deleteMany({}),
    Setlist.deleteMany({}),
    Review.deleteMany({}),
    UpcomingShow.deleteMany({}),
  ]);

  console.log('[seed] Inserting artists, setlists, upcoming shows, and reviews...');

  for (const data of ARTISTS) {
    // Create the artist (slug auto-generates from name).
    const artist = await Artist.create({
      name: data.name,
      genre: data.genre,
      bio: data.bio,
    });

    // Build setlists.
    const setlists = [];
    for (let i = 0; i < data.shows.length; i++) {
      const show = data.shows[i];
      const songTitles = pickSongsForShow(data, i, data.shows.length);
      const songs = buildSongs(songTitles, { rareTitles: data.rare });

      setlists.push({
        artist: artist._id,
        artistName: artist.name,
        artistSlug: artist.slug,
        venue: show.venue,
        city: show.city,
        country: show.country,
        date: show.date,
        songs,
        vibePreview: VIBE_PREVIEWS[(i + data.name.length) % VIBE_PREVIEWS.length],
      });
    }
    const insertedSetlists = await Setlist.insertMany(setlists);

    // Build upcoming shows.
    const upcoming = (data.upcoming || []).map(u => ({
      artist: artist._id,
      artistName: artist.name,
      artistSlug: artist.slug,
      date: u.date,
      venueName: u.venueName,
      venueCity: u.venueCity,
    }));
    if (upcoming.length) await UpcomingShow.insertMany(upcoming);

    // Build 2-3 reviews per setlist.
    const reviews = [];
    for (const setlist of insertedSetlists) {
      const reviewsPerShow = 2 + (setlist.songs.length % 2); // 2 or 3
      for (let r = 0; r < reviewsPerShow; r++) {
        reviews.push({
          setlist: setlist._id,
          artistName: artist.name,
          username: REVIEW_AUTHORS[(r + setlist.songs.length) % REVIEW_AUTHORS.length],
          rating: 4 + (r % 2),
          text: REVIEW_TEXTS[(r + setlist.songs.length) % REVIEW_TEXTS.length],
        });
      }
    }
    await Review.insertMany(reviews);

    // Update the artist's denormalized counters.
    const totalTracks = insertedSetlists.reduce((sum, s) => sum + s.songs.length, 0);
    await Artist.findByIdAndUpdate(artist._id, {
      showCount: insertedSetlists.length,
      upcomingCount: upcoming.length,
      totalTracks,
    });

    console.log(
      `  - ${artist.name.padEnd(22)} ${insertedSetlists.length} shows, ${upcoming.length} upcoming, ${reviews.length} reviews, ${totalTracks} tracks logged`
    );
  }

  console.log('[seed] Done.');
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});

