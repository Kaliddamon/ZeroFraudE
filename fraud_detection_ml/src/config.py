"""
src/config.py
=============
Carga centralizada de configuración desde configs/pipeline.yaml,
configs/thresholds.json y configs/risk_fusion.yaml.

Todas las constantes del pipeline se acceden a través de este módulo.
Nunca usar rutas o valores hardcodeados en el código fuente.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

# ── Rutas base ────────────────────────────────────────────────────────────────
# ROOT apunta a fraud_detection_ml/ sin importar desde dónde se ejecute el script
ROOT = Path(__file__).resolve().parent.parent
CONFIGS_DIR = ROOT / "configs"
ARTIFACTS_DIR = ROOT / "artifacts"
DATA_DIR = ROOT / "data"
EXPERIMENTS_DIR = ROOT / "experiments"


# ── Carga de archivos ──────────────────────────────────────────────────────────

def _load_yaml(path: Path) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _load_json(path: Path) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Dataclasses de configuración ───────────────────────────────────────────────

@dataclass
class DataConfig:
    train_end_date: Optional[str] = None
    val_end_date: Optional[str] = None


@dataclass
class FeaturesConfig:
    behavioral_window_days: int
    cold_start_min_transactions: int
    velocity_windows_minutes: List[int]
    model_features: List[str]


@dataclass
class ModelConfig:
    n_estimators: int
    learning_rate: float
    num_leaves: int
    min_child_samples: int
    colsample_bytree: float
    early_stopping_rounds: int
    scale_pos_weight_mode: str = "sqrt"
    scale_pos_weight: Optional[float] = None
    subsample: float = 0.8
    subsample_freq: int = 1
    reg_alpha: float = 0.1
    reg_lambda: float = 1.0
    max_depth: int = -1


@dataclass
class AnomalyConfig:
    contamination: float
    n_estimators: int
    max_samples: Any


@dataclass
class EvaluationConfig:
    cost_fp: float
    cost_fn: float


@dataclass
class ThresholdsConfig:
    version: str
    critical: float
    high: float
    medium: float
    last_tuned: str
    validation_pr_auc: float | None
    notes: str = ""


@dataclass
class RiskFusionWeights:
    fraud_probability: float
    anomaly_score: float
    behavioral_deviation: float


@dataclass
class RiskFusionConfig:
    weights: RiskFusionWeights
    cold_start_weights: RiskFusionWeights


@dataclass
class PipelineConfig:
    seed: int
    model_version: str
    data: DataConfig
    features: FeaturesConfig
    model: ModelConfig
    anomaly: AnomalyConfig
    evaluation: EvaluationConfig
    thresholds: ThresholdsConfig
    risk_fusion: RiskFusionConfig


# ── Función de carga principal ─────────────────────────────────────────────────

def load_config(
    pipeline_yaml: Path | None = None,
    thresholds_json: Path | None = None,
    risk_fusion_yaml: Path | None = None,
) -> PipelineConfig:
    """
    Carga y combina toda la configuración del pipeline.

    Parameters
    ----------
    pipeline_yaml : Path, optional
        Ruta al archivo pipeline.yaml. Por defecto: configs/pipeline.yaml
    thresholds_json : Path, optional
        Ruta al archivo thresholds.json. Por defecto: configs/thresholds.json
    risk_fusion_yaml : Path, optional
        Ruta al archivo risk_fusion.yaml. Por defecto: configs/risk_fusion.yaml

    Returns
    -------
    PipelineConfig
        Objeto de configuración completo y validado.
    """
    pipeline_yaml = pipeline_yaml or CONFIGS_DIR / "pipeline.yaml"
    thresholds_json = thresholds_json or CONFIGS_DIR / "thresholds.json"
    risk_fusion_yaml = risk_fusion_yaml or CONFIGS_DIR / "risk_fusion.yaml"

    raw_pipeline = _load_yaml(pipeline_yaml)
    raw_thresholds = _load_json(thresholds_json)
    raw_risk_fusion = _load_yaml(risk_fusion_yaml)

    data_cfg = DataConfig(**raw_pipeline["data"])
    features_cfg = FeaturesConfig(**raw_pipeline["features"])
    model_cfg = ModelConfig(**raw_pipeline["model"])
    anomaly_cfg = AnomalyConfig(**raw_pipeline["anomaly"])
    eval_cfg = EvaluationConfig(**raw_pipeline["evaluation"])

    thresholds_cfg = ThresholdsConfig(**raw_thresholds)

    risk_fusion_cfg = RiskFusionConfig(
        weights=RiskFusionWeights(**raw_risk_fusion["weights"]),
        cold_start_weights=RiskFusionWeights(**raw_risk_fusion["cold_start_weights"]),
    )

    return PipelineConfig(
        seed=raw_pipeline["seed"],
        model_version=raw_pipeline["model_version"],
        data=data_cfg,
        features=features_cfg,
        model=model_cfg,
        anomaly=anomaly_cfg,
        evaluation=eval_cfg,
        thresholds=thresholds_cfg,
        risk_fusion=risk_fusion_cfg,
    )


# ── Instancia global (singleton) ───────────────────────────────────────────────
# Se carga una vez y se importa desde cualquier módulo.
# En tests puede sobreescribirse con load_config(custom_paths).

try:
    CONFIG: PipelineConfig = load_config()
except FileNotFoundError as e:
    # Permite importar el módulo incluso si los configs no están presentes
    # (útil en entornos CI donde los paths pueden variar)
    import warnings
    warnings.warn(f"Config files not found: {e}. CONFIG not initialized.", stacklevel=2)
    CONFIG = None  # type: ignore
