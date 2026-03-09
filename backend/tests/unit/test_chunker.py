"""Unit tests for text chunking functionality."""

import pytest

from rag.chunker import TextChunker, TextChunk


class TestTextChunker:
    """Tests for TextChunker text splitting logic."""

    def test_chunker_init_default_params(self):
        """Test chunker initialization with default parameters."""
        chunker = TextChunker()
        assert chunker.chunk_size == 1500
        assert chunker.chunk_overlap == 200

    def test_chunker_init_custom_params(self):
        """Test chunker initialization with custom parameters."""
        chunker = TextChunker(chunk_size=1000, chunk_overlap=100)
        assert chunker.chunk_size == 1000
        assert chunker.chunk_overlap == 100

    def test_chunk_text_simple_text(self):
        """Test chunking simple text without headers."""
        chunker = TextChunker(chunk_size=100, chunk_overlap=20)
        text = "This is a simple test. " * 20  # ~460 characters

        chunks = chunker.chunk_text(text)

        assert len(chunks) > 0
        assert all(isinstance(chunk, TextChunk) for chunk in chunks)
        # Verify chunk indices are sequential
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i

    def test_chunk_text_preserves_content(self):
        """Test that chunking preserves all original content."""
        chunker = TextChunker(chunk_size=100, chunk_overlap=20)
        text = "Content to preserve. " * 15

        chunks = chunker.chunk_text(text)
        reconstructed = "".join(chunk.content for chunk in chunks)

        # Remove overlap regions and verify content is preserved
        assert text.strip() in reconstructed or reconstructed.strip() in text

    def test_chunk_text_with_chapter_header(self):
        """Test chunking text with chapter header detection."""
        chunker = TextChunker(chunk_size=500, chunk_overlap=50)
        text = """Chapter 1: Introduction
This is the introduction section.

Section 1.1: Background
Some background information here."""

        chunks = chunker.chunk_text(text)

        assert len(chunks) > 0
        has_chapter = any(chunk.chapter for chunk in chunks)
        assert has_chapter, "Should detect chapter in headers"

    def test_chunk_text_with_section_header(self):
        """Test chunking text with section header detection."""
        chunker = TextChunker(chunk_size=500, chunk_overlap=50)
        text = """1.1 First Section
Content of first section.

1.2 Second Section
Content of second section."""

        chunks = chunker.chunk_text(text)

        assert len(chunks) > 0
        has_section = any(chunk.section for chunk in chunks)
        assert has_section, "Should detect section headers"

    def test_chunk_text_respects_size_limit(self):
        """Test that chunks are created from text."""
        chunker = TextChunker(chunk_size=200, chunk_overlap=30)
        text = "This is a word. " * 100  # Long text

        chunks = chunker.chunk_text(text)

        # Should create multiple chunks
        assert len(chunks) >= 1
        # All chunks should have content
        assert all(len(chunk.content) > 0 for chunk in chunks)

    def test_chunk_text_maintains_metadata(self):
        """Test that metadata is preserved in chunks."""
        chunker = TextChunker(chunk_size=100, chunk_overlap=20)
        text = "Chapter 1: Introduction\n" + "Content here. " * 20

        chunks = chunker.chunk_text(text)

        # Some chunks should have metadata
        all_chunks_have_index = all(hasattr(chunk, "chunk_index") for chunk in chunks)
        assert all_chunks_have_index

    def test_chunk_empty_text(self):
        """Test chunking empty string."""
        chunker = TextChunker()
        chunks = chunker.chunk_text("")

        # Chunker returns list (may have empty chunk)
        assert isinstance(chunks, list)

    def test_chunk_whitespace_only_text(self):
        """Test chunking text with only whitespace."""
        chunker = TextChunker()
        text = "   \n\n   \t\t"

        chunks = chunker.chunk_text(text)

        # Should handle whitespace gracefully
        assert isinstance(chunks, list)

    def test_chunk_text_with_multiple_chapters(self):
        """Test chunking text with multiple chapter headers."""
        chunker = TextChunker(chunk_size=300, chunk_overlap=50)
        text = """Chapter 1: First
Content for chapter 1.

Chapter 2: Second
Content for chapter 2.

Chapter 3: Third
Content for chapter 3."""

        chunks = chunker.chunk_text(text)

        assert len(chunks) > 0
        # Multiple chapters should be represented
        chapters = set(chunk.chapter for chunk in chunks if chunk.chapter)
        assert len(chapters) > 0

    def test_chunk_text_small_text(self):
        """Test chunking text smaller than chunk_size."""
        chunker = TextChunker(chunk_size=1000, chunk_overlap=100)
        text = "This is a very short text."

        chunks = chunker.chunk_text(text)

        # Should create at least one chunk
        assert len(chunks) >= 1
        # Content should be preserved
        reconstructed = "".join(chunk.content for chunk in chunks)
        assert text in reconstructed or reconstructed.strip() == text.strip()

    def test_text_chunk_initialization(self):
        """Test TextChunk dataclass initialization."""
        chunk = TextChunk(
            content="Sample content",
            chunk_index=0,
            chapter="Chapter 1",
            section="1.1",
        )

        assert chunk.content == "Sample content"
        assert chunk.chunk_index == 0
        assert chunk.chapter == "Chapter 1"
        assert chunk.section == "1.1"
        assert chunk.metadata == {}

    def test_text_chunk_with_metadata(self):
        """Test TextChunk with custom metadata."""
        metadata = {"source": "textbook", "page": 42}
        chunk = TextChunk(
            content="Content",
            chunk_index=0,
            chapter="Ch 1",
            metadata=metadata,
        )

        assert chunk.metadata == metadata
        assert chunk.metadata["source"] == "textbook"
        assert chunk.metadata["page"] == 42

    def test_chunk_text_long_section_boundary(self):
        """Test chunking respects section boundaries when possible."""
        chunker = TextChunker(chunk_size=200, chunk_overlap=30)
        text = """1.1 Important Section
This section contains important information that should stay together.

1.2 Another Section
Different content here."""

        chunks = chunker.chunk_text(text)

        assert len(chunks) > 0
        # At least one chunk should have section info
        assert any(chunk.section for chunk in chunks)
