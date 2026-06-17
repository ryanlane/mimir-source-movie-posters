from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


# Default sources shown before the user customises anything.
# List types map to TMDB's /movie/{list} endpoints.
# Genre types map to /discover/movie?with_genres={query}.
_DEFAULT_SOURCES = [
    {"id": "popular",     "label": "Popular",          "type": "list",  "query": "popular"},
    {"id": "top_rated",   "label": "Top Rated",        "type": "list",  "query": "top_rated"},
    {"id": "genre_28",    "label": "Action",           "type": "genre", "query": "28"},
    {"id": "genre_878",   "label": "Science Fiction",  "type": "genre", "query": "878"},
    {"id": "genre_27",    "label": "Horror",           "type": "genre", "query": "27"},
    {"id": "genre_16",    "label": "Animation",        "type": "genre", "query": "16"},
]


@dataclass
class Settings:
    api_key: str = ""
    sources: List[Dict[str, str]] = field(default_factory=lambda: list(_DEFAULT_SOURCES))
    poster_size: str = "w780"
    fit_mode: str = "letterbox"
    cache_max_per_source: int = 500
    refresh_interval_hours: int = 168
    min_vote_count: int = 50
    include_adult: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_public_dict(self) -> Dict[str, Any]:
        """Same as to_dict but with the API key masked."""
        d = self.to_dict()
        if d.get("api_key"):
            d["api_key"] = "••••••••" + d["api_key"][-4:]
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Settings":
        known = set(cls.__dataclass_fields__)
        return cls(**{k: v for k, v in data.items() if k in known})


class PosterCache:
    """Persists poster entries per source in a JSON file."""

    def __init__(self, cache_path: Path):
        self._path = cache_path
        self._data: Dict[str, Any] = self._load()

    def _load(self) -> Dict[str, Any]:
        if self._path.exists():
            try:
                return json.loads(self._path.read_text())
            except Exception:
                pass
        return {"sources": {}}

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(self._data, indent=2))

    def get_posters(self, source_id: str) -> List[Dict[str, Any]]:
        return self._data.get("sources", {}).get(source_id, {}).get("posters", [])

    def get_posters_combined(self, source_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if source_id:
            return self.get_posters(source_id)
        combined = []
        for entry in self._data.get("sources", {}).values():
            combined.extend(entry.get("posters", []))
        return combined

    def needs_refresh(self, source_id: str, interval_hours: int) -> bool:
        entry = self._data.get("sources", {}).get(source_id, {})
        return time.time() - entry.get("fetched_at", 0) > interval_hours * 3600

    def update(self, source_id: str, posters: List[Dict[str, Any]]) -> None:
        self._data.setdefault("sources", {})[source_id] = {
            "posters": posters,
            "count": len(posters),
            "fetched_at": time.time(),
        }
        self._save()

    def remove_source(self, source_id: str) -> None:
        self._data.get("sources", {}).pop(source_id, None)
        self._save()

    def mark_stale(self, source_id: Optional[str] = None) -> None:
        targets = [source_id] if source_id else list(self._data.get("sources", {}).keys())
        for sid in targets:
            if sid in self._data.get("sources", {}):
                self._data["sources"][sid]["fetched_at"] = 0
        self._save()

    def stats(self) -> Dict[str, Dict[str, Any]]:
        return {
            sid: {"count": e.get("count", 0), "fetched_at": e.get("fetched_at")}
            for sid, e in self._data.get("sources", {}).items()
        }
