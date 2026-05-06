// ============================================================
// Encore FM — shared front-end script
//
// Loaded by every page except add.html (which is self-contained).
// Structure:
//   1. API + utility helpers
//   2. Artist image map
//   3. Cursor / scroll / toast (UI feel)
//   4. Search (index.html)
//   5. Drag-and-drop setlist builder (add.html)
//   6. Home page render — trending artists + vibe cards
//   7. Artist page render — hero, bio, past shows, upcoming
//   8. Setlist page render — tracks, reviews, predictor, vibe check
//   9. Upcoming-show page render — predictions as the main feature
//  10. Page bootstrap
// ============================================================


// ============================================================
// 1. API + UTILITY HELPERS
// ============================================================

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatUpcomingDate(isoString) {
  const d = new Date(isoString);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return { month, day: d.getDate(), year: d.getFullYear() };
}


// ============================================================
// 2. ARTIST IMAGE MAP
// Local images in public/images/. Falls back to a generic Unsplash photo.
// ============================================================

const ARTIST_IMAGES = {
  'my-bloody-valentine': '/images/my-bloody-valentine.jpg',
  'slowdive':            '/images/slowdive.jpg',
  'cocteau-twins':       '/images/cocteau-twins.jpg',
  'radiohead':           '/images/radiohead.jpg',
  'portishead':          '/images/portishead.jpg',
};

function artistImageUrl(artist) {
  if (artist && artist.imageUrl) return artist.imageUrl;
  if (artist && ARTIST_IMAGES[artist.slug]) return ARTIST_IMAGES[artist.slug];
  return 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80';
}


// ============================================================
// 3. CURSOR + SCROLL + TOAST (runs on all pages)
// ============================================================

const cursor = document.getElementById('cursor');
if (cursor) {
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX - 6 + 'px';
    cursor.style.top  = e.clientY - 6 + 'px';
  });

  document.querySelectorAll(
    'a, button, .artist-card, .vibe-card, .setlist-track, .drag-item, .show-card, .upcoming-item, .upcoming-predict-btn'
  ).forEach(el => {
    el.addEventListener('mouseenter', () => cursor.style.transform = 'scale(2)');
    el.addEventListener('mouseleave', () => cursor.style.transform = 'scale(1)');
  });
}

const fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.15 });

document.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el));

