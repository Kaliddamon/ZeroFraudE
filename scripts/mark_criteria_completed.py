#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para marcar como finalizados ([x]) los criterios de aceptacion
de los work items que estan en 'Done' y 'Review'.
"""

import argparse
import json
import re
import subprocess
import sys

# Soporte completo UTF-8 para consola Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Tarjetas segun auditoria
DONE_CARDS = {
    "CTR-01": 2,
    "ML-02": 7,
    "ML-03": 8,
    "ML-06": 16,
    "ML-07": 17,
    "ML-08": 18,
}

REVIEW_CARDS = {
    "BE-01": 4,
    "ML-04": 9,
    "ML-05": 10,
    "BE-02": 11,
    "BE-03": 12,
    "BE-04": 19,
    "BE-05": 20,
    "BE-06": 21,
    "ML-09": 24,
    "ML-10": 25,
    "BE-07": 26,
    "BE-08": 27,
    "DOC-01": 34,
}


def run_gh_cmd(args, input_data=None, check=True):
    cmd = ["gh"] + args
    result = subprocess.run(
        cmd,
        input=input_data,
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


def mark_criteria_in_body(body: str) -> tuple[str, int]:
    """Reemplaza '- [ ]' por '- [x]' en el cuerpo del issue."""
    matches = len(re.findall(r"-\s*\[\s*\]", body))
    new_body = re.sub(r"-\s*\[\s*\]", "- [x]", body)
    return new_body, matches


def process_group(repo: str, group_name: str, cards: dict, dry_run: bool):
    print(f"\nProcesando grupo: {group_name} ({len(cards)} tarjetas)")
    total_marked = 0

    for card_id, issue_num in cards.items():
        res = run_gh_cmd(
            ["issue", "view", str(issue_num), "--repo", repo, "--json", "title,body"]
        )
        data = json.loads(res.stdout)
        title = data["title"]
        body = data["body"]

        new_body, count = mark_criteria_in_body(body)

        if count == 0:
            print(f"  ⏭️  Issue #{issue_num} ({card_id}): ya tenia todos sus criterios marcados.")
            continue

        if dry_run:
            print(f"  [DRY-RUN] Issue #{issue_num} ({card_id}) '{title}':")
            print(f"            Se marcarian {count} criterios como [x].")
        else:
            print(f"  -> Actualizando Issue #{issue_num} ({card_id}) '{title}' ({count} criterios) ...")
            run_gh_cmd(
                ["issue", "edit", str(issue_num), "--repo", repo, "--body-file", "-"],
                input_data=new_body,
            )
            print(f"     ✓ Actualizado exitosamente.")

        total_marked += count

    print(f"Total de criterios marcados en {group_name}: {total_marked}")


def main():
    parser = argparse.ArgumentParser(
        description="Marca como finalizados (- [x]) los criterios de aceptacion de issues en Review y Done."
    )
    parser.add_argument(
        "--repo",
        type=str,
        default=None,
        help="Repositorio GitHub (ej: Kaliddamon/ZeroFraudE)",
    )
    parser.add_argument(
        "--group",
        choices=["all", "done", "review"],
        default="all",
        help="Grupo a actualizar: 'all', 'done', o 'review' (por defecto 'all')",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Muestra que se modificaria sin cambiar nada en GitHub",
    )

    args = parser.parse_args()
    repo = args.repo or get_default_repo()

    print("=" * 70)
    print("FINALIZADOR DE CRITERIOS DE ACEPTACION (Review y Done)")
    print(f"Repositorio: {repo}")
    print(f"Grupo:       {args.group.upper()}")
    print(f"Modo:        {'DRY-RUN (Simulacion)' if args.dry_run else 'PRODUCCION (Actualizacion real)'}")
    print("=" * 70)

    if args.group in ["all", "done"]:
        process_group(repo, "DONE (6 tarjetas verificadas)", DONE_CARDS, args.dry_run)

    if args.group in ["all", "review"]:
        process_group(repo, "REVIEW (13 tarjetas con codigo listo)", REVIEW_CARDS, args.dry_run)


if __name__ == "__main__":
    main()
