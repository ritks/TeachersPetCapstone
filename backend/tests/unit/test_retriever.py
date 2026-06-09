"""
Unit tests for the RAG Retriever.

The Retriever combines embedding search with module-scoped filtering and turns
matched chunks into (prompt_string, citations). Both the embedding service and
the vector store are faked so these tests stay fast and offline.
"""

from rag.retriever import Retriever


class FakeEmbeddingService:
    def __init__(self):
        self.embedded = []

    def embed_text(self, text):
        self.embedded.append(text)
        return [0.1, 0.2, 0.3]


class FakeVectorStore:
    def __init__(self, results):
        self._results = results
        self.query_args = None

    def query(self, query_embedding, module_id=None, n_results=5):
        self.query_args = {
            "query_embedding": query_embedding,
            "module_id": module_id,
            "n_results": n_results,
        }
        return self._results


def _results(docs, metadatas, distances):
    return {"documents": [docs], "metadatas": [metadatas], "distances": [distances]}


EMPTY_RESULTS = {"documents": [[]], "metadatas": [[]], "distances": [[]]}


class TestRetrieve:
    def test_retrieve_builds_chunks_from_results(self):
        store = FakeVectorStore(
            _results(
                ["chunk one", "chunk two"],
                [{"chapter": "1"}, {"chapter": "2"}],
                [0.12, 0.34],
            )
        )
        retriever = Retriever(FakeEmbeddingService(), store)

        chunks = retriever.retrieve("what is a fraction?", module_id="mod-1")

        assert len(chunks) == 2
        assert chunks[0]["content"] == "chunk one"
        assert chunks[0]["metadata"] == {"chapter": "1"}
        assert chunks[0]["distance"] == 0.12

    def test_retrieve_empty_results_returns_empty_list(self):
        retriever = Retriever(FakeEmbeddingService(), FakeVectorStore(EMPTY_RESULTS))
        assert retriever.retrieve("anything", module_id="mod-1") == []

    def test_retrieve_passes_module_filter_and_default_top_k(self):
        store = FakeVectorStore(EMPTY_RESULTS)
        retriever = Retriever(FakeEmbeddingService(), store, top_k=5)

        retriever.retrieve("q", module_id="mod-9")

        assert store.query_args["module_id"] == "mod-9"
        assert store.query_args["n_results"] == 5

    def test_retrieve_top_k_override(self):
        store = FakeVectorStore(EMPTY_RESULTS)
        retriever = Retriever(FakeEmbeddingService(), store, top_k=5)

        retriever.retrieve("q", module_id="mod-1", top_k=2)

        assert store.query_args["n_results"] == 2

    def test_retrieve_embeds_the_query(self):
        embedder = FakeEmbeddingService()
        retriever = Retriever(embedder, FakeVectorStore(EMPTY_RESULTS))

        retriever.retrieve("explain ratios")

        assert embedder.embedded == ["explain ratios"]


class TestBuildContext:
    def test_no_chunks_with_module_name_returns_scope_prompt(self):
        retriever = Retriever(FakeEmbeddingService(), FakeVectorStore(EMPTY_RESULTS))

        prompt, citations = retriever.build_context(
            query="hi", module_id="mod-1", module_name="Fractions"
        )

        assert citations == []
        assert "Fractions" in prompt
        # No textbook material when there are no chunks.
        assert "textbook reference material" not in prompt

    def test_no_chunks_no_module_name_returns_empty(self):
        retriever = Retriever(FakeEmbeddingService(), FakeVectorStore(EMPTY_RESULTS))

        prompt, citations = retriever.build_context(query="hi")

        assert prompt == ""
        assert citations == []

    def test_with_chunks_builds_citations(self):
        store = FakeVectorStore(
            _results(
                ["Fractions represent parts of a whole."],
                [{
                    "document_id": "doc-1",
                    "chapter": "Chapter 1",
                    "section": "1.2",
                    "page_start": 4,
                    "page_end": 5,
                }],
                [0.1],
            )
        )
        retriever = Retriever(FakeEmbeddingService(), store)

        prompt, citations = retriever.build_context(
            query="fractions", module_id="mod-1", module_name="Fractions"
        )

        assert len(citations) == 1
        c = citations[0]
        assert c["ref"] == 1
        assert c["document_id"] == "doc-1"
        assert c["chapter"] == "Chapter 1"
        assert c["section"] == "1.2"
        assert c["page_start"] == 4
        assert c["snippet"] == "Fractions represent parts of a whole."
        # References are embedded into the module-scope prompt.
        assert "Fractions represent parts of a whole." in prompt
        assert "textbook reference material" in prompt

    def test_with_chunks_generic_prompt_without_module_name(self):
        store = FakeVectorStore(
            _results(["some content"], [{"document_id": "doc-1"}], [0.2])
        )
        retriever = Retriever(FakeEmbeddingService(), store)

        prompt, citations = retriever.build_context(query="q")

        assert len(citations) == 1
        assert "Use the following textbook reference material" in prompt
        # Generic prompt is not the module-scope teaching prompt.
        assert "You are currently teaching the module" not in prompt

    def test_citation_snippet_truncated_to_200_chars(self):
        long_text = "x" * 500
        store = FakeVectorStore(_results([long_text], [{"document_id": "d"}], [0.1]))
        retriever = Retriever(FakeEmbeddingService(), store)

        _, citations = retriever.build_context(query="q")

        assert len(citations[0]["snippet"]) == 200