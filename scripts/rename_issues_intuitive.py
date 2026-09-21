#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para renombrar los títulos de los work items en GitHub y en el archivo
de propuesta a nombres mucho más intuitivos, claros y orientados a resultados.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

# Soporte completo UTF-8 para consola Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Diccionario de títulos intuitivos mapeados por ID de tarjeta
INTUITIVE_TITLES = {
    "INF-01": "Configurar repositorios, control de versiones y entorno local Docker",
    "CTR-01": "Definir contratos de comunicación entre Backend, Frontend y ML",
    "ML-01": "Descargar, validar y analizar exploratoriamente el dataset (EDA)",
    "BE-01": "Configurar base de datos relacional y esquema inicial con Flyway",
    "FE-01": "Crear estructura base, diseño visual y navegación del Frontend",
    "FE-02": "Configurar simulación de datos (Mocks) para desarrollo independiente",
    "ML-02": "Limpiar y transformar datos con división temporal sin fuga de información",
    "ML-03": "Crear variables predictivas de comportamiento y velocidad transaccional",
    "ML-04": "Entrenar modelo base de referencia y calibrar métricas de costo",
    "ML-05": "Entrenar modelo principal LightGBM y optimizar umbrales de decisión",
    "BE-02": "Implementar inicio de sesión seguro con JWT y control de roles",
    "BE-03": "Crear endpoints para registrar y consultar transacciones con filtros",
    "FE-03": "Diseñar componentes visuales reutilizables de riesgo y métricas",
    "FE-04": "Crear el panel principal (Dashboard) con KPIs y gráficos de tendencia",
    "FE-05": "Construir el explorador de transacciones con búsqueda y paginación",
    "ML-06": "Construir perfiles históricos y calcular desviaciones del usuario",
    "ML-07": "Calcular el nivel de riesgo consolidado combinando modelos y reglas",
    "ML-08": "Exponer microservicio de predicción de fraude en tiempo real",
    "BE-04": "Conectar el Backend con el microservicio de Machine Learning",
    "BE-05": "Orquestar el flujo de transacciones, análisis de riesgo y alertas",
    "BE-06": "Estandarizar el manejo global de errores y respuestas en la API",
    "FE-06": "Diseñar la vista de detalle de transacción y evaluación de riesgo",
    "FE-07": "Mostrar en lenguaje claro las razones que explican el fraude (Explicabilidad)",
    "ML-09": "Detectar transacciones anómalas con aprendizaje no supervisado (Isolation Forest)",
    "ML-10": "Identificar los factores más determinantes de cada predicción con SHAP",
    "BE-07": "Crear endpoints para consultar, auditar y resolver alertas de fraude",
    "BE-08": "Crear endpoint de estadísticas consolidadas para alimentar el Dashboard",
    "FE-08": "Construir el centro de gestión y resolución de alertas para analistas",
    "FE-09": "Diseñar la vista comparativa de hábitos y comportamiento del cliente",
    "QA-01": "Desarrollar la suite de pruebas unitarias e integración en todos los módulos",
    "INF-02": "Empaquetar cada servicio en imágenes Docker ligeras y optimizadas",
    "INT-01": "Integrar y levantar todo el ecosistema (Frontend, Backend, ML y BD) con Docker Compose",
    "ML-11": "Evaluar el rendimiento final de los modelos sobre datos nunca antes vistos",
    "DOC-01": "Publicar la documentación interactiva Swagger de la API Backend",
    "QA-02": "Automatizar pruebas de punta a punta (E2E) de las rutas críticas de usuario",
    "EXT-01": "Descubrir nuevos patrones y tipologías de fraude con clustering DBSCAN (Opcional)",
    "DOC-02": "Elaborar ficha técnica del modelo (Model Card), manual de despliegue y video demo",
}


def run_gh_cmd(args, check=True):
    cmd = ["gh"] + args
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"Error ejecutando {' '.join(cmd)}:\nSTDERR: {result.stderr}\nSTDOUT: {result.stdout}"
        )
    return result


