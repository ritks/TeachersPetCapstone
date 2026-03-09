"""
Integration tests for module CRUD API endpoints.

Tests verify:
- Module creation, retrieval, update, deletion (CRUD)
- Document upload and listing
- Error handling (404, validation errors)

These tests use an isolated temp database and mocked google.genai
to avoid external dependencies.
"""

import pytest


class TestModuleCRUD:
    """Tests for module creation, reads, updates, and deletion."""
    
    def test_create_chapter_modules(self, client, sample_chapters):
        """
        Test: Create a module for each chapter.
        Verify: Each module is created with correct metadata.
        """
        created_ids = []
        
        for chapter in sample_chapters:
            resp = client.post("/modules", json=chapter)
            assert resp.status_code == 200, f"Failed to create {chapter['name']}: {resp.text}"
            
            data = resp.json()
            assert data["name"] == chapter["name"]
            assert data["description"] == chapter["description"]
            assert data["grade_level"] == chapter["grade_level"]
            assert data["topics"] == chapter["topics"]
            assert data["document_count"] == 0
            assert data["chunk_count"] == 0
            assert data["id"]  # UUID generated
            
            created_ids.append(data["id"])
        
        # Verify all IDs are unique
        assert len(set(created_ids)) == len(sample_chapters)
    
    def test_list_modules_returns_all(self, client, sample_chapters):
        """
        Test: Create modules and list them.
        Verify: All modules appear in the list.
        """
        # Create chapters
        for chapter in sample_chapters:
            client.post("/modules", json=chapter)
        
        # List and verify
        resp = client.get("/modules")
        assert resp.status_code == 200
        
        modules = resp.json()
        names = [m["name"] for m in modules]
        
        for chapter in sample_chapters:
            assert chapter["name"] in names, f"Missing: {chapter['name']}"
    
    def test_get_module_by_id(self, client, sample_chapters):
        """
        Test: Create a module, then retrieve it by ID.
        Verify: Retrieved data matches created data.
        """
        # Create first chapter
        chapter = sample_chapters[0]
        create_resp = client.post("/modules", json=chapter)
        module_id = create_resp.json()["id"]
        
        # Retrieve by ID
        get_resp = client.get(f"/modules/{module_id}")
        assert get_resp.status_code == 200
        
        data = get_resp.json()
        assert data["id"] == module_id
        assert data["name"] == chapter["name"]
        assert data["grade_level"] == chapter["grade_level"]
    
    def test_update_module_description(self, client, sample_chapters):
        """
        Test: Create a module, then update its description.
        Verify: Only the description changes; other fields remain.
        """
        # Create module
        chapter = sample_chapters[0]
        create_resp = client.post("/modules", json=chapter)
        module_id = create_resp.json()["id"]
        
        # Update description
        new_desc = "Updated description for testing."
        update_resp = client.put(
            f"/modules/{module_id}",
            json={"description": new_desc}
        )
        assert update_resp.status_code == 200
        
        data = update_resp.json()
        assert data["description"] == new_desc
        assert data["name"] == chapter["name"]  # Other fields unchanged
        assert data["grade_level"] == chapter["grade_level"]
    
    def test_get_nonexistent_module_returns_404(self, client):
        """
        Test: Request a module that doesn't exist.
        Verify: API returns 404 Not Found.
        """
        resp = client.get("/modules/nonexistent-id-12345")
        assert resp.status_code == 404
    
    def test_delete_module(self, client, sample_chapters):
        """
        Test: Create a module, delete it, then try to retrieve it.
        Verify: Delete returns success; subsequent GET returns 404.
        """
        # Create module
        chapter = sample_chapters[0]
        create_resp = client.post("/modules", json=chapter)
        module_id = create_resp.json()["id"]
        
        # Delete
        delete_resp = client.delete(f"/modules/{module_id}")
        assert delete_resp.status_code == 200
        assert "deleted" in delete_resp.json()["message"].lower()
        
        # Verify it's gone
        get_resp = client.get(f"/modules/{module_id}")
        assert get_resp.status_code == 404


class TestDocumentUpload:
    """Tests for document upload and listing."""
    
    def test_upload_text_to_module(self, client, sample_chapters, sample_text):
        """
        Test: Create a module, upload text document to it.
        Verify: Document is created with correct metadata.
        """
        # Create module
        chapter = sample_chapters[0]
        module_resp = client.post("/modules", json=chapter)
        module_id = module_resp.json()["id"]
        
        # Upload text
        upload_resp = client.post(
            f"/modules/{module_id}/documents/text",
            json={
                "text": sample_text,
                "filename": "chapter1_notes.txt"
            }
        )
        assert upload_resp.status_code == 200
        
        data = upload_resp.json()
        assert data["original_filename"] == "chapter1_notes.txt"
        assert data["status"] == "uploaded"
        assert data["module_id"] == module_id
        assert data["id"]  # UUID generated
    
    def test_list_documents_in_module(self, client, sample_chapters, sample_text):
        """
        Test: Create module, upload document, list documents.
        Verify: Document appears in the list with correct count.
        """
        # Create module
        chapter = sample_chapters[0]
        module_resp = client.post("/modules", json=chapter)
        module_id = module_resp.json()["id"]
        
        # Upload document
        client.post(
            f"/modules/{module_id}/documents/text",
            json={"text": sample_text, "filename": "test.txt"}
        )
        
        # List documents
        list_resp = client.get(f"/modules/{module_id}/documents")
        assert list_resp.status_code == 200
        
        docs = list_resp.json()
        assert len(docs) == 1
        assert docs[0]["original_filename"] == "test.txt"
    
    def test_list_documents_empty_module(self, client, sample_chapters):
        """
        Test: Create module without documents, try to list.
        Verify: Returns empty list (not error).
        """
        # Create module
        chapter = sample_chapters[0]
        module_resp = client.post("/modules", json=chapter)
        module_id = module_resp.json()["id"]
        
        # List documents (should be empty)
        list_resp = client.get(f"/modules/{module_id}/documents")
        assert list_resp.status_code == 200
        
        docs = list_resp.json()
        assert len(docs) == 0


class TestIntegrationScenarios:
    """Integration tests covering multi-step workflows."""
    
    def test_full_module_creation_and_deletion_workflow(
        self, client, sample_chapters
    ):
        """
        Test: Create 3 chapters, delete one, verify remaining count.
        Verify: Correct state after each operation.
        """
        # Create 3 chapters
        created_ids = []
        for chapter in sample_chapters:
            resp = client.post("/modules", json=chapter)
            created_ids.append(resp.json()["id"])
        
        # Verify all 3 exist
        list_resp = client.get("/modules")
        assert len(list_resp.json()) == 3
        
        # Delete the third chapter
        delete_resp = client.delete(f"/modules/{created_ids[2]}")
        assert delete_resp.status_code == 200
        
        # Verify only 2 remain
        list_resp = client.get("/modules")
        remaining = list_resp.json()
        assert len(remaining) == 2
        assert all(m["name"] != sample_chapters[2]["name"] for m in remaining)