function showToastMsg(icon, title, sub) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.querySelector('.toast-icon').textContent = icon;
  toast.querySelector('.toast-text').innerHTML = `<strong>${title}</strong> ${sub}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}


// ============================================================
// 4. SEARCH (index.html)
// ============================================================

const heroSearch = document.getElementById('heroSearch');
if (heroSearch) {
  const searchContainer = heroSearch.closest('.search-container') || heroSearch.parentElement;

  const suggestions = document.createElement('div');
  suggestions.className = 'search-suggestions';
  suggestions.style.cssText = `
    position:absolute; top:100%; left:0; right:0;
    background:rgba(20,15,30,0.96); backdrop-filter:blur(12px);
    border:1px solid rgba(255,255,255,0.1); border-radius:12px;
    margin-top:8px; padding:0.5rem; z-index:100;
    max-height:380px; overflow-y:auto; display:none;
  `;
  if (getComputedStyle(searchContainer).position === 'static') {
    searchContainer.style.position = 'relative';
  }
  searchContainer.appendChild(suggestions);

  let debounceTimer = null;
  heroSearch.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 250);
  });

  heroSearch.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      clearTimeout(debounceTimer);
      runSearch();
    }
  });

  document.addEventListener('click', e => {
    if (!searchContainer.contains(e.target)) {
      suggestions.style.display = 'none';
    }
  });
}

async function runSearch() {
  const input = document.getElementById('heroSearch');
  const suggestions = document.querySelector('.search-suggestions');
  if (!input || !suggestions) return;

  const q = input.value.trim();
  if (!q) {
    suggestions.style.display = 'none';
    return;
  }

  try {
    const results = await api(`/api/artists?q=${encodeURIComponent(q)}&limit=5`);

    if (results.length === 0) {
      suggestions.innerHTML = `
        <div style="padding:1rem;opacity:0.5;text-align:center;font-size:0.9rem;">
          No artists match "${escapeHtml(q)}"
        </div>`;
      suggestions.style.display = 'block';
      return;
    }

    suggestions.innerHTML = results.map(a => `
      <a href="artist.html?name=${escapeHtml(a.slug)}" class="search-suggestion-item"
         style="display:flex;justify-content:space-between;align-items:center;
                padding:0.75rem 1rem;border-radius:8px;text-decoration:none;
                color:white;transition:background 0.15s;"
         onmouseover="this.style.background='rgba(255,255,255,0.06)'"
         onmouseout="this.style.background='transparent'">
        <div>
          <div style="font-weight:600;">${escapeHtml(a.name)}</div>
          <div style="opacity:0.5;font-size:0.85rem;">${escapeHtml(a.genre || '')}</div>
        </div>
        <div style="opacity:0.5;font-size:0.85rem;">${a.showCount} shows →</div>
      </a>
    `).join('');
    suggestions.style.display = 'block';
  } catch (err) {
    console.error('Search failed:', err);
    suggestions.innerHTML = `
      <div style="padding:1rem;opacity:0.5;text-align:center;color:#ff6b6b;">
        Search failed. Try again.
      </div>`;
    suggestions.style.display = 'block';
  }
}

function doSearch() { runSearch(); }


// ============================================================
// 5. DRAG-AND-DROP SETLIST BUILDER (add.html)
// Form submission lives in add.html's inline <script>, not here.
// ============================================================

const dragList = document.getElementById('dragList');

if (dragList) {
  let dragSrc = null;

  function updateNumbers() {
    dragList.querySelectorAll('.drag-item').forEach((item, i) => {
      item.querySelector('.drag-item-num').textContent = i + 1;
    });
  }

  function addDragListeners(item) {
    item.addEventListener('dragstart', function () {
      dragSrc = this;
      setTimeout(() => this.classList.add('dragging'), 0);
    });
    item.addEventListener('dragend', function () {
      this.classList.remove('dragging');
      document.querySelectorAll('.drag-item').forEach(i => i.classList.remove('drag-target'));
      updateNumbers();
    });
    item.addEventListener('dragover', function (e) {
      e.preventDefault();
      document.querySelectorAll('.drag-item').forEach(i => i.classList.remove('drag-target'));
      if (this !== dragSrc) this.classList.add('drag-target');
    });
    item.addEventListener('drop', function (e) {
      e.preventDefault();
      if (dragSrc && this !== dragSrc) {
        const all = [...dragList.querySelectorAll('.drag-item')];
        if (all.indexOf(dragSrc) < all.indexOf(this)) {
          dragList.insertBefore(dragSrc, this.nextSibling);
        } else {
          dragList.insertBefore(dragSrc, this);
        }
      }
      this.classList.remove('drag-target');
      updateNumbers();
    });
  }

  dragList.querySelectorAll('.drag-item').forEach(addDragListeners);

  const dragZone = document.getElementById('dragZone');
  if (dragZone) dragZone.addEventListener('dragover', e => e.preventDefault());

  function addSong() {
    const input = document.getElementById('songInput');
    const name = input.value.trim();
    if (!name) return;

    const li = document.createElement('li');
    li.className = 'drag-item';
    li.draggable = true;
    li.innerHTML = `
      <span class="drag-handle">⠿</span>
      <span class="drag-item-num">${dragList.children.length + 1}</span>
      <span class="drag-item-name">${name}</span>
      <button class="drag-item-remove" onclick="removeSong(this)">×</button>
    `;
    dragList.appendChild(li);
    addDragListeners(li);
    input.value = '';
    input.focus();
    updateNumbers();
  }

  function removeSong(btn) {
    btn.closest('.drag-item').remove();
    updateNumbers();
  }

  const songInput = document.getElementById('songInput');
  if (songInput) songInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') addSong();
  });

  function closeSuccess() {
    const overlay = document.getElementById('successOverlay');
    if (overlay) overlay.classList.remove('show');
    ['formArtist', 'formVenue', 'formCity', 'formDate', 'formReview'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    dragList.innerHTML = '';
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSuccess();
  });
}


// ============================================================
// 6. HOME PAGE
// ============================================================

async function loadTrendingArtists() {
  const grid = document.getElementById('artistsGrid');
  if (!grid) return;

  try {
    const artists = await api('/api/artists?sort=trending&limit=6');

    if (artists.length === 0) {
      grid.innerHTML = '<div style="opacity:0.4;padding:2rem;">No artists yet.</div>';
      return;
    }

    grid.innerHTML = artists.map(a => {
      const imgUrl = artistImageUrl(a);
      const upcomingText = a.upcomingCount > 0 ? ` · ${a.upcomingCount} upcoming` : '';

      return `
        <a class="artist-card" href="artist.html?name=${escapeHtml(a.slug)}">
          <div class="artist-card-img" style="height:100%;background-image:url('${imgUrl}');background-size:cover;background-position:center;background-color:#1a0a2e;"></div>
          <div class="artist-card-overlay"></div>
          <div class="artist-card-info">
            <div class="artist-card-genre">${escapeHtml(a.genre || 'Music')}</div>
            <div class="artist-card-name">${escapeHtml(a.name)}</div>
            <div class="artist-card-shows">${a.showCount} shows archived${upcomingText}</div>
          </div>
        </a>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load trending artists:', err);
    grid.innerHTML = '<div style="opacity:0.4;padding:2rem;color:#ff6b6b;">Failed to load artists. Is the server running?</div>';
  }
}

