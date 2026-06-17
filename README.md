# Mimir Movie Posters Channel

Displays random movie poster art from [The Movie Database (TMDB)](https://www.themoviedb.org). Supports genres (Action, Horror, Sci-Fi…) and curated lists (Popular, Top Rated, Now Playing, Upcoming) as sub-channels — so different screens can show different categories.

## Getting Your TMDB API Key

TMDB offers a free API for personal and developer use. Setup takes about 2 minutes.

### Step-by-step

1. **Create an account** at [themoviedb.org/signup](https://www.themoviedb.org/signup) and verify your email address.

2. **Request API access** — go to [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) and click **Create** under the *API* section.

3. **Choose Developer** when prompted for the application type.

4. **Fill in the form:**
   - Application URL: `http://localhost` (any URL is fine for personal use)
   - Application Name: `Mimir Movie Posters` (or anything you like)
   - Summary: `Personal home display for showing movie posters`
   - Everything else can be left as defaults.

5. **Copy your API Key (v3 auth)** — it looks like a 32-character hex string, e.g. `a1b2c3d4e5f6...`

6. **Paste the key into Mimir** — open the Movie Posters channel manager and paste into the API key field. The UI will verify the key before saving it.

> **Note:** The v3 API key is what this plugin uses. Ignore the "API Read Access Token (v4 auth)" on the same page — that's a different format.

---

## Features

- Genre sub-channels: Action, Comedy, Horror, Sci-Fi, Animation, and 14 more
- Curated list sub-channels: Popular, Top Rated, Now Playing, Upcoming
- Local poster cache — no TMDB hit on every display refresh
- Configurable minimum vote count to filter out obscure titles
- Repeat suppression within a session
- PIL-based image resizing with letterbox / crop / stretch fit modes
- Weekly cache refresh by default (TMDB poster lists are stable)

## Installation

### 1. Deploy the plugin

```bash
cp -r channels/movie_posters/ /path/to/mimir-api/channels/
pip install -r channels/movie_posters/requirements.txt
```

### 2. Docker

```yaml
# docker-compose.override.yml
services:
  api:
    volumes:
      - /path/to/mimir-source-movie-posters/channels/movie_posters:/var/opt/mimir/mimir-api/channels/movie_posters:ro
```

```bash
docker compose up -d --force-recreate api
```

### 3. Configure the API key

Once the channel appears in Mimir, open the **Movie Posters** channel manager. The setup screen walks you through getting and entering your API key.

---

## Default Sources

| Source | Type | Notes |
|--------|------|-------|
| Popular | List | Currently trending on TMDB |
| Top Rated | List | Highest rated films of all time |
| Action | Genre | Genre ID 28 |
| Science Fiction | Genre | Genre ID 878 |
| Horror | Genre | Genre ID 27 |
| Animation | Genre | Genre ID 16 |

You can add or remove any genre or list from the channel manager.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `api_key` | — | TMDB v3 API key (required) |
| `poster_size` | `w780` | Image width: `w342`, `w500`, `w780`, `original` |
| `fit_mode` | `letterbox` | `letterbox`, `crop`, or `stretch` |
| `cache_max_per_source` | `500` | Max poster entries cached per source |
| `refresh_interval_hours` | `168` | Cache refresh interval (default: weekly) |
| `min_vote_count` | `50` | Minimum TMDB votes — filters out obscure titles |
| `include_adult` | `false` | Whether to include adult-rated content |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/manifest` | Channel manifest |
| `GET` | `/subchannels` | List configured sources |
| `POST` | `/request-image` | Get a random poster as raw JPEG bytes |
| `GET` | `/settings` | Get settings (API key is masked) |
| `PUT` | `/settings` | Update settings |
| `GET` | `/status` | Cache stats and source list |
| `POST` | `/refresh` | Trigger cache refresh (body: `{"source": "id"}` or `{}` for all) |
| `POST` | `/validate-key` | Validate a TMDB API key before saving |
| `GET` | `/genres` | Fetch the current TMDB genre list |

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

[![TMDB](https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg)](https://www.themoviedb.org)

## File Structure

```
mimir-source-movie-posters/
└── channels/
    └── movie_posters/
        ├── __init__.py
        ├── channel.py          # Main channel class + FastAPI router
        ├── models.py           # Settings and PosterCache data models
        ├── fetcher.py          # TMDB HTTP helpers
        ├── plugin.json         # Plugin manifest
        ├── requirements.txt
        ├── data/               # Runtime data (auto-created)
        │   ├── settings.json   # Persisted settings (API key stored here)
        │   └── posters_cache.json
        └── ui/
            └── manage.esm.js   # Management web component
```

## Troubleshooting

**"TMDB API key not configured" error on screens**
Open the channel manager, go through the API key setup, and click Verify & Save.

**No posters after adding a source**
Click **Refresh All** in the channel manager. The first fetch takes 10–30 seconds depending on how many sources are configured.

**Posters look stretched or have black bars**
Change the Fit Mode in Settings. `crop` fills the frame; `letterbox` preserves the full poster with black bars; `stretch` fills without cropping but distorts aspect ratio.

**Want higher resolution posters?**
Change Poster Size to `w780` or `original` in Settings. Note that `original` files can be 1–3 MB each.
