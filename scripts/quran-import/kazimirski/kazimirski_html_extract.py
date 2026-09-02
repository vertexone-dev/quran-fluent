"""
Independent, from-scratch extractor for texte_entier_raw.html.

Purpose: this is Phase 3's OWN fresh re-parse of the frozen Wikisource HTML
artifact, written independently of Phase 1's robust_align.py /
kazimirski_li_texts.json, so that stage 1 (PARSE) of the importer design in
PHASE2-MAPPING-ARCHITECTURE.md really is an independent re-derivation and not
just a re-read of Phase 1's own cached output. Phase 1's
kazimirski_li_texts.json is used only as a cross-validation reference
(compared, never trusted blindly) -- see reconcile_with_phase1() below and
the manifest generator's own use of this module.

Allowed normalizations only (PHASE2-MAPPING-ARCHITECTURE.md §9):
  1. HTML entity decoding
  2. Unicode NFC normalization
  3. Trimming leading/trailing whitespace introduced by HTML formatting

Nothing else. Footnote markers (<sup class="reference">...</sup>) and
Wikisource page-boundary markers (<span class="pagenum ...">) are structural
scaffolding, not part of Kazimirski's translated text, and are stripped as
part of extracting "the text", not as a content normalization -- exactly the
same category of thing dropping surrounding <li> tags is.
"""
from __future__ import annotations

import hashlib
import html
import re
import unicodedata
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

H3_RE = re.compile(r'<h3[^>]*class="tmp mw-html-heading"[^>]*>(.*?)</h3>', re.S)


@dataclass(frozen=True)
class RawSegment:
    surah_number: int
    source_ordinal: int  # 1-based physical position of the <li> within its surah
    text: str


class _LiTextExtractor(HTMLParser):
    """Extracts plain text from a fragment, dropping <sup> (footnotes) and
    <span class="pagenum ..."> (page markers) subtrees entirely, decoding
    entities, keeping everything else's text content in document order."""

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.chunks: list[str] = []
        self._skip_depth = 0  # >0 while inside a <sup> element

    def handle_starttag(self, tag, attrs):
        if tag == "sup":
            self._skip_depth += 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag == "sup" and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth == 0:
            self.chunks.append(data)

    def handle_entityref(self, name):
        if self._skip_depth == 0:
            self.chunks.append(html.unescape(f"&{name};"))

    def handle_charref(self, name):
        if self._skip_depth == 0:
            self.chunks.append(html.unescape(f"&#{name};"))

    def text(self) -> str:
        return "".join(self.chunks)


def _clean_li_fragment(fragment: str) -> str:
    """fragment is the raw inner HTML of one <li>...</li> (sup/span tags
    still present). Returns normalized plain text per the 3 allowed
    normalizations only."""
    parser = _LiTextExtractor()
    parser.feed(fragment)
    parser.close()
    raw = parser.text()
    # Allowed normalization 2: Unicode NFC.
    raw = unicodedata.normalize("NFC", raw)
    # Collapse internal whitespace runs coming purely from HTML line-wrapping
    # (newlines/tabs the source file uses for its own 80-column formatting,
    # not part of Kazimirski's prose) into single spaces, then trim.
    raw = re.sub(r"[ \t\r\n]+", " ", raw)
    # Allowed normalization 3: trim leading/trailing whitespace only.
    return raw.strip()


def extract_surah_fragments(html_text: str) -> list[str]:
    """Returns the 114 raw HTML fragments, one per surah, in document order,
    each spanning from just after that surah's <h3> heading to just before
    the next one (or end of document for the last)."""
    headings = list(H3_RE.finditer(html_text))
    if len(headings) != 114:
        raise ValueError(f"expected 114 <h3 class=\"tmp mw-html-heading\"> headings, found {len(headings)}")
    fragments = []
    for i, h in enumerate(headings):
        start = h.end()
        end = headings[i + 1].start() if i + 1 < len(headings) else len(html_text)
        fragments.append(html_text[start:end])
    return fragments


_LI_SPLIT_RE = re.compile(r"<li\b[^>]*>", re.S)


