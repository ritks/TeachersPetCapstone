import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TextChunk:
    """A chunk of text extracted from a document, with optional section metadata."""
    content: str
    chunk_index: int
    chapter: Optional[str] = None
    section: Optional[str] = None
    metadata: dict = field(default_factory=dict)


class TextChunker:
    """Splits document text into chunks that respect section/chapter boundaries.

    Priority order for split points:
      1. Chapter / section headers
      2. Paragraph breaks
      3. Sentence boundaries (fallback)
    """

    def __init__(self, chunk_size: int = 1500, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

        self.chapter_pattern = re.compile(
            r"^(?:Chapter|CHAPTER|Unit|UNIT)\s+(\d+)[:\s.]*(.*)",
            re.MULTILINE,
        )
        self.section_pattern = re.compile(
            r"^(?:Section\s+)?(\d+\.\d+)[:\s.]*(.*)",
            re.MULTILINE,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chunk_text(self, text: str) -> list[TextChunk]:
        sections = self._split_by_sections(text)

        chunks: list[TextChunk] = []
        for section_text, chapter, section in sections:
            if len(section_text) > self.chunk_size:
                for sub in self._split_by_size(section_text):
                    chunks.append(
                        TextChunk(
                            content=sub,
                            chunk_index=len(chunks),
                            chapter=chapter,
                            section=section,
                        )
                    )
            else:
                chunks.append(
                    TextChunk(
                        content=section_text,
                        chunk_index=len(chunks),
                        chapter=chapter,
                        section=section,
                    )
                )
        return chunks

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _split_by_sections(
        self, text: str
    ) -> list[tuple[str, Optional[str], Optional[str]]]:
        markers: list[tuple[int, str, str, str]] = []

        for m in self.chapter_pattern.finditer(text):
            markers.append((m.start(), "chapter", m.group(1), m.group(2).strip()))

        for m in self.section_pattern.finditer(text):
            markers.append((m.start(), "section", m.group(1), m.group(2).strip()))

        markers.sort(key=lambda x: x[0])

        if not markers:
            return [(text.strip(), None, None)]

        results: list[tuple[str, Optional[str], Optional[str]]] = []
        current_chapter: Optional[str] = None

        # Text before the first marker
        if markers[0][0] > 0:
            prefix = text[: markers[0][0]].strip()
            if prefix:
                results.append((prefix, None, None))

        for i, (pos, kind, number, title) in enumerate(markers):
            end = markers[i + 1][0] if i + 1 < len(markers) else len(text)
            segment = text[pos:end].strip()

            if kind == "chapter":
                current_chapter = f"Chapter {number}: {title}" if title else f"Chapter {number}"
                results.append((segment, current_chapter, None))
            else:
                section_name = f"Section {number}: {title}" if title else f"Section {number}"
                results.append((segment, current_chapter, section_name))

        return results

    def _split_by_size(self, text: str) -> list[str]:
        paragraphs = re.split(r"\n\s*\n", text)
        chunks: list[str] = []
        current = ""

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(current) + len(para) + 2 > self.chunk_size and current:
                chunks.append(current.strip())
                overlap = current[-self.chunk_overlap :] if len(current) > self.chunk_overlap else current
                current = overlap + "\n\n" + para
            else:
                current = (current + "\n\n" + para) if current else para

        if current.strip():
            chunks.append(current.strip())

        return chunks if chunks else self._force_split(text)

    def _force_split(self, text: str) -> list[str]:
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks: list[str] = []
        current = ""

        for sentence in sentences:
            if len(current) + len(sentence) + 1 > self.chunk_size and current:
                chunks.append(current.strip())
                overlap = current[-self.chunk_overlap :] if len(current) > self.chunk_overlap else current
                current = overlap + " " + sentence
            else:
                current = (current + " " + sentence) if current else sentence

        if current.strip():
            chunks.append(current.strip())

        return chunks if chunks else [text]
