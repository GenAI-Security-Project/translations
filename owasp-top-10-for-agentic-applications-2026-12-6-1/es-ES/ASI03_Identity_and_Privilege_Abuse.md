<!-- status: draft -->
# ASI03: Abuso de Identidad y Privilegios (Identity and Privilege Abuse)

## Descripción

El Abuso de Identidad y Privilegios explota la confianza dinámica y la delegación en los agentes para escalar el acceso y eludir controles mediante la manipulación de cadenas de delegación, herencia de roles, flujos de control y contexto del agente; el contexto incluye credenciales almacenadas en caché o el historial de conversaciones a través de sistemas interconectados. En este contexto, la identidad se refiere tanto a la persona definida del agente como a cualquier material de autenticación que lo represente. La confianza entre agentes o las credenciales heredadas se pueden explotar para escalar el acceso, secuestrar privilegios o ejecutar acciones no autorizadas.

Este riesgo surge de la desalineación arquitectónica entre los sistemas de identidad centrados en el usuario y el diseño agéntico. Sin una identidad propia, diferenciada y gobernada, un agente opera en una brecha de atribución que hace imposible aplicar un principio de mínimo privilegio real. La identidad en este contexto incluye tanto la persona asignada al agente como cualquier material de autenticación (claves de API, tokens OAuth, sesiones de usuario delegadas) que lo represente.

Este escenario difiere de ASI02 (Uso Incorrecto de Herramientas / Tools Misuse), el cual es un uso no intencionado o no seguro de un privilegio ya concedido por parte de un principal que utiliza incorrectamente sus propias herramientas.

El Abuso de Identidad y Privilegios es la evolución agéntica de la Agencia Excesiva (LLM06:2025). A menudo aprovecha la Inyección de Prompts (LLM01:2025) y, debido a los permisos del agente, las integraciones de herramientas y los sistemas multiagente, el impacto puede amplificarse y superar la Divulgación de Información Confidencial (LLM02:2025) para comprometer directamente la confidencialidad, integridad y disponibilidad de los sistemas y datos a los que el agente puede acceder.

En las Amenazas y Mitigaciones de OWASP ASI, se asigna uno a uno con T3: Compromiso de Privilegios (Privilege Compromise), y en OWASP AIVSS corresponde al Riesgo Principal 2: Violación del Control de Acceso del Agente (Core Risk 2: Agent Access Control Violation).

## Ejemplos Comunes de la Vulnerabilidad

1. Herencia de privilegios sin acotar (Un-scoped Privilege Inheritance). Ocurre cuando un gestor de altos privilegios delega tareas sin aplicar una delimitación de mínimo privilegio —a menudo por comodidad o debido a límites arquitectónicos— transmitiendo su contexto de acceso completo. Un agente trabajador específico recibe entonces derechos excesivos. Los agentes *low-code* o *no-code* con privilegios predeterminados, como el acceso ilimitado a Internet, también heredan más autoridad de la prevista.

2. Retención de privilegios basada en memoria y fuga de datos (Memory-Based Privilege Retention & Data Leakage). Surge cuando los agentes almacenan en caché credenciales, claves o datos recuperados para contexto y reutilización. Si la memoria no se segmenta o limpia entre tareas o usuarios, los atacantes pueden inducir (*prompt*) al agente a reutilizar secretos en caché, escalar privilegios o filtrar datos de una sesión segura previa hacia una más débil.

3. Explotación de la confianza entre agentes (Confused Deputy / Diputado Confuso). En los sistemas multiagente, los agentes a menudo confían por defecto en las solicitudes internas. Un agente comprometido con bajos privilegios puede retransmitir instrucciones de apariencia válida a un agente de altos privilegios, el cual las ejecuta sin volver a verificar la intención original del usuario, utilizando de manera indebida sus permisos elevados.

4. Tiempo de comprobación a tiempo de uso (TOCTOU) en flujos de trabajo de agentes. Los permisos se pueden validar al inicio de un flujo de trabajo pero cambiar o expirar antes de la ejecución. El agente continúa con una autorización desactualizada, realizando acciones que el usuario ya no tiene derechos para aprobar.

5. Inyección de identidad sintética (Synthetic Identity Injection). Los atacantes suplantan a agentes internos utilizando descriptores no verificados (por ejemplo, «Admin Helper») para obtener una confianza heredada y realizar acciones privileged bajo una identidad fabricada.

## Escenarios de Ataque de Ejemplo

1. Abuso de privilegios delegados: Un agente de finanzas delega en un agente de «consulta de BD» pero le transmite todos sus permisos. Un atacante que dirige los *prompts* de la consulta utiliza el acceso heredado para exfiltrar datos de RR. HH. y legales.

2. Escalada basada en memoria: Un agente de administración de TI almacena en caché credenciales SSH durante un parche. Más tarde, un usuario no administrador reutiliza la misma sesión e induce al agente a usar esas credenciales para crear una cuenta no autorizada.

