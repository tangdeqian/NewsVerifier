"""
url_crawler.py — fetch and parse news content from a URL.
Used by the /api/fetch_url endpoint in server.py.
"""

import re
import requests
from urllib.parse import urlparse

try:
    import trafilatura
    HAS_TRAFILATURA = True
except ImportError:
    HAS_TRAFILATURA = False

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def fetch_news_from_url(url: str, timeout: int = 10) -> dict:
    """
    Fetch and extract title + body text from a news URL.
    Returns: {"title": str, "content": str, "error": str|None}
    """
    result = {"title": "", "content": "", "error": None}

    try:
        # Validate URL
        parsed = urlparse(url)
        if not parsed.scheme.startswith("http"):
            result["error"] = "Invalid URL scheme"
            return result

        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
        html = resp.text

        # ── Trafilatura (best quality) ─────────────────────────────────────
        if HAS_TRAFILATURA:
            extracted = trafilatura.extract(
                html,
                include_links=False,
                include_tables=False,
                favor_recall=True,
            )
            if extracted:
                result["content"] = extracted[:4000]

        # ── BeautifulSoup fallback ─────────────────────────────────────────
        if not result["content"] and HAS_BS4:
            soup = BeautifulSoup(html, "html.parser")

            # Remove noise tags
            for tag in soup(["script", "style", "nav", "header", "footer",
                              "aside", "advertisement", "noscript"]):
                tag.decompose()

            # Title
            title_tag = soup.find("h1") or soup.find("title")
            if title_tag:
                result["title"] = title_tag.get_text(strip=True)

            # Body paragraphs
            paragraphs = soup.find_all("p")
            text = "\n".join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 40)
            result["content"] = text[:4000]

        # ── Title extraction ───────────────────────────────────────────────
        if not result["title"] and HAS_BS4:
            soup = BeautifulSoup(html, "html.parser")
            og_title = soup.find("meta", property="og:title")
            if og_title:
                result["title"] = og_title.get("content", "")
            elif soup.title:
                result["title"] = soup.title.string or ""

        if not result["content"]:
            result["error"] = "Could not extract content from URL"

    except requests.exceptions.Timeout:
        result["error"] = "Request timed out"
    except requests.exceptions.HTTPError as e:
        result["error"] = f"HTTP error: {e}"
    except Exception as e:
        result["error"] = str(e)

    return result