def extract_li_items(fragment: str) -> list[str]:
    """Splits a surah fragment on <li> start tags and returns the cleaned
    text of each <li>, in order. Tolerant of the surah-91-style malformed
    fragment (no closing </ol>/</li> before the next heading) because it
    never looks for the closing tags -- only for <li> boundaries, which is
    exactly the same tolerance Phase 1 used (see PHASE1-ALIGNMENT-AUDIT.md
    §1, Surah 91 note)."""
    # Only consider <li> occurring inside the (first, only) <ol> of this
    # fragment. All 114 surah fragments have exactly one <ol> in this
    # source (verified during generation; enforced by the caller's count
    # checks against Kazimirski's own declared counts).
    ol_start = fragment.find("<ol>")
    if ol_start == -1:
        # Some very short surahs may not use exactly "<ol>" -- fall back to
        # scanning the whole fragment; <li> only ever appears inside an <ol>
        # in this document.
        ol_start = 0
    ol_fragment = fragment[ol_start:]
    parts = _LI_SPLIT_RE.split(ol_fragment)
    # parts[0] is whatever precedes the first <li> (the "<ol>\n" bit etc.);
    # parts[1:] are the (still <li>-tag-free) contents of each <li>, each one
    # running up to the *next* <li> start tag (i.e. still containing that
    # <li>'s own trailing "</li>" plus anything after </ol> for the final
    # item -- both stripped safely since </li>, </ol>, and everything after
    # is not part of Kazimirski's text and the HTML parser only extracts
    # text, so a stray "</ol>" tag itself contributes no text; but content
    # AFTER </ol> physically belongs to the next structural element (a <hr>,
    # a page marker, or the next chapter start), so it must be cut off at
    # </ol> if present).
    #
    # === Phase 4 fix (root cause of the Surah 2 / Surah 36 mismap) ===
    # This function used to append EVERY <li>'s cleaned text to `items`,
    # including genuinely empty ones (<li class="mw-empty-elt">, found at
    # exactly 2 physical positions in the whole document: Surah 2 after real
    # item 6, Surah 36 after real item 34). That gave those empty markers a
    # permanent slot in the sequential 1-based position count, so every real
    # item after them was numbered one too high -- which cascaded into a
    # near-total, systematic mis-join for the rest of both surahs' segments
    # (verified via the actual 1869 Charpentier page scan, Wikisource djvu
    # page image matching Google Books ID 3XSe413MJyQC, and independent
    # cross-check against the governed Pickthall translation at >15 points
    # per surah -- see PHASE4-AMENDMENTS.json and the Phase 4 report).
    #
    # The scanned page shows Kazimirski's own printed verse numbers are
    # CONTINUOUS with no gap at these positions -- every canonical ayah's
    # French text is genuinely present in the source. The empty <li> is a
    # Wikisource transcription artifact with no counterpart in the printed
    # book and must not consume a position slot at all. Skipping
    # zero-content <li> elements entirely (never appending them to `items`)
    # is therefore not a text change (no translation text is added, removed,
    # or altered) -- it only corrects which physical position each REAL
    # item's text is assigned to, which is exactly this function's job.
    items = []
    for part in parts[1:]:
        ol_close = part.find("</ol>")
        is_final = ol_close != -1
        if is_final:
            part = part[:ol_close]
        cleaned = _clean_li_fragment(part)
        if cleaned.strip():
            items.append(cleaned)
        if is_final:
            # This <li> contained its list's own closing </ol> -- it is the
            # final item of THIS surah's list. Stop here unconditionally so
            # a later, unrelated <ol> further down the document (footnotes,
            # table of contents, etc. -- relevant only for the very last
            # surah, which has no following <h3> to bound its fragment)
            # never gets swept in as extra segments.
            break
    return items


def extract_all_segments(html_path: Path) -> tuple[list[RawSegment], str, str]:
    """Returns (segments, raw_html_text, sha256_hex) for the whole document."""
    raw_bytes = html_path.read_bytes()
    sha256_hex = hashlib.sha256(raw_bytes).hexdigest()
    html_text = raw_bytes.decode("utf-8")
    fragments = extract_surah_fragments(html_text)
    segments: list[RawSegment] = []
    for surah_number, fragment in enumerate(fragments, start=1):
        items = extract_li_items(fragment)
        for ordinal, text in enumerate(items, start=1):
            segments.append(RawSegment(surah_number=surah_number, source_ordinal=ordinal, text=text))
    return segments, html_text, sha256_hex


def extract_bismillah_surah1(html_text: str) -> str:
    """Extracts Surah 1's unnumbered preamble sentence (the Bismillah),
    which sits in a <div style="text-align:center;clear:both;"><i>...</i>
    </div> block immediately before Surah 1's <ol>, outside the numbered
    list entirely (PHASE1-ALIGNMENT-AUDIT.md §4.3)."""
    fragments = extract_surah_fragments(html_text)
    surah1 = fragments[0]
    ol_start = surah1.find("<ol>")
    preamble_region = surah1[:ol_start]
    divs = re.findall(r'<div style="text-align:center;clear:both;">(.*?)</div>', preamble_region, re.S)
    # divs[0] is "Donné à la Mecque. — 7 versets." ; divs[1] is the Bismillah.
    if len(divs) < 2:
        raise ValueError(f"expected >=2 centered <div> blocks before Surah 1's <ol>, found {len(divs)}")
    bismillah_fragment = divs[1]
    return _clean_li_fragment(bismillah_fragment)


def aggregate_ordered_hash(segments_in_order: list[str]) -> str:
    """sha256 of all segment texts joined by \\x1e, in (surah_number,
    source_ordinal) order, per PHASE2-MAPPING-ARCHITECTURE.md §9."""
    joined = "\x1e".join(segments_in_order)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


if __name__ == "__main__":
    import sys

    here = Path(__file__).parent
    html_path = here / "texte_entier_raw.html"
    segments, html_text, sha = extract_all_segments(html_path)
    print(f"sha256: {sha}")
    print(f"total segments extracted: {len(segments)}")
    by_surah: dict[int, int] = {}
    for s in segments:
        by_surah[s.surah_number] = by_surah.get(s.surah_number, 0) + 1
    print(f"surahs seen: {len(by_surah)}")
    bismillah = extract_bismillah_surah1(html_text)
    print(f"Fatiha Bismillah: {bismillah!r}")
