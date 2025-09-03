from django.core.files.storage import FileSystemStorage

class PrivateDocumentStorage(FileSystemStorage):
    def __init__(self, *args, **kwargs):
        super().__init__(
            location='/var/privado_documentos/',
            base_url=None,
            *args,
            **kwargs
        )
