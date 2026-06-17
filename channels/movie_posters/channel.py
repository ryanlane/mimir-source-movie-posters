"""Movie Posters channel for Mimir Platform.

Serves random movie poster art from The Movie Database (TMDB).
Each configured source (genre or curated list) is a sub-channel.
Requires a free TMDB API v3 key — see README for setup instructions.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import random
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from .models import PosterCache, Settings
from . import fetcher as _fetcher

_PLUGIN_DIR = Path(__file__).parent
logger = logging.getLogger("mimir.channels.movieposters")

try:
    from PIL import Image as _PilImage
    _PIL = True
except ImportError:
    _PIL = False
    logger.warning("[MoviePosters] Pillow not installed — image resizing disabled")


class MoviePostersChannel:
    def __init__(self, channel_dir: str):
        self.channel_dir = Path(channel_dir)
        self.data_dir = self.channel_dir / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)

        plugin_json = self.channel_dir / "plugin.json"
        self._meta: Dict[str, Any] = {}
        if plugin_json.exists():
            try:
                self._meta = json.loads(plugin_json.read_text())
            except Exception:
                pass

        self.settings = self._load_settings()
        self.cache = PosterCache(self.data_dir / "posters_cache.json")
        self.last_error: Optional[str] = None
        self._recently_shown: Dict[str, deque] = {}

        logger.info("[MoviePosters] Initialized at %s", self.channel_dir)

    @property
    def id(self) -> str:
        return self._meta.get("id", "com.mimir.movieposters")

    # ------------------------------------------------------------------
    # Settings

    def _settings_path(self) -> Path:
        return self.data_dir / "settings.json"

    def _load_settings(self) -> Settings:
        p = self._settings_path()
        if p.exists():
            try:
                return Settings.from_dict(json.loads(p.read_text()))
            except Exception as exc:
                logger.warning("[MoviePosters] Settings load failed: %s", exc)
        return Settings()

    def _save_settings(self) -> None:
        self._settings_path().write_text(json.dumps(self.settings.to_dict(), indent=2))

    # ------------------------------------------------------------------
    # Poster selection

    def _pick_poster(self, posters: List[Dict[str, Any]], key: str) -> Optional[Dict[str, Any]]:
        if not posters:
            return None
        window = min(50, max(1, len(posters) // 2))
        recent = self._recently_shown.setdefault(key, deque(maxlen=window))
        recent_paths = set(recent)
        candidates = [p for p in posters if p["poster_path"] not in recent_paths]
        if not candidates:
            recent.clear()
            candidates = posters
        chosen = random.choice(candidates)
        recent.append(chosen["poster_path"])
        return chosen

    # ------------------------------------------------------------------
    # Image resizing

    def _resize(self, img_bytes: bytes, target: tuple, fit_mode: str) -> bytes:
        if not _PIL or not target:
            return img_bytes
        try:
            img = _PilImage.open(io.BytesIO(img_bytes)).convert("RGB")
            tw, th = target
            iw, ih = img.size

            if fit_mode == "crop":
                scale = max(tw / iw, th / ih)
                nw, nh = int(iw * scale), int(ih * scale)
                img = img.resize((nw, nh), _PilImage.LANCZOS)
                img = img.crop(((nw - tw) // 2, (nh - th) // 2, (nw + tw) // 2, (nh + th) // 2))
            elif fit_mode == "stretch":
                img = img.resize((tw, th), _PilImage.LANCZOS)
            else:  # letterbox
                scale = min(tw / iw, th / ih)
                nw, nh = int(iw * scale), int(ih * scale)
                resized = img.resize((nw, nh), _PilImage.LANCZOS)
                canvas = _PilImage.new("RGB", (tw, th), (0, 0, 0))
                canvas.paste(resized, ((tw - nw) // 2, (th - nh) // 2))
                img = canvas

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=92, optimize=True)
            return buf.getvalue()
        except Exception as exc:
            logger.warning("[MoviePosters] Resize failed: %s", exc)
            return img_bytes

    # ------------------------------------------------------------------
    # Cache management

    async def _ensure_cache(self, source_id: Optional[str] = None) -> None:
        if not self.settings.api_key:
            return
        sources = (
            [s for s in self.settings.sources if s["id"] == source_id]
            if source_id
            else self.settings.sources
        )
        for source in sources:
            sid = source["id"]
            if not self.cache.needs_refresh(sid, self.settings.refresh_interval_hours):
                continue
            source_type = source.get("type", "list")
            logger.info("[MoviePosters] Refreshing cache for %s '%s'", source_type, sid)
            try:
                kwargs = dict(
                    api_key=self.settings.api_key,
                    max_posters=self.settings.cache_max_per_source,
                    min_vote_count=self.settings.min_vote_count,
                    include_adult=self.settings.include_adult,
                )
                if source_type == "genre":
                    posters = await asyncio.to_thread(
                        _fetcher.fetch_genre_posters, source["query"], **kwargs
                    )
                else:
                    posters = await asyncio.to_thread(
                        _fetcher.fetch_list_posters, source["query"], **kwargs
                    )
                self.cache.update(sid, posters)
                self.last_error = None
            except Exception as exc:
                logger.error("[MoviePosters] Cache refresh failed for '%s': %s", sid, exc)
                self.last_error = str(exc)

    # ------------------------------------------------------------------
    # Mimir channel protocol

    def get_manifest(self) -> Dict[str, Any]:
        stats = self.cache.stats()
        total = sum(v["count"] for v in stats.values())
        has_key = bool(self.settings.api_key)
        return {
            "id": self.id,
            "name": self._meta.get("name", "Movie Posters"),
            "version": self._meta.get("version", "1.0.0"),
            "description": self._meta.get("description", ""),
            "icon": self._meta.get("icon", "film"),
            "capabilities": {
                "supports_upload": False,
                "supports_subchannels": True,
            },
            "ui": {
                "components": {"manager": f"/api/channels/{self.id}/ui/manage.esm.js"},
                "elements": {"manager": "x-movie-posters-manager"},
            },
            "healthy": has_key and self.last_error is None,
            "setup_required": not has_key,
            "source_count": len(self.settings.sources),
            "total_posters_cached": total,
        }

    def supports_subchannels(self) -> bool:
        return True

    def get_subchannel_config(self) -> Dict[str, Any]:
        return {
            "label": "Sources",
            "singular": "Source",
            "description": "Each source is a pool of posters (genre or curated list)",
            "can_create": False,
            "can_delete": False,
            "can_update": False,
        }

    def get_subchannels(self) -> List[Dict[str, Any]]:
        stats = self.cache.stats()
        return [
            {
                "id": s["id"],
                "name": s["label"],
                "image_count": stats.get(s["id"], {}).get("count", 0),
                "type": "subchannel",
                "source_type": s.get("type", "list"),
            }
            for s in self.settings.sources
        ]

    def get_subchannel(self, subchannel_id: str) -> Optional[Dict[str, Any]]:
        for sc in self.get_subchannels():
            if sc["id"] == subchannel_id:
                return sc
        return None

    # ------------------------------------------------------------------
    # Image request

    async def request_image(self, request_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.settings.api_key:
            return {"success": False, "error": "TMDB API key not configured — open the channel manager to add your key"}

        data = request_data or {}
        source_id = (
            data.get("subchannel_id")
            or data.get("gallery_id")
            or (data.get("settings") or {}).get("subChannelId")
        ) or None

        known_ids = {s["id"] for s in self.settings.sources}
        if source_id and source_id not in known_ids:
            source_id = None

        await self._ensure_cache(source_id)

        posters = self.cache.get_posters_combined(source_id)
        if not posters:
            return {"success": False, "error": "No posters cached yet — open the channel manager and click Refresh"}

        resolution = (data.get("settings") or {}).get("resolution") or data.get("resolution")
        target_size: Optional[tuple] = None
        if resolution and len(resolution) == 2:
            try:
                target_size = (int(resolution[0]), int(resolution[1]))
            except (TypeError, ValueError):
                pass

        cache_key = source_id or "__all__"
        chosen = self._pick_poster(posters, cache_key)

        for _ in range(5):
            if not chosen:
                break
            img_bytes = await asyncio.to_thread(
                _fetcher.fetch_poster_image, chosen["poster_path"], self.settings.poster_size
            )
            if img_bytes:
                if target_size:
                    img_bytes = self._resize(img_bytes, target_size, self.settings.fit_mode)
                self.last_error = None
                return {
                    "success": True,
                    "bytes": img_bytes,
                    "content_type": "image/jpeg",
                    "preferred_transport": "bytes",
                    "title": chosen.get("title", ""),
                    "year": chosen.get("year"),
                    "poster_path": chosen["poster_path"],
                    "source": source_id,
                }
            chosen = self._pick_poster(posters, cache_key)

        self.last_error = "Poster image fetch failed after retries"
        return {"success": False, "error": self.last_error}

    # ------------------------------------------------------------------
    # Router

    def get_router(self) -> APIRouter:
        router = APIRouter()
        _ui_dir = _PLUGIN_DIR / "ui"

        @router.get("/ui/{filename:path}")
        async def serve_ui(filename: str):
            file_path = (_ui_dir / filename).resolve()
            try:
                file_path.relative_to(_ui_dir.resolve())
            except ValueError:
                raise HTTPException(403, "Forbidden")
            if not file_path.exists():
                raise HTTPException(404, f"Not found: {filename}")
            ctype = "application/javascript" if filename.endswith(".js") else "text/css"
            return Response(
                content=file_path.read_bytes(),
                media_type=ctype,
                headers={"Cache-Control": "no-cache"},
            )

        @router.get("/manifest")
        async def get_manifest_route():
            return JSONResponse(self.get_manifest())

        @router.get("/subchannels")
        async def list_subchannels():
            return JSONResponse(self.get_subchannels())

        @router.get("/settings")
        async def get_settings():
            return JSONResponse(self.settings.to_public_dict())

        @router.put("/settings")
        async def update_settings(request: Request):
            body = await request.json()
            allowed = {
                "api_key", "sources", "poster_size", "fit_mode",
                "cache_max_per_source", "refresh_interval_hours",
                "min_vote_count", "include_adult",
            }
            for k in allowed:
                if k in body:
                    # Don't overwrite a real key with the masked placeholder
                    if k == "api_key" and body[k].startswith("••••"):
                        continue
                    setattr(self.settings, k, body[k])
            self._save_settings()
            return JSONResponse({"success": True, "settings": self.settings.to_public_dict()})

        @router.post("/validate-key")
        async def validate_key(request: Request):
            body = await request.json()
            api_key = body.get("api_key", "").strip()
            result = await asyncio.to_thread(_fetcher.validate_api_key, api_key)
            if result["valid"]:
                # Persist it immediately
                self.settings.api_key = api_key
                self._save_settings()
            return JSONResponse(result)

        @router.get("/genres")
        async def list_genres():
            if not self.settings.api_key:
                return JSONResponse({"error": "API key not set"}, status_code=400)
            genres = await asyncio.to_thread(_fetcher.fetch_genres, self.settings.api_key)
            return JSONResponse(genres)

        @router.get("/status")
        async def get_status():
            stats = self.cache.stats()
            return JSONResponse({
                "sources": self.get_subchannels(),
                "cache_stats": stats,
                "last_error": self.last_error,
                "setup_required": not bool(self.settings.api_key),
                "settings": self.settings.to_public_dict(),
            })

        @router.post("/refresh")
        async def refresh_cache(request: Request):
            body: Dict[str, Any] = {}
            try:
                body = await request.json()
            except Exception:
                pass
            if not self.settings.api_key:
                raise HTTPException(400, "API key not configured")
            source_id = body.get("source") or None
            self.cache.mark_stale(source_id)
            asyncio.create_task(self._ensure_cache(source_id))
            return JSONResponse({"success": True, "message": f"Refresh started for {source_id or 'all sources'}"})

        @router.post("/request-image")
        async def request_image_binary(request: Request):
            body: Dict[str, Any] = {}
            try:
                body = await request.json()
            except Exception:
                pass
            result = await self.request_image(body)
            if not result.get("success"):
                raise HTTPException(500, result.get("error", "request_image failed"))
            img_bytes = result.get("bytes")
            if not img_bytes:
                raise HTTPException(500, "No image bytes produced")
            fingerprint = hashlib.sha256(img_bytes).hexdigest()[:32]
            return Response(
                content=img_bytes,
                media_type=result.get("content_type", "image/jpeg"),
                headers={
                    "X-Content-Fingerprint": fingerprint,
                    "Cache-Control": "no-store",
                },
            )

        logger.info("[MoviePosters] Router registered, %d sources configured", len(self.settings.sources))
        return router


ChannelClass = MoviePostersChannel
