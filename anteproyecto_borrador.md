# ANTEPROYECTO: SISTEMA INTEGRAL DE DETECCIÓN DE FRAUDE BASADO EN MACHINE LEARNING Y MICROSERVICIOS

**Programa y modalidad:** Ingeniería de Sistemas - [Modalidad, ej. Trabajo de Grado]
**Código, asignatura y grupo:** [Código] - Proyecto Integrador - Grupo [X]
**Título del proyecto:** Desarrollo de un Sistema Backend Escalable y Modelos de Machine Learning para la Detección Temprana de Fraude Transaccional.
**Tipo de proyecto:** Desarrollo (e Investigación Aplicada)
**Nombres de los estudiantes y profesor:**
*   [Tu Nombre] - [Tu Correo]
*   Profesor: [Nombre del Profesor] - [Correo]

## RESUMEN
El fraude en transacciones financieras y plataformas digitales representa uno de los mayores desafíos actuales, causando pérdidas millonarias y erosionando la confianza de los usuarios. Las soluciones tradicionales basadas en reglas estáticas son insuficientes ante los patrones cambiantes de fraude. Este proyecto plantea el desarrollo de un sistema de detección de fraude compuesto por un backend robusto en Java (Spring Boot) y un motor de inferencia de Machine Learning en Python. El sistema permitirá analizar transacciones en tiempo real, evaluando el riesgo mediante modelos predictivos avanzados y generando alertas oportunas. Con esta iniciativa, se espera reducir significativamente el porcentaje de falsos positivos y mejorar el tiempo de respuesta ante actividades sospechosas, aportando una herramienta tecnológica moderna y escalable al sector.

## PALABRAS CLAVE
Detección de Fraude, Machine Learning, Backend, Arquitectura de Software, Transacciones en Tiempo Real, Análisis de Riesgo.

## PLANTEAMIENTO DEL PROBLEMA
En el contexto actual del comercio electrónico y las finanzas digitales, el volumen de transacciones ha crecido exponencialmente, y de forma paralela, las tácticas para cometer fraude se han sofisticado. Las organizaciones enfrentan el problema de distinguir de manera precisa y en tiempo real entre una transacción legítima y una fraudulenta. Un sistema lento o ineficiente no solo permite la materialización del fraude (pérdidas económicas), sino que, si genera muchos falsos positivos, afecta la experiencia del usuario (bloqueos injustificados). 

La necesidad radica en contar con una arquitectura que integre reglas de negocio complejas con modelos de aprendizaje automático capaces de adaptarse a nuevos patrones. El problema a resolver es la falta de integración eficiente entre la capa transaccional y la capa analítica (inteligencia artificial) en entornos de alto rendimiento, requiriendo la intervención de la ingeniería de sistemas para diseñar una arquitectura de software (Backend + ML) que soporte la concurrencia, garantice baja latencia y centralice la gestión de alertas de fraude.

## REVISIÓN BIBLIOGRÁFICA
El proyecto se fundamenta teóricamente en la Arquitectura de Software orientada a servicios, patrones de diseño para alta concurrencia, y conceptos de Ciencia de Datos (Machine Learning supervisado y no supervisado para detección de anomalías). 

En la industria, soluciones como Apache Kafka y Flink se utilizan para el procesamiento de flujos de datos. A nivel de estado del arte, los sistemas modernos de detección de fraude emplean modelos ensamblados (Ensemble Learning) y redes neuronales, exponiendo estos modelos a través de APIs REST o gRPC. El proyecto se cimentará sobre estos principios, utilizando Java/Spring Boot para el control transaccional y Python para el componente algorítmico, proponiendo una integración (ML Inference Port) que permita evaluar riesgos en ventanas de tiempo muy cortas.

## OBJETIVOS DEL PROYECTO

**Objetivo General:**
Desarrollar un sistema de software integrado por un backend transaccional y un motor de Machine Learning, capaz de evaluar y clasificar el nivel de riesgo de transacciones financieras en tiempo real para la prevención de fraudes.

**Objetivos Específicos:**
1. Diseñar y construir una API RESTful en Java (Spring Boot) que gestione la recepción de transacciones y la administración de alertas.
2. Desarrollar e integrar un modelo de Machine Learning en Python que analice características transaccionales y asigne una probabilidad de fraude.
3. Implementar la comunicación (puertos de inferencia) entre el backend y el motor de IA para procesar evaluaciones con baja latencia.
4. Validar la eficacia del sistema midiendo el tiempo de respuesta y la precisión en la identificación de alertas sobre un conjunto de datos de prueba.

## METODOLOGÍA
El desarrollo se guiará mediante una metodología ágil (Scrum/Kanban) adaptada para equipos pequeños, iterando sobre ciclos cortos de desarrollo. 
1. **Fase de Diseño y Arquitectura:** Definición de contratos API, esquemas de bases de datos y arquitectura de despliegue.
2. **Fase de Desarrollo Backend:** Implementación de controladores, servicios (`TransactionService`, `AlertService`) y manejo de excepciones en Java.
3. **Fase de Ciencia de Datos:** Limpieza de datos, entrenamiento y evaluación de modelos predictivos en Python (ej. validación temporal y fusión de riesgos).
4. **Fase de Integración:** Conexión del backend con el modelo de ML mediante interfaces (`MLInferencePort`).
5. **Fase de Pruebas:** Ejecución de pruebas unitarias, de integración y evaluación de rendimiento (latencia y throughput).

## CRONOGRAMA (Ejemplo - Ajustar según fechas límite)
*   **Semana 1-4:** Estructuración del proyecto, anteproyecto y diseño arquitectónico. (Entregable: Documento Anteproyecto)
*   **Semana 5-7:** Desarrollo de API base y persistencia de datos (Backend).
*   **Semana 8-10:** Entrenamiento del modelo de Machine Learning y empaquetado.
*   **Semana 11-13:** Integración Backend-ML y lógica de alertas.
*   **Semana 14-16:** Pruebas de integración, optimización, escritura del informe final y preparación de la sustentación.

## PRESUPUESTO
| RUBROS | FUENTES (UdeA) | Otras fuentes (Propias) | TOTAL |
| :--- | :--- | :--- | :--- |
| PERSONAL (Horas Estudiante) | $ 0 | $ 3.000.000 (Aprox) | $ 3.000.000 |
| EQUIPOS (Computador personal) | $ 0 | $ 2.500.000 | $ 2.500.000 |
| SOFTWARE (Licencias, Nube AWS/GCP) | $ 0 | $ 150.000 | $ 150.000 |
| MATERIAL BIBLIOGRÁFICO | $ 0 | $ 50.000 | $ 50.000 |
| **TOTAL** | | | **$ 5.700.000** |

## BIBLIOGRAFÍA
*   Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley.
*   Géron, A. (2019). *Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow*. O'Reilly Media.
*   Documentación Oficial de Spring Boot (https://spring.io/projects/spring-boot)
*   Artículos sobre detección de anomalías y fraude en sistemas financieros.
