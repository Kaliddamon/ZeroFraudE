import argparse
import hashlib
import json
from pathlib import Path

import pandas as pd

def calculate_md5(file_path: Path) -> str:
    """Calcula el hash MD5 de un archivo."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def validate_schema(df: pd.DataFrame) -> bool:
    """Valida el esquema del dataset raw."""
    expected_columns = {
        "transaction_id", "user_id", "amount", "timestamp",
        "country", "device_id", "merchant_id", "is_fraud"
    }
    missing = expected_columns - set(df.columns)
    if missing:
        print(f"Error: Faltan columnas en el dataset: {missing}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Load and validate dataset")
    parser.add_argument("--input", type=str, required=True, help="Ruta al CSV raw")
    args = parser.parse_args()

    input_path = Path(args.input)
    
    if not input_path.exists():
        print(f"El archivo {input_path} no existe.")
        return

    # 1. Calcular y guardar MD5
    md5_hash = calculate_md5(input_path)
    hash_path = input_path.with_suffix(".csv.md5")
    hash_path.write_text(md5_hash)
    print(f"[*] MD5 hash generado: {md5_hash}")

    # 2. Cargar y validar
    print("[*] Cargando dataset...")
    df = pd.read_csv(input_path)
    
    if validate_schema(df):
        print(f"[*] Esquema validado exitosamente. Total registros: {len(df):,}")
        
        # 3. Guardar metadatos
        meta_path = input_path.parent / "metadata.json"
        metadata = {
            "rows": len(df),
            "columns": list(df.columns),
            "fraud_rate": float(df["is_fraud"].mean()),
            "date_range": [df["timestamp"].min(), df["timestamp"].max()],
            "md5": md5_hash
        }
        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=4)
        print(f"[*] Metadatos guardados en {meta_path}")

if __name__ == "__main__":
    main()
