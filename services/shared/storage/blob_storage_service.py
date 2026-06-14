class BlobStorageService:
    def save_blob(self, container: str, blob_name: str, data: str):
        # Current AWS implementation: Local file storage
        # Future Azure implementation: Azure Blob Storage
        with open(f"/tmp/{blob_name}", "w") as f:
            f.write(data)
