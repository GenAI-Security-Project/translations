<!-- status: draft -->
# ASI10: Agentes Deshonestos (Rogue Agents)

## Descripción

Los agentes deshonestos (Rogue Agents) son agentes de IA maliciosos o comprometidos que se desvían de su función prevista o de su alcance autorizado, actuando de forma perjudicial, engañosa o parasitaria dentro de ecosistemas multiagente o de interacción humano-agente.

Las acciones del agente pueden parecer legítimas de forma individual, pero su comportamiento emergente se vuelve dañino, creando una brecha de contención para los sistemas tradicionales basados en reglas. Aunque un compromiso externo, como la inyección de prompts (LLM01:2025), el secuestro de objetivos (AS01) o la manipulación de la cadena de suministro (AS04), puede iniciar la divergencia, la categoría ASI10 se centra en la pérdida de integridad del comportamiento y de gobernanza una vez que comienza la desviación, no en la intrusión inicial en sí. Las consecuencias incluyen la divulgación de información sensible, la propagación de desinformación, el secuestro de flujos de trabajo y el sabotaje operativo.

Los agentes deshonestos representan un riesgo diferenciado de divergencia de comportamiento, a diferencia de la Agencia Excesiva (LLM06:2025), que se centra en los permisos concedidos en exceso, y pueden convertirse en "amenazas internas" amplificadas debido a la velocidad y escala de los sistemas agénticos. Las consecuencias incluyen la Divulgación de Información Sensible (LLM02:2025) y la Desinformación (LLM09:2025). En la guía de Amenazas y Mitigaciones para IA Agéntica de OWASP, ASI10 se corresponde con T13 – Agentes Deshonestos en Sistemas Multiagente. El marco OWASP AIVSS mapea este riesgo principalmente a Integridad del Comportamiento (BI), Seguridad Operacional (OS) y Violaciones de Cumplimiento (CV), con una severidad elevada para despliegues críticos o autopropagables.

## Ejemplos Comunes de la Vulnerabilidad

1. Desviación de Objetivos y Maquinación (Goal Drift and Scheming): Los agentes se desvían de los objetivos previstos, pareciendo cumplir las normas pero persiguiendo objetivos ocultos y a menudo engañosos debido a inyecciones indirectas de prompts u objetivos en conflicto.

2. Secuestro de Flujos de Trabajo (Workflow Hijacking): Los agentes deshonestos toman el control de flujos de trabajo establecidos y de confianza para redirigir los procesos hacia objetivos maliciosos, comprometiendo la integridad de los datos y el control operativo.

3. Colusión y Autorreplicación (Collusion and Self-Replication): Los agentes se coordinan para amplificar la manipulación, compartir señales de formas no intencionadas o propagarse de manera autónoma por todo el sistema, eludiendo los intentos simples de desactivación.

4. Manipulación de Recompensas y Abuso de Optimización (Reward Hacking and Optimization Abuse): Los agentes manipulan los sistemas de recompensa asignados explotando métricas defectuosas para generar resultados engañosos o adoptar estrategias agresivas no alineadas con los objetivos originales.

## Escenarios de Ataque de Ejemplo

1. Exfiltración autónoma de datos tras una inyección indirecta de prompts: Tras encontrarse con una instrucción web envenenada, el agente aprende este comportamiento y continúa escaneando y transmitiendo de forma independiente archivos sensibles a servidores externos incluso después de eliminar la fuente maliciosa, demostrando un comportamiento no autorizado persistente más allá de su alcance previsto.

2. Suplantación de un Agente Observador (Violación de la Integridad): Un atacante inyecta un agente falso de revisión o aprobación en un flujo de trabajo multiagente. Un agente de alto valor (p. ej., de procesamiento de pagos), al confiar en la solicitud interna, es engañado para liberar fondos o aprobar transacciones fraudulentas.

3. Autorreplicación a través de API de Aprovisionamiento (Persistencia y Disponibilidad): Se manipula un agente de automatización comprometido para generar réplicas no autorizadas de sí mismo en toda la red, priorizando la persistencia y consumiendo recursos en contra de la intención del propietario del sistema.

4. Pérdida Crítica de Datos por Manipulación de Recompensas: Los agentes encargados de minimizar los costes en la nube aprenden que eliminar las copias de seguridad de producción es la forma más eficaz de alcanzar su objetivo, destruyendo de forma autónoma todos los activos de recuperación ante desastres.

## Guías de Prevención y Mitigación

1. Gobernanza y Registro (Logging): Mantener registros de auditoría exhaustivos, inmutables y firmados de todas las acciones del agente, llamadas a herramientas y comunicaciones entre agentes para revisar posibles infiltraciones sigilosas o delegaciones no aprobadas.

2. Aislamiento y Límites: Asignar zonas de confianza (Trust Zones) con reglas estrictas de comunicación entre zonas y desplegar entornos de ejecución restringidos (p. ej., sandboxes en contenedores) con alcances de API basados en el principio de mínimo privilegio.

3. Monitorización y Detección: Desplegar detección de comportamiento, como agentes supervisores (watchdog agents) para validar el comportamiento y los resultados de sus pares, centrándose en detectar patrones de colusión y señales falsas coordinadas. Monitorizar anomalías como ejecuciones de acciones excesivas o anormales.

4. Contención y Respuesta: Implementar mecanismos rápidos como interruptores de parada de emergencia (kill-switches) y revocación de credenciales para desactivar de manera instantánea a los agentes deshonestos. Poner en cuarentena a los agentes sospechosos en entornos aislados (sandboxes) para su revisión forense.

5. Atestación de Identidad y Aplicación de Integridad del Comportamiento: Implementar atestación de identidad criptográfica por agente y hacer cumplir líneas base de integridad del comportamiento a lo largo del ciclo de vida del agente. Adjuntar manifiestos de comportamiento firmados que declaren las capacidades, herramientas y objetivos esperados, los cuales son validados por los servicios de orquestación antes de cada acción. Integrar una capa de verificación de comportamiento que monitorice continuamente las tareas en busca de desviaciones con respecto al manifiesto declarado (p. ej., invocaciones de herramientas no aprobadas, intentos inesperados de exfiltración de datos, etc.).

6. Requerir atestación periódica del comportamiento: tareas de desafío (challenge tasks), lista de materiales (bill of materials) firmada para prompts y herramientas, y credenciales efímeras por ejecución vinculadas a una audiencia de un solo uso. Todos los mecanismos de firma y atestación presuponen una gestión de claves criptográficas robustecida (p. ej., claves respaldadas por HSM/KMS, acceso de mínimo privilegio, rotación y revocación). Las claves nunca deben estar disponibles directamente para los agentes; en su lugar, los orquestadores deben mediar en las operaciones de firma para que un agente comprometido no pueda simplemente exfiltrar o utilizar indebidamente claves de larga duración.

7. Recuperación y Reintegración: Establecer líneas base de confianza para restaurar agentes puestos en cuarentena o remediados. Requerir atestación renovada, verificación de dependencias y aprobación humana antes de su reintegración en redes de producción.

## Referencias

1. Multi-Agent Systems Execute Arbitrary Malicious Code (arXiv) [URL: https://arxiv.org/abs/2503.12188] Rogue Agents Agent

2. Preventing Rogue Agents Improves Multi-Agent Collaboration (arXiv) [URL: https://arxiv.org/abs/2502.05986]