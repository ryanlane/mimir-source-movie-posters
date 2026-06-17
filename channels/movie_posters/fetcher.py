"""TMDB HTTP helpers.

All network I/O is synchronous (requests library); callers wrap with
asyncio.to_thread so the FastAPI event loop is never blocked.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger("mimir.channels.movieposters.fetcher")

_API_BASE = "https://api.themoviedb.org/3"
_IMAGE_BASE = "https://image.tmdb.org/t/p"
_USER_AGENT = "MimirMoviePosters/1.0 (https://github.com/ryanlane/mimir)"
_PAGE_SIZE = 20   # TMDB returns 20 results per page
_PAGE_DELAY = 0.1  # seconds between paginated requests — TMDB limit is 40 req/10s


def _session(api_key: str) -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = _USER_AGENT
    s.params = {"api_key": api_key}  # type: ignore[assignment]
    return s


def validate_api_key(api_key: str) -> Dict[str, Any]:
    """Test an API key against /3/configuration. Returns {valid, error}."""
    if not api_key or not api_key.strip():
        return {"valid": False, "error": "API key is empty"}
    try:
        resp = requests.get(
            f"{_API_BASE}/configuration",
            params={"api_key": api_key.strip()},
            headers={"User-Agent": _USER_AGENT},
            timeout=10,
        )
        if resp.status_code == 401:
            return {"valid": False, "error": "Invalid API key — check your TMDB account settings"}
        if resp.status_code == 404:
            return {"valid": False, "error": "TMDB API endpoint not found — check network"}
        resp.raise_for_status()
        return {"valid": True}
    except requests.exceptions.ConnectionError:
        return {"valid": False, "error": "Could not reach api.themoviedb.org — check network"}
    except Exception as exc:
        return {"valid": False, "error": str(exc)}


def fetch_genres(api_key: str) -> List[Dict[str, Any]]:
    """Return the full TMDB movie genre list as [{id, name}, ...]."""
    try:
        resp = requests.get(
            f"{_API_BASE}/genre/movie/list",
            params={"api_key": api_key},
            headers={"User-Agent": _USER_AGENT},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json().get("genres", [])
    except Exception as exc:
        logger.warning("[MoviePosters] Genre list fetch failed: %s", exc)
        return []


def _parse_results(results: List[Dict[str, Any]], min_vote_count: int) -> List[Dict[str, Any]]:
    posters = []
    for movie in results:
        poster_path = movie.get("poster_path")
        if not poster_path:
            continue
        if movie.get("vote_count", 0) < min_vote_count:
            continue
        release = movie.get("release_date") or ""
        posters.append({
            "poster_path": poster_path,
            "title": movie.get("title", ""),
            "year": release[:4] if len(release) >= 4 else None,
            "vote_average": movie.get("vote_average"),
            "movie_id": movie.get("id"),
        })
    return posters


def fetch_list_posters(
    list_name: str,
    api_key: str,
    max_posters: int = 500,
    min_vote_count: int = 50,
    include_adult: bool = False,
) -> List[Dict[str, Any]]:
    """Fetch posters from a TMDB curated list: popular, top_rated, now_playing, upcoming."""
    valid_lists = {"popular", "top_rated", "now_playing", "upcoming"}
    if list_name not in valid_lists:
        logger.warning("[MoviePosters] Unknown list name '%s'", list_name)
        return []

    sess = _session(api_key)
    posters: List[Dict[str, Any]] = []
    page = 1
    total_pages: Optional[int] = None

    while len(posters) < max_posters:
        try:
            resp = sess.get(
                f"{_API_BASE}/movie/{list_name}",
                params={"page": page, "include_adult": str(include_adult).lower()},
                timeout=15,
            )
            resp.raise_for_status()
            body = resp.json()
        except Exception as exc:
            logger.warning("[MoviePosters] List fetch failed list=%s page=%d: %s", list_name, page, exc)
            break

        if total_pages is None:
            total_pages = body.get("total_pages", 1)

        results = body.get("results", [])
        if not results:
            break

        posters.extend(_parse_results(results, min_vote_count))

        page += 1
        if page > total_pages or page > (max_posters // _PAGE_SIZE) + 1:
            break

        time.sleep(_PAGE_DELAY)

    logger.info("[MoviePosters] Fetched %d posters for list '%s'", len(posters), list_name)
    return posters[:max_posters]


def fetch_genre_posters(
    genre_id: str,
    api_key: str,
    max_posters: int = 500,
    min_vote_count: int = 50,
    include_adult: bool = False,
) -> List[Dict[str, Any]]:
    """Fetch posters for a TMDB genre ID via /discover/movie."""
    sess = _session(api_key)
    posters: List[Dict[str, Any]] = []
    page = 1
    total_pages: Optional[int] = None

    while len(posters) < max_posters:
        try:
            resp = sess.get(
                f"{_API_BASE}/discover/movie",
                params={
                    "with_genres": genre_id,
                    "sort_by": "popularity.desc",
                    "vote_count.gte": min_vote_count,
                    "include_adult": str(include_adult).lower(),
                    "page": page,
                },
                timeout=15,
            )
            resp.raise_for_status()
            body = resp.json()
        except Exception as exc:
            logger.warning("[MoviePosters] Genre fetch failed genre=%s page=%d: %s", genre_id, page, exc)
            break

        if total_pages is None:
            total_pages = min(body.get("total_pages", 1), 500)  # TMDB caps at 500 pages

        results = body.get("results", [])
        if not results:
            break

        posters.extend(_parse_results(results, min_vote_count))

        page += 1
        if page > total_pages or page > (max_posters // _PAGE_SIZE) + 1:
            break

        time.sleep(_PAGE_DELAY)

    logger.info("[MoviePosters] Fetched %d posters for genre '%s'", len(posters), genre_id)
    return posters[:max_posters]


def fetch_poster_image(poster_path: str, size: str = "w780") -> Optional[bytes]:
    """Fetch a poster JPEG from the TMDB image CDN. No API key required."""
    url = f"{_IMAGE_BASE}/{size}{poster_path}"
    try:
        resp = requests.get(url, headers={"User-Agent": _USER_AGENT}, timeout=20)
        if resp.status_code != 200:
            return None
        ct = resp.headers.get("content-type", "")
        if "image/jpeg" not in ct and "image/png" not in ct and "image/webp" not in ct:
            return None
        if len(resp.content) < 1000:
            return None
        return resp.content
    except Exception as exc:
        logger.warning("[MoviePosters] Poster fetch failed path=%s: %s", poster_path, exc)
        return None
