"""Tests for movie-posters channel models — verifies mimir_utils migration."""
import json
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from channels.movie_posters.models import PosterCache, Settings

_POSTERS = [{"poster_path": "/abc.jpg", "title": "Movie A", "year": "2024"}]


class TestSettings:
    def test_defaults(self):
        s = Settings()
        assert s.api_key == ""
        assert len(s.sources) == 6
        assert s.poster_size == "w780"

    def test_to_public_dict_masks_key(self):
        s = Settings(api_key="tmdb-secret-key-1234")
        pub = s.to_public_dict()
        assert pub["api_key"].startswith("••••••••")
        assert "tmdb" not in pub["api_key"]

    def test_from_dict_ignores_unknown(self):
        s = Settings.from_dict({"api_key": "k", "fit_mode": "fill", "bogus": True})
        assert s.fit_mode == "fill"

    def test_sources_default_preserved_on_partial_from_dict(self):
        s = Settings.from_dict({"api_key": "k"})
        assert len(s.sources) == 6


class TestPosterCache:
    @pytest.fixture
    def cache(self, tmp_path):
        return PosterCache(tmp_path / "posters.json")

    def test_empty_state_has_sources_key(self, cache):
        assert "sources" in cache._data

    def test_needs_refresh_when_missing(self, cache):
        assert cache.needs_refresh("popular", 24) is True

    def test_update_then_no_refresh(self, cache):
        cache.update("popular", _POSTERS)
        assert cache.needs_refresh("popular", 168) is False

    def test_get_posters(self, cache):
        cache.update("popular", _POSTERS)
        assert cache.get_posters("popular")[0]["title"] == "Movie A"

    def test_get_posters_combined(self, cache):
        cache.update("popular", _POSTERS)
        cache.update("top_rated", [{"poster_path": "/x.jpg", "title": "Movie B"}])
        combined = cache.get_posters_combined()
        assert len(combined) == 2

    def test_remove_source(self, cache):
        cache.update("popular", _POSTERS)
        cache.remove_source("popular")
        assert cache.get_posters("popular") == []

    def test_mark_stale_all(self, cache):
        cache.update("popular", _POSTERS)
        cache.update("top_rated", _POSTERS)
        cache.mark_stale()
        assert cache.needs_refresh("popular", 1) is True
        assert cache.needs_refresh("top_rated", 1) is True

    def test_mark_stale_single(self, cache):
        cache.update("popular", _POSTERS)
        cache.update("top_rated", _POSTERS)
        cache.mark_stale("popular")
        assert cache.needs_refresh("popular", 1) is True
        assert cache.needs_refresh("top_rated", 1) is False

    def test_stats(self, cache):
        cache.update("popular", _POSTERS)
        s = cache.stats()
        assert s["popular"]["count"] == 1

    def test_persists_to_disk(self, tmp_path):
        c1 = PosterCache(tmp_path / "p.json")
        c1.update("popular", _POSTERS)
        c2 = PosterCache(tmp_path / "p.json")
        assert c2.get_posters("popular")[0]["title"] == "Movie A"

    def test_corrupt_file_starts_with_empty_state(self, tmp_path):
        p = tmp_path / "p.json"
        p.write_text("not json {{")
        c = PosterCache(p)
        assert c._data == {"sources": {}}