def get_default_repo():
    try:
        res = subprocess.run(
            ["git", "config", "--get", "remote.origin.url"],
            capture_output=True,
            text=True,
            check=True,
        )
        url = res.stdout.strip()
        match = re.search(r"github\.com[:/]([^/]+)/([^/\.]+)", url)
        if match:
            return f"{match.group(1)}/{match.group(2)}"
    except Exception:
        pass
    return "Kaliddamon/ZeroFraudE"


def update_github_issue_titles(repo: str, dry_run: bool):
    print(f"\nConsultando issues en {repo}...")
    res = run_gh_cmd(
        ["issue", "list", "--repo", repo, "--limit", "200", "--json", "number,title", "--state", "all"]
    )
    issues = json.loads(res.stdout)

    count = 0
    for iss in issues:
        current_title = iss["title"]
        num = iss["number"]

        match = re.search(r"\[([A-Z0-9-]+)\]", current_title)
        if not match:
            continue

        card_id = match.group(1)
        if card_id in INTUITIVE_TITLES:
            new_title = f"[{card_id}] {INTUITIVE_TITLES[card_id]}"

            if current_title == new_title:
                print(f"  ⏭️  Issue #{num} ya tiene el título intuitivo: {new_title}")
                continue

            if dry_run:
                print(f"  [DRY-RUN] Issue #{num}:")
                print(f"            Actual: '{current_title}'")
                print(f"            Nuevo:  '{new_title}'")
            else:
                print(f"  -> Renombrando Issue #{num} a: '{new_title}' ...")
                run_gh_cmd(
                    ["issue", "edit", str(num), "--repo", repo, "--title", new_title]
                )
                print(f"     ✓ Actualizado.")
            count += 1

    print(f"\nTotal de issues procesados para renombre: {count}")


def update_markdown_file(file_path: Path, dry_run: bool):
    if not file_path.exists():
        print(f"Archivo no encontrado: {file_path}")
        return

    content = file_path.read_text(encoding="utf-8")
    original = content

    for card_id, intuitive_name in INTUITIVE_TITLES.items():
        # Patrón en tablas Markdown: | **ID** | Track | Título | Est. | Criterios |
        pattern = rf"(\|\s*\*\*{card_id}\*\*\s*\|\s*[^|]+\|\s*)([^|]+)(\|\s*[^|]+\|\s*[^|]+\|)"
        
        def repl(match):
            track_prefix = match.group(1)
            rest_suffix = match.group(3)
            return f"{track_prefix}{intuitive_name} {rest_suffix}"

        content = re.sub(pattern, repl, content)

    if content != original:
        if dry_run:
            print(f"[DRY-RUN] Se actualizarían los nombres en el archivo Markdown: {file_path.name}")
        else:
            file_path.write_text(content, encoding="utf-8")
            print(f"✓ Archivo Markdown actualizado: {file_path.name}")
    else:
        print(f"El archivo Markdown {file_path.name} ya estaba sincronizado.")


def main():
    parser = argparse.ArgumentParser(
        description="Renombra los work items a títulos intuitivos tanto en GitHub como en Markdown."
    )
    parser.add_argument(
        "--repo",
        type=str,
        default=None,
        help="Repositorio GitHub (ej: Kaliddamon/ZeroFraudE)",
    )
    parser.add_argument(
        "--file",
        type=str,
        default=r"C:\Users\CRIST\.gemini\antigravity-ide\brain\b0803df9-c46a-4525-ad0b-a2d2789c4280\kanban_board_proposal.md",
        help="Ruta al archivo Markdown de la propuesta Kanban",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula los cambios sin ejecutarlos",
    )

    args = parser.parse_args()
    repo = args.repo or get_default_repo()
    md_path = Path(args.file)

    print("=" * 70)
    print("ACTUALIZADOR DE TÍTULOS INTUITIVOS DE WORK ITEMS")
    print(f"Repositorio: {repo}")
    print(f"Modo:        {'DRY-RUN (Simulacion)' if args.dry_run else 'PRODUCCION (Actualizacion real)'}")
    print("=" * 70)

    # 1. Actualizar issues en GitHub
    update_github_issue_titles(repo, args.dry_run)

    # 2. Actualizar archivo Markdown de la propuesta
    update_markdown_file(md_path, args.dry_run)


if __name__ == "__main__":
    main()
