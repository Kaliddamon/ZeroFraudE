"""
tests/conftest.py
==================
Configuración global de pytest.
Añade el directorio raíz del proyecto al sys.path.
"""

import sys
from pathlib import Path

# Permitir imports como `from src.xxx import ...` desde los tests
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
