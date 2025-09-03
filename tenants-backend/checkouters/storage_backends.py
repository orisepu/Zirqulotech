import os
from django.conf import settings
from django.core.files.storage import FileSystemStorage

class PrivateFileSystemStorage(FileSystemStorage):
    def __init__(self, *args, **kwargs):
        location = kwargs.pop("location", settings.PRIVATE_MEDIA_ROOT)
        super().__init__(location=location, base_url=None)

    def url(self, name):  # bloquear URLs públicas
        raise NotImplementedError("Private storage: no public URL.")