async function loadRecentVibes() {
  const row = document.getElementById('vibeCardsRow');
  if (!row) return;

  try {
    const cards = await api('/api/reviews/recent?limit=3');

    if (cards.length === 0) {
      row.innerHTML = '<div style="opacity:0.4;padding:2rem;">No reviews yet.</div>';
      return;
    }

    row.innerHTML = cards.map(c => {
      const imgUrl = artistImageUrl({ slug: c.artistSlug });

      const tagsHtml = (c.tags || []).slice(0, 3).map(t =>
        `<span class="vibe-tag">${escapeHtml(t)}</span>`
      ).join('');

      const filledStars = Math.round(c.rating || 0);
      const stars = '★'.repeat(filledStars) + '☆'.repeat(5 - filledStars);

      const previewText = (c.vibeText || '').slice(0, 200);

      return `
        <a class="vibe-card" href="setlist.html?id=${escapeHtml(c.setlistId)}">
          <div class="vibe-card-hot">🔥 ${c.reviewCount} review${c.reviewCount === 1 ? '' : 's'} this week</div>
          <div class="vibe-card-header">
            <div class="vibe-card-img" style="background-image:url('${imgUrl}');background-size:cover;background-position:center;background-color:#1a0a2e;"></div>
            <div>
              <div class="vibe-card-artist">${escapeHtml(c.artistName)}</div>
              <div class="vibe-card-venue">${escapeHtml(c.venueName)} · ${escapeHtml(c.city)}</div>
            </div>
          </div>
          <div class="vibe-tags">${tagsHtml}</div>
          <p class="vibe-text">"${escapeHtml(previewText)}${previewText.length >= 200 ? '…' : ''}"</p>
          <div class="vibe-rating">
            <span class="vibe-stars">${stars}</span>
            <span class="vibe-count">Based on ${c.reviewCount} review${c.reviewCount === 1 ? '' : 's'}</span>
            <span class="vibe-arrow">→</span>
          </div>
        </a>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load recent vibes:', err);
    row.innerHTML = '<div style="opacity:0.4;padding:2rem;color:#ff6b6b;">Failed to load recent vibes.</div>';
  }
}


// ============================================================
// 7. ARTIST PAGE
// ============================================================

async function loadArtistPage() {
  const heroEl = document.getElementById('artistHero');
  if (!heroEl) return;

  const slug = getQueryParam('name');
  if (!slug) {
    heroEl.innerHTML = '<div style="opacity:0.6;padding:2rem;">No artist specified. Try ?name=my-bloody-valentine</div>';
    return;
  }

  try {
    const [artist, setlists, upcoming] = await Promise.all([
      api(`/api/artists/${encodeURIComponent(slug)}`),
      api(`/api/setlists?artistId=${encodeURIComponent(slug)}&limit=20`),
      api(`/api/shows/upcoming?artistId=${encodeURIComponent(slug)}&limit=10`),
    ]);

    renderArtistHero(artist);
    renderArtistBio(artist);
    renderPastShows(setlists);
    renderUpcomingShows(upcoming);
  } catch (err) {
    console.error('Failed to load artist page:', err);
    heroEl.innerHTML = `<div style="opacity:0.6;padding:2rem;color:#ff6b6b;">Failed to load artist. ${escapeHtml(err.message)}</div>`;
  }
}

function renderArtistHero(artist) {
  const el = document.getElementById('artistHero');
  if (!el) return;

  const imgUrl = artistImageUrl(artist);

  el.innerHTML = `
    <div style="display:flex;gap:3rem;align-items:center;flex-wrap:wrap;">
      <div style="flex:1;min-width:300px;">
        <div class="artist-hero-genre">${escapeHtml(artist.genre || 'Music')}</div>
        <h1 class="artist-hero-name">${escapeHtml(artist.name)}</h1>
        <div class="artist-hero-stats">
          <div class="artist-stat">
            <div class="artist-stat-num">${artist.showCount || 0}</div>
            <div class="artist-stat-label">Shows Archived</div>
          </div>
          <div class="artist-stat">
            <div class="artist-stat-num">${artist.upcomingCount || 0}</div>
            <div class="artist-stat-label">Upcoming</div>
          </div>
          <div class="artist-stat">
            <div class="artist-stat-num">${artist.totalTracks || 0}</div>
            <div class="artist-stat-label">Tracks Logged</div>
          </div>
        </div>
      </div>
      <div style="flex:0 0 auto;width:380px;max-width:40%;aspect-ratio:1/1;
                  background-image:url('${imgUrl}');background-size:cover;background-position:center;
                  background-color:#1a0a2e;border-radius:16px;
                  box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      </div>
    </div>
  `;
}

function renderArtistBio(artist) {
  const el = document.getElementById('artistBio');
  if (!el) return;
  el.textContent = artist.bio || 'No bio available.';
}

function renderPastShows(setlists) {
  const el = document.getElementById('pastShowsGrid');
  if (!el) return;

  if (!setlists.length) {
    el.innerHTML = '<div style="opacity:0.4;padding:2rem;grid-column:1/-1;">No shows archived yet.</div>';
    return;
  }

  el.innerHTML = setlists.map(s => {
    const { month, day, year } = formatUpcomingDate(s.date);
    const trackCount = s.songs ? s.songs.length : 0;

    return `
      <a class="upcoming-item" href="setlist.html?id=${escapeHtml(s._id)}" style="text-decoration:none;color:inherit;">
        <div class="upcoming-date">
          <div class="upcoming-month">${month}</div>
          <div class="upcoming-day">${day}</div>
          <div class="upcoming-year">${year}</div>
        </div>
        <div class="upcoming-info">
          <div class="upcoming-venue">${escapeHtml(s.venue)}</div>
          <div class="upcoming-city">${escapeHtml(s.city)}${s.country ? ', ' + escapeHtml(s.country) : ''} · ${trackCount} tracks</div>
        </div>
        <button class="upcoming-predict-btn">View Setlist →</button>
      </a>
    `;
  }).join('');
}

function renderUpcomingShows(shows) {
  const el = document.getElementById('upcomingList');
  if (!el) return;

  if (!shows.length) {
    el.innerHTML = '<div style="opacity:0.4;padding:2rem;">No upcoming shows announced.</div>';
    return;
  }

  el.innerHTML = shows.map(s => {
    const { month, day, year } = formatUpcomingDate(s.date);
    return `
      <div class="upcoming-item">
        <div class="upcoming-date">
          <div class="upcoming-month">${month}</div>
          <div class="upcoming-day">${day}</div>
          <div class="upcoming-year">${year}</div>
        </div>
        <div class="upcoming-info">
          <div class="upcoming-venue">${escapeHtml(s.venueName)}</div>
          <div class="upcoming-city">${escapeHtml(s.venueCity)}</div>
        </div>
        <button class="upcoming-predict-btn" onclick="window.location.href='setlist.html?artistId=${encodeURIComponent(s.artistSlug)}&upcoming=${encodeURIComponent(s._id)}'">Predict Setlist →</button>
      </div>
    `;
  }).join('');
}


// ============================================================
// 8. SETLIST PAGE — past show view
// ============================================================

async function loadSetlistPage() {
  const tracksEl = document.getElementById('setlistTracks');
  if (!tracksEl) return;

  const setlistId = getQueryParam('id');
  if (!setlistId) {
    tracksEl.innerHTML = '<li class="setlist-full-track"><span class="track-name" style="color:#ff6b6b;">No setlist id in URL.</span></li>';
    return;
  }

  try {
    const [setlist, reviews, vibe] = await Promise.all([
      api(`/api/setlists/${encodeURIComponent(setlistId)}`),
      api(`/api/reviews?setlistId=${encodeURIComponent(setlistId)}`),
      api(`/api/reviews/vibecheck?setlistId=${encodeURIComponent(setlistId)}`),
    ]);

    renderSetlistHeader(setlist);
    renderSetlistTracks(setlist);
    renderSetlistReviews(reviews);
    renderVibeCheck(vibe);

    const predictions = await api(`/api/setlists/predict?artistId=${encodeURIComponent(setlist.artistSlug)}`);
    renderPredictor(predictions);

    const rareTracks = (setlist.songs || []).filter(s => s.special === 'Rare ✦');
    if (rareTracks.length > 0) {
      showToastMsg('✦', 'Rare track played', `"${rareTracks[0].name}"`);
    }
  } catch (err) {
    console.error('Failed to load setlist page:', err);
    tracksEl.innerHTML = `<li class="setlist-full-track"><span class="track-name" style="color:#ff6b6b;">Failed to load setlist: ${escapeHtml(err.message)}</span></li>`;
  }
}

function renderSetlistHeader(setlist) {
  const breadcrumb = document.getElementById('setlistBreadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <a href="index.html">Home</a> ›
      <a href="artist.html?name=${escapeHtml(setlist.artistSlug)}">${escapeHtml(setlist.artistName)}</a> ›
      <span>${escapeHtml(formatDate(setlist.date))}</span>
    `;
  }

  const title = document.getElementById('setlistPageTitle');
  if (title) title.textContent = setlist.artistName;

  const meta = document.getElementById('setlistPageMeta');
  if (meta) {
    const fullDate = new Date(setlist.date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const songCount = setlist.songs ? setlist.songs.length : 0;
    meta.innerHTML = `
      <span class="setlist-meta-pill">📍 ${escapeHtml(setlist.venue)}, ${escapeHtml(setlist.city)}</span>
      <span class="setlist-meta-pill">📅 ${escapeHtml(fullDate)}</span>
      <span class="setlist-meta-pill">🎵 ${songCount} Songs</span>
    `;
  }
}

function renderSetlistTracks(setlist) {
  const el = document.getElementById('setlistTracks');
  if (!el) return;

  const songs = setlist.songs || [];
  if (songs.length === 0) {
    el.innerHTML = '<li class="setlist-full-track"><span class="track-name" style="opacity:0.4;">No tracks logged.</span></li>';
    return;
  }

  const pad = n => String(n).padStart(2, '0');

  el.innerHTML = songs.map(s => {
    const specialBadge = s.special
      ? `<span class="track-special">${escapeHtml(s.special)}</span>`
      : '';
    return `
      <li class="setlist-full-track">
        <span class="track-num">${pad(s.number)}</span>
        <span class="track-name">${escapeHtml(s.name)}</span>
        ${specialBadge}
      </li>
    `;
  }).join('');
}

function renderSetlistReviews(reviews) {
  const el = document.getElementById('reviewsList');
  if (!el) return;

  if (!reviews.length) {
    el.innerHTML = '<div class="review-item" style="opacity:0.4;"><p class="review-text">No reviews yet. Be the first.</p></div>';
    return;
  }

  el.innerHTML = reviews.map(r => {
    const filled = Math.round(r.rating || 0);
    const stars = '★'.repeat(filled) + '☆'.repeat(5 - filled);

    return `
      <div class="review-item">
        <div class="review-header">
          <span class="review-author">${escapeHtml(r.username || 'anonymous')}</span>
          <span class="review-stars">${stars}</span>
        </div>
        <p class="review-text">"${escapeHtml(r.text)}"</p>
      </div>
    `;
  }).join('');
}

function renderVibeCheck(vibe) {
  const textEl = document.getElementById('vibeCheckText');
  const tagsEl = document.getElementById('vibeCheckTags');

  if (textEl) {
    textEl.textContent = vibe.vibeText || 'No vibe check generated yet.';
    textEl.style.opacity = '1';
  }

  if (tagsEl) {
    const tags = vibe.tags || [];
    tagsEl.innerHTML = tags.map(t =>
      `<span class="vibe-tag">${escapeHtml(t)}</span>`
    ).join('');
  }
}

function renderPredictor(predictions) {
  const el = document.getElementById('predictionTracks');
  if (!el) return;

  if (!predictions.length) {
    el.innerHTML = '<div class="prediction-track" style="opacity:0.4;"><div class="prediction-track-header"><span class="prediction-track-name">No predictions available.</span></div></div>';
    return;
  }

  const top = predictions.slice(0, 8);

  el.innerHTML = top.map(p => {
    const rareBadge = p.isRare ? ' <span class="track-special-rare">RARE</span>' : '';
    return `
      <div class="prediction-track">
        <div class="prediction-track-header">
          <span class="prediction-track-name">${escapeHtml(p.songName)}${rareBadge}</span>
          <span class="prediction-pct">${p.likelihood}%</span>
        </div>
        <div class="prediction-bar-bg">
          <div class="prediction-bar-fill" data-width="${p.likelihood}%"></div>
        </div>
      </div>
    `;
  }).join('');

  setTimeout(() => {
    el.querySelectorAll('.prediction-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width;
    });
  }, 100);
}


// ============================================================
// 9. UPCOMING SHOW PAGE — predictor as the main feature
// Activated when ?upcoming=<id> is in the URL on setlist.html.
// APIs:
//   GET /api/shows/upcoming/:id
//   GET /api/setlists/predict?artistId=:slug
//   GET /api/setlists?artistId=:slug&limit=3
// ============================================================

async function loadUpcomingShow() {
  const upcomingId = getQueryParam('upcoming');
  if (!upcomingId) return;

  // Hide the regular past-show view, show the upcoming-show view.
  const pastView = document.getElementById('setlistViewMode');
  const upcomingView = document.getElementById('upcomingViewMode');
  if (pastView) pastView.style.display = 'none';
  if (upcomingView) upcomingView.style.display = 'block';

  try {
    const show = await api(`/api/shows/upcoming/${encodeURIComponent(upcomingId)}`);

    const [predictions, recentSetlists] = await Promise.all([
      api(`/api/setlists/predict?artistId=${encodeURIComponent(show.artistSlug)}`),
      api(`/api/setlists?artistId=${encodeURIComponent(show.artistSlug)}&limit=3`),
    ]);

    renderUpcomingHeader(show);
    renderUpcomingPredictions(predictions);
    renderUpcomingShowMeta(show);
    renderUpcomingRecentShows(recentSetlists);
  } catch (err) {
    console.error('Failed to load upcoming show:', err);
    const main = document.getElementById('upcomingPredictions');
    if (main) {
      main.innerHTML = `<p style="color:#ff6b6b;padding:1rem;">Failed to load upcoming show: ${escapeHtml(err.message)}</p>`;
    }
  }
}

function renderUpcomingHeader(show) {
  const breadcrumb = document.getElementById('setlistBreadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <a href="index.html">Home</a> ›
      <a href="artist.html?name=${escapeHtml(show.artistSlug)}">${escapeHtml(show.artistName)}</a> ›
      <span>Upcoming</span>
    `;
  }

  const title = document.getElementById('setlistPageTitle');
  if (title) {
    title.innerHTML = `${escapeHtml(show.artistName)} <em>· Predicted</em>`;
  }

  const meta = document.getElementById('setlistPageMeta');
  if (meta) {
    const fullDate = new Date(show.date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    meta.innerHTML = `
      <span class="setlist-meta-pill">📍 ${escapeHtml(show.venueName)}, ${escapeHtml(show.venueCity)}</span>
      <span class="setlist-meta-pill">📅 ${escapeHtml(fullDate)}</span>
      <span class="setlist-meta-pill" style="color:var(--red-light);border-color:rgba(192,57,43,0.4);">✦ UPCOMING</span>
    `;
  }
}

function renderUpcomingPredictions(predictions) {
  const el = document.getElementById('upcomingPredictions');
  if (!el) return;

  if (!predictions.length) {
    el.innerHTML = '<p style="color:rgba(255,255,255,0.4);">Not enough show history yet to predict.</p>';
    return;
  }

  // Show top 12 here (vs top 8 on the regular setlist sidebar) — predictor is the main event.
  const top = predictions.slice(0, 12);

  el.innerHTML = top.map(p => {
    const rareBadge = p.isRare ? ' <span class="track-special-rare">RARE</span>' : '';
    return `
      <div class="prediction-track">
        <div class="prediction-track-header">
          <span class="prediction-track-name">${escapeHtml(p.songName)}${rareBadge}</span>
          <span class="prediction-pct">${p.likelihood}%</span>
        </div>
        <div class="prediction-bar-bg">
          <div class="prediction-bar-fill" data-width="${p.likelihood}%"></div>
        </div>
      </div>
    `;
  }).join('');

  setTimeout(() => {
    el.querySelectorAll('.prediction-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width;
    });
  }, 100);
}

function renderUpcomingShowMeta(show) {
  const el = document.getElementById('upcomingShowMeta');
  if (!el) return;

  const fullDate = new Date(show.date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  el.innerHTML = `
    <p><strong>${escapeHtml(show.artistName)}</strong></p>
    <p>${escapeHtml(show.venueName)}</p>
    <p>${escapeHtml(show.venueCity)}</p>
    <p style="margin-top:8px;color:rgba(255,255,255,0.45);">${escapeHtml(fullDate)}</p>
  `;
}

function renderUpcomingRecentShows(setlists) {
  const el = document.getElementById('upcomingRecentShows');
  if (!el) return;

  if (!setlists.length) {
    el.innerHTML = '<p style="opacity:0.4;font-size:13px;">No recent shows logged.</p>';
    return;
  }

  el.innerHTML = setlists.map(s => {
    const { month, day, year } = formatUpcomingDate(s.date);
    return `
      <a class="upcoming-recent-show" href="setlist.html?id=${escapeHtml(s._id)}" style="text-decoration:none;color:inherit;">
        <div class="upcoming-recent-show-date">${month} ${day}<br>${year}</div>
        <div>
          <div class="upcoming-recent-show-info">${escapeHtml(s.venue)}</div>
          <div class="upcoming-recent-show-info-sub">${escapeHtml(s.city)} · ${s.songs ? s.songs.length : 0} tracks</div>
        </div>
      </a>
    `;
  }).join('');
}


// ============================================================
// 10. PAGE BOOTSTRAP
// Each loader bails immediately if it doesn't find its target element.
// On setlist.html, we dispatch by URL param: ?id (past) vs ?upcoming (predicted).
// ============================================================

loadTrendingArtists();
loadRecentVibes();
loadArtistPage();

if (getQueryParam('upcoming')) {
  loadUpcomingShow();
} else {
  loadSetlistPage();
}

