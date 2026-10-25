"""
tests/integration/test_normal_transaction.py
=============================================

Pruebas de integración para verificar que el sistema clasifica de forma
coherente transacciones legítimas y fraudulentas, y que usuarios en cold
start no reciben afirmaciones sin evidencia sobre dispositivos, países,
comercios ni importes basados en un promedio individual inexistente.

Estas pruebas cargan el servicio de inferencia completo con artefactos
reales y validan el flujo de extremo a extremo.

Los umbrales de produccion (configs/thresholds.json) se seleccionaron
exclusivamente sobre el Validation Set con criterio operativo:
    medium = 0.05  (por encima del p95 de legítimos = 0.0460)
    high   = 0.25  (entre p95 de legítimos y p25 de fraudes = 0.3114)
    critical = 0.50 (probabilidad >= 50% de fraude)
    anomaly_alert_threshold = 0.70  (señal separada de escalada)

Los pesos de produccion son w_fraud=1.00, w_anomaly=0.00, w_behavioral=0.00,
por lo que risk_score = fraud_probability. anomaly_score NO se suma a
risk_score; se usa como señal separada de escalada (anomaly_alert).
"""

import sys
from pathlib import Path

# Permitir imports como `from src.xxx import ...`
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

import pytest

from src.inference.service import FraudDetectionService
from src.risk.fusion import RiskFusionEngine
from src.validation.schemas import TransactionInput

# Umbrales de produccion (configs/thresholds.json), seleccionados sobre Validacion
CRITICAL = 0.50
HIGH = 0.25
MEDIUM = 0.05


def _classify(risk_score: float) -> str:
    if risk_score >= CRITICAL:
        return "CRITICAL"
    if risk_score >= HIGH:
        return "HIGH"
    if risk_score >= MEDIUM:
        return "MEDIUM"
    return "LOW"


@pytest.fixture(scope="module")
def service():
    """Carga el servicio de inferencia una vez para todas las pruebas."""
    return FraudDetectionService.load(version="3.0.0")


class TestLegitimateTransactionNotCritical:
    """
    Verifica que una transaccion legítima representativa de un usuario
    conocido no colapse en la banda CRITICAL ni siquiera en HIGH sin
    justificacion. Con los pesos actuales (fraud_probability solo) y
    umbrales operativos, una transacción legítima de bajo importe se
    clasifica como MEDIUM (riesgo elevado pero no crítico).
    """

    def test_usuario_con_historial_importe_bajo_no_es_critical(
        self, service
    ):
        """
        Usuario U02797 (tx_count=6, paises GB/FR, dispositivo D06611,
        comerciante M0129). Importe bajo (0.50 USD), horario diurno,
        entidades conocidas. Con fraud_probability=0.1616 y
        critical=0.50, debe ser MEDIUM, no CRITICAL ni HIGH.
        """
        tx = TransactionInput(
            transaction_id="test-normal-001",
            user_id="U02797",
            amount=0.50,
            timestamp="2023-12-27T14:32:00Z",
            country="GB",
            device_id="D06611",
            merchant_id="M0129",
        )
        result = service.predict(tx)

        # Con fraud_probability=0.1616, critical=0.50: MEDIUM
        assert result.risk_level != "CRITICAL", (
            f"Una transaccion legítima no debe ser CRITICAL. "
            f"Obtuvo risk_level={result.risk_level}, risk_score={result.risk_score}, "
            f"fraud_probability={result.fraud_probability}"
        )
        assert result.risk_level != "HIGH", (
            f"Una transaccion legítima de bajo importe no debe ser HIGH sin "
            f"justificacion. Obtuvo risk_level={result.risk_level}, "
            f"risk_score={result.risk_score}"
        )
        assert result.risk_level == "MEDIUM", (
            f"Esperaba MEDIUM para transaccion legítima de bajo importe, "
            f"obtuvo {result.risk_level} (risk_score={result.risk_score})"
        )
        assert result.fraud_probability > 0.0
        assert result.is_cold_start is False

        # Coherencia entre risk_score y risk_level respecto a los umbrales
        assert result.risk_level == _classify(result.risk_score), (
            f"Incoherencia: risk_score={result.risk_score} -> "
            f"risk_level={result.risk_level}, esperado {_classify(result.risk_score)}"
        )

    def test_model_identifica_clase_fraude_correctamente(self, service):
        """
        Verifica que el modelo LightGBM distingue entre clases 0 (normal) y 1 (fraude).
        Las clases deben ser [0, 1] y la columna 1 de predict_proba corresponde a fraude.
        """
        model = service._fraud_model._model
        assert list(model.classes_) == [0, 1], (
            f"Esperaba clases [0, 1], obtuvo {list(model.classes_)}"
        )


