"""Test environment bootstrap for pytest.

This module is automatically imported by Python when present on the import
path. It ensures the Django project and settings are available before pytest
and its plugins are initialized.
"""

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "backend" / "django-tenant-users"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_test_app.settings")