3. Explotación de la confianza entre agentes: Un correo electrónico manipulado supuestamente de TI indica a un agente de clasificación de correo que ordene a un agente de finanzas mover dinero a una cuenta específica. El agente clasificador lo reenvía y el agente de finanzas, al confiar en un agente interno, procesa el pago fraudulento sin verificación.

4. Phishing de código de dispositivo entre agentes: Un atacante comparte un enlace de código de dispositivo que sigue un agente de navegación; un agente «ayudante» independiente completa el código, vinculando el *tenant* de la víctima a los alcances (*scopes*) del atacante.

5. Desviación de autorización en flujos de trabajo: Un agente de compras valida la aprobación al inicio de una secuencia de compra. Horas más tarde, se reduce el límite de gasto del usuario, pero el flujo de trabajo continúa con el token de autorización antiguo, completando la transacción que ahora no está autorizada.

6. Persona de agente falsificada: Un atacante registra un agente falso «Admin Helper» en un registro interno de Agent2Agent con una tarjeta de agente falsificada. Otros agentes, al confiar en el descriptor, le enrutan tareas de mantenimiento privilegiadas. El agente controlado por el atacante emite entonces comandos a nivel de sistema bajo la premisa de confianza interna.

7. Compartición de identidad: Un agente obtiene acceso a los sistemas en nombre de un usuario, a menudo su creador. Luego permite que otros usuarios aprovechen esa identidad de forma implícita al invocar sus herramientas con esa identidad.

## Guías de Prevención y Mitigación

1. Aplicar permisos delimitados por tarea y limitados en el tiempo: Emitir tokens de corta duración y alcance acotado por tarea y limitar los derechos mediante límites de permisos —utilizando identidades por agente y credenciales de corta duración (por ejemplo, certificados mTLS o tokens con alcance acotado)— para limitar el radio de impacto (*blast radius*), bloquear el abuso de delegación y los ataques en ventanas de mantenimiento, y mitigar la herencia sin acotar, los privilegios huérfanos y la elevación por bucles de reflexión (*reflection loop elevation*).

2. Aislar las identidades y los contextos de los agentes: Ejecutar *sandboxes* por sesión con permisos y memoria separados, borrando el estado entre tareas para prevenir la Escalada Basada en Memoria y reducir la Exfiltración de Datos entre Repositorios.

3. Exigir autorización por acción: Volver a verificar cada paso privilegiado con un motor de políticas centralizado que compruebe los datos externos, deteniendo la Explotación de la Confianza entre Agentes y la Elevación por Bucle de Reflexión.

4. Aplicar intervención humana (*Human-in-the-Loop*) para la escalada de privilegios: Requerir la aprobación humana para acciones de altos privilegios o irreversibles a fin de proporcionar una red de seguridad que detenga la Escalada Basada en Memoria, la Explotación de la Confianza entre Agentes y los ataques en Ventanas de Mantenimiento.

5. Definir la intención: Vincular los tokens OAuth a una intención firmada que incluya el sujeto, la audiencia, el propósito y la sesión. Rechazar cualquier uso de token donde la intención vinculada no coincida con la solicitud actual.

6. Evaluar plataformas de gestión de identidades agénticas: Las plataformas principales integran a los agentes en sus sistemas de gestión de identidades y accesos, tratándolos como identidades no humanas gestionadas con credenciales delimitadas, trazas de auditoría y controles de ciclo de vida. Los ejemplos incluyen Microsoft Entra, AWS Bedrock Agents, Salesforce Agentforce, el modelo Agentic System of Record (ASOR) de Workday y patrones emergentes similares en Google Vertex AI.

7. Vincular permisos a sujeto, recurso, propósito y duración. Requerir reautenticación ante un cambio de contexto. Evitar la herencia de privilegios entre agentes a menos que la intención original se vuelva a validar. Incluir revocación automatizada por inactividad o anomalía.

8. Detectar permisos delegados y transitivos: Monitorizar cuándo un agente obtiene nuevos permisos de forma indirecta a través de cadenas de delegación. Marcar los casos en los que un agente de bajos privilegios herede o reciba alcances de mayor privilegio durante flujos de trabajo multiagente.

9. Detectar elevaciones anómalas de privilegios entre agentes y flujos de phishing del tipo código de dispositivo mediante la monitorización de casos en los que los agentes soliciten nuevos alcances (*scopes*) o reutilicen tokens fuera de su intención original y firmada.

## Referencias

1. https://research.aimultiple.com/agentic-ai-cybersecurity/

2. https://www.docker.com/blog/mcp-horror-stories-github-prompt-injection/

3. https://css.csail.mit.edu/6.858/2015/readings/confused-deputy.html

4. 15 Ways to Break Your Copilot, BHUSA 2024

5. NVD - cve-2025-31491