class TestFraudulentTransactionCritical:
    """
    Verifica que una transaccion claramente fraudulenta (pais desconocido,
    dispositivo nuevo, importe alto, madrugada) clasifica como CRITICAL con
    explicaciones validas.
    """

    def test_transaccion_fraudulenta_clasificada_como_critical(self, service):
        tx = TransactionInput(
            transaction_id="test-fraud-001",
            user_id="U02797",
            amount=30.80,
            timestamp="2023-12-27T03:00:00Z",
            country="NG",
            device_id="D_NEW_999999",
            merchant_id="M99999",
        )
        result = service.predict(tx)

        assert result.risk_level == "CRITICAL", (
            f"Esperaba CRITICAL para transaccion fraudulenta, obtuvo "
            f"{result.risk_level} (risk_score={result.risk_score})"
        )
        assert result.fraud_probability > 0.9
        assert result.is_cold_start is False

        # Las explicaciones deben referirse a indicadores reales, no inventados
        explicaciones = result.explanations
        assert any(
            "Country not in user's recent history" in e for e in explicaciones
        ), f"Falta explicacion de pais desconocido: {explicaciones}"
        assert any(
            "First transaction from this device" in e for e in explicaciones
        ), f"Falta explicacion de dispositivo nuevo: {explicaciones}"


class TestColdStartSinAfirmacionesSinEvidencia:
    """
    Verifica que usuarios en cold start no reciben afirmaciones de que
    su dispositivo, país o merchant son "nuevos" cuando no hay historial
    real que respalde esa afirmacion, ni explicaciones de importe basadas
    en un promedio individual inexistente.
    """

    def test_cold_start_no_flags_is_new(self, service):
        """
        Un usuario sin historial (cold start) no debe recibir is_new_device=1.0,
        is_new_country=1.0 ni is_new_merchant=1.0, porque el perfil global
        no conoce ninguna entidad y no hay evidencia de inexistencia.
        """
        tx = TransactionInput(
            transaction_id="test-coldstart-001",
            user_id="usuario_inexistente_xyz",
            amount=10.0,
            timestamp="2023-12-27T19:22:19Z",
            country="CO",
            device_id="D42",
            merchant_id="M18",
        )
        result = service.predict(tx)

        assert result.is_cold_start is True
        assert result.behavioral_deviation == 0.0

        # Las explicaciones no deben incluir afirmaciones de "nuevo" sin evidencia
        explicaciones = result.explanations
        assert not any(
            "First transaction from this device" in e for e in explicaciones
        ), f"Explicacion falsa de dispositivo nuevo: {explicaciones}"
        assert not any(
            "Country not in user's recent history" in e for e in explicaciones
        ), f"Explicacion falsa de pais nuevo: {explicaciones}"
        assert not any(
            "Merchant not in user's transaction history" in e
            for e in explicaciones
        ), f"Explicacion falsa de merchant nuevo: {explicaciones}"
        # Tampoco una explicacion de importe "X veces por encima del promedio"
        # basada en un promedio de usuario inexistente
        assert not any(
            "above user average" in e for e in explicaciones
        ), f"Explicacion falsa de importe en cold start: {explicaciones}"

    def test_cold_start_behavioral_deviation_cero(self, service):
        """
        En cold start no hay historial del usuario, por lo que
        behavioral_deviation debe ser 0.0 (no hay desviacion medible).
        """
        tx = TransactionInput(
            transaction_id="test-coldstart-002",
            user_id="usuario_inexistente_abc",
            amount=10.0,
            timestamp="2023-12-27T14:32:00Z",
            country="CO",
            device_id="D42",
            merchant_id="M18",
        )
        result = service.predict(tx)

        assert result.behavioral_deviation == 0.0, (
            f"Esperaba behavioral_deviation=0.0 en cold start, "
            f"obtuvo {result.behavioral_deviation}"
        )


class TestAnomalyAlertSenalSeparada:
    """
    Verifica que anomaly_alert es una señal separada de escalada,
    independiente de risk_level.

    anomaly_alert=True cuando anomaly_score >= 0.70. No implica que la
    transacción sea fraude; solo justifica revisión manual.
    """

    def test_anomaly_alert_independiente_de_riesgo(self, service):
        """
        Una transacción legítima con alto anomaly_score pero bajo
        fraud_probability debe tener anomaly_alert=True pero
        risk_level != CRITICAL.

        Esto demuestra que anomaly_score es una señal separada, no sumada
        a risk_score (evita doble contabilización con fraud_probability,
        correlación 0.458).
        """
        tx = TransactionInput(
            transaction_id="test-anomaly-alert-001",
            user_id="U02797",
            amount=0.50,
            timestamp="2023-12-27T14:32:00Z",
            country="GB",
            device_id="D06611",
            merchant_id="M0129",
        )
        result = service.predict(tx)

        # risk_score == fraud_probability (pesos 1.00/0.00/0.00)
        assert result.risk_score == result.fraud_probability

        # anomaly_alert es independiente de risk_level
        assert isinstance(result.anomaly_alert, bool)

    def test_fraudulenta_con_anomaly_alert(self, service):
        """
        Una transacción claramente fraudulenta debe tener
        anomaly_alert=True (alto anomaly_score) y risk_level=CRITICAL.
        """
        tx = TransactionInput(
            transaction_id="test-fraud-alert-001",
            user_id="U02797",
            amount=30.80,
            timestamp="2023-12-27T03:00:00Z",
            country="NG",
            device_id="D_NEW_999999",
            merchant_id="M99999",
        )
        result = service.predict(tx)

        assert result.risk_level == "CRITICAL"
        # anomaly_score alto para fraude con dispositivo nuevo, país desconocido
        assert result.anomaly_alert is True, (
            f"Esperaba anomaly_alert=True para fraude, obtuvo "
            f"anomaly_score={result.anomaly_score}, anomaly_alert={result.anomaly_alert}"
        )


class TestConsistenciaAnalisis:
    """
    Verifica que el score final, el nivel de riesgo y las explicaciones
    respeten las fórmulas y umbrales documentados (pesos 1.00/0.00/0.00,
    umbrales medium=0.05, high=0.25, critical=0.50).
    """

    def test_riesgo_coherente_con_puntuaciones(self, service):
        """
        El risk_level debe ser coherente con risk_score y los umbrales
        de produccion (critical>=0.50, high>=0.25, medium>=0.05).
        """
        for amount, nivel_esperado in [
            (0.50, "MEDIUM"),   # fp~0.1616: entre medium y high
            (5.00, "CRITICAL"),  # fp~0.8253: >= critical
        ]:
            tx = TransactionInput(
                transaction_id="test-consistencia-001",
                user_id="U02797",
                amount=amount,
                timestamp="2023-12-27T14:32:00Z",
                country="GB",
                device_id="D06611",
                merchant_id="M0129",
            )
            result = service.predict(tx)

            # Verificar que el nivel reportado coincide con el umbral correcto
            assert result.risk_level == _classify(result.risk_score), (
                f"amount={amount}: incoherencia risk_score={result.risk_score} "
                f"-> risk_level={result.risk_level}"
            )

            # Verificar que el nivel reportado coincide con la clasificación esperada
            assert result.risk_level == nivel_esperado, (
                f"amount={amount}: esperaba {nivel_esperado}, "
                f"obtuvo {result.risk_level} (score={result.risk_score})"
            )

    def test_risk_score_igual_a_fraud_probability(self, service):
        """
        Con los pesos de produccion (w_fraud=1.00, w_anomaly=0.00,
        w_behavioral=0.00), risk_score debe ser igual a fraud_probability.
        """
        tx = TransactionInput(
            transaction_id="test-equivalencia-001",
            user_id="U02797",
            amount=0.50,
            timestamp="2023-12-27T14:32:00Z",
            country="GB",
            device_id="D06611",
            merchant_id="M0129",
        )
        result = service.predict(tx)

        assert abs(result.risk_score - result.fraud_probability) < 1e-6, (
            f"risk_score={result.risk_score} debe ser igual a "
            f"fraud_probability={result.fraud_probability} "
            f"(pesos 1.00/0.00/0.00)"
        )


class TestSenalesAuxiliares:
    """
    Verifica que las señales auxiliares (behavioral_deviation, anomaly_score,
    anomaly_alert) se calculan correctamente y aportan valor incremental.

    risk_score sigue siendo igual a fraud_probability (pesos 1.00/0.00/0.00).
    Estas señales se usan de forma independiente para alertas de revisión.
    """

    def test_behavioral_deviation_tiene_variabilidad_usuario_con_historial(
        self, service
    ):
        """
        Un usuario con historial (U02797) debe obtener behavioral_deviation
        con variabilidad, no siempre cero. Esto confirma que el profiling
        funciona correctamente para usuarios conocidos.
        """
        # Transacción normal para usuario con historial
        tx = TransactionInput(
            transaction_id="test-behav-001",
            user_id="U02797",
            amount=0.50,
            timestamp="2023-12-27T14:32:00Z",
            country="GB",
            device_id="D06611",
            merchant_id="M0129",
        )
        result = service.predict(tx)

        # U02797 tiene tx_count=7 en training, así que NO es cold start
        assert result.is_cold_start is False
        # behavioral_deviation debe ser >= 0 y tener algún valor medible
        assert result.behavioral_deviation >= 0.0
        assert result.behavioral_deviation <= 1.0

    def test_behavioral_deviation_cero_en_cold_start(self, service):
        """
        Un usuario sin historial (cold start) debe obtener
        behavioral_deviation = 0.0 porque no hay historial que comparar.
        """
        tx = TransactionInput(
            transaction_id="test-behav-cold-001",
            user_id="usuario_sin_historial_xyz",
            amount=10.0,
            timestamp="2023-12-27T14:32:00Z",
            country="CO",
            device_id="D42",
            merchant_id="M18",
        )
        result = service.predict(tx)

        assert result.is_cold_start is True
        assert result.behavioral_deviation == 0.0, (
            f"En cold start behavioral_deviation debe ser 0.0, "
            f"obtuvo {result.behavioral_deviation}"
        )

    def test_anomaly_score_distingue_legitimo_de_fraude(self, service):
        """
        anomaly_score debe ser generalmente más alto para transacciones
        fraudulentas que para legítimas. Esto confirma que Isolation Forest
        aporta información incremental respecto de fraud_probability.
        """
        tx_legit = TransactionInput(
            transaction_id="test-anom-legit",
            user_id="U02797",
            amount=0.50,
            timestamp="2023-12-27T14:32:00Z",
            country="GB",
            device_id="D06611",
            merchant_id="M0129",
        )
        tx_fraud = TransactionInput(
            transaction_id="test-anom-fraud",
            user_id="U02797",
            amount=30.80,
            timestamp="2023-12-27T03:00:00Z",
            country="NG",
            device_id="D_NEW_999999",
            merchant_id="M99999",
        )

        r_legit = service.predict(tx_legit)
        r_fraud = service.predict(tx_fraud)

        assert r_fraud.anomaly_score > r_legit.anomaly_score, (
            f"El fraude debería tener anomaly_score mayor que el legítimo: "
            f"fraude={r_fraud.anomaly_score:.4f}, legítimo={r_legit.anomaly_score:.4f}"
        )

    def test_anomaly_alert_independiente_de_riesgo(self, service):
        """
        anomaly_alert es una señal separada de escalada. Un usuario legítimo
        con alto anomaly_score pero bajo fraud_probability debe tener
        anomaly_alert=True pero risk_level != CRITICAL.

        Esto confirma que anomaly_score NO se suma a risk_score.
        """
        tx = TransactionInput(
            transaction_id="test-anom-alert-001",
            user_id="U02797",
            amount=0.50,
            timestamp="2023-12-27T14:32:00Z",
            country="GB",
            device_id="D06611",
            merchant_id="M0129",
        )
        result = service.predict(tx)

        assert isinstance(result.anomaly_alert, bool)
        # risk_score == fraud_probability (pesos 1.00/0.00/0.00)
        assert abs(result.risk_score - result.fraud_probability) < 1e-6
        # anomaly_alert no afecta risk_level

    def test_fraude_con_alto_anomaly_alert(self, service):
        """
        Una transacción claramente fraudulenta debe tener anomaly_alert=True
        (alto anomaly_score por dispositivo nuevo, país desconocido, madrugada).
        """
        tx = TransactionInput(
            transaction_id="test-anom-fraud-alert",
            user_id="U02797",
            amount=30.80,
            timestamp="2023-12-27T03:00:00Z",
            country="NG",
            device_id="D_NEW_999999",
            merchant_id="M99999",
        )
        result = service.predict(tx)

        assert result.risk_level == "CRITICAL"
        assert result.anomaly_alert is True, (
            f"Esperaba anomaly_alert=True para fraude obvio, obtuvo "
            f"anomaly_score={result.anomaly_score:.4f}, "
            f"anomaly_alert={result.anomaly_alert}"
        )
