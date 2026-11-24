<!-- status: draft -->
# ASI01: Secuestro de Objetivos del Agente (Agent Goal Hijack)

## Descripción

Los agentes de IA muestran una capacidad autónoma para ejecutar una serie de tareas con el fin de alcanzar un objetivo. Debido a debilidades inherentes en la forma en que se procesan las instrucciones en lenguaje natural y el contenido relacionado, los agentes y el modelo subyacente no pueden distinguir de manera confiable las instrucciones del contenido relacionado.

Como resultado, los atacantes pueden manipular los objetivos de un agente, la selección de tareas o las rutas de decisión mediante una variedad de técnicas, que incluyen, entre otras, manipulación basada en *prompts*, resultados de herramientas engañosos, artefactos maliciosos, mensajes falsificados entre agentes o datos externos envenenados. Debido a que los agentes confían en entradas de lenguaje natural sin tipado y en una lógica de orquestación escasamente gobernada, no pueden distinguir de manera confiable las instrucciones legítimas del contenido controlado por el atacante. A diferencia de LLM01:2025, que se centra en alterar una única respuesta del modelo, ASI01 abarca el impacto agentico más amplio donde las entradas manipuladas redirigen los objetivos, la planificación (cuando se utiliza) y el comportamiento de múltiples pasos.

El secuestro de objetivos del agente (Agent Goal Hijack) difiere de ASI06 (Envenenamiento de Memoria y Contexto) y ASI10 (Agentes Deshonestos / Rogue Agents) porque el atacante altera directamente los objetivos, instrucciones o rutas de decisión del agente, independientemente de si la manipulación ocurre de forma interactiva o a través de entradas preposicionadas como documentos, plantillas o fuentes de datos externas. ASI06 se centra en la corrupción persistente del contexto almacenado o de la memoria a largo plazo, mientras que ASI10 captura la desalineación autónoma que surge sin el control activo del atacante. En la Guía de Amenazas y Mitigaciones de IA Agéntica de OWASP, ASI01 corresponde a T06 Manipulación de Objetivos (alterar los objetivos del agente) y T07 Comportamientos Desalineados y Engañosos (eludir salvaguardas o engañar a los humanos). Juntos, estos ilustran cómo los atacantes pueden subvertir los objetivos y la lógica de selección de acciones del agente, redirigiendo su autonomía hacia resultados no deseados o dañinos.

## Ejemplos Comunes de la Vulnerabilidad

1. Inyección de *prompt* indirecta a través de cargas útiles de instrucciones ocultas incrustadas en páginas web o documentos en un escenario de RAG, que redirigen silenciosamente a un agente para exfiltrar datos sensibles o hacer un mal uso de las herramientas conectadas.

2. Inyección de *prompt* indirecta en canales de comunicación externos (por ejemplo, correo electrónico, calendario, Teams) enviados desde fuera de la empresa, que secuestra la capacidad de comunicación interna de un agente, enviando mensajes no autorizados bajo una identidad de confianza.

3. Una anulación maliciosa de *prompt* manipula a un agente financiero para transferir dinero a la cuenta de un atacante.

4. La inyección de *prompt* indirecta anula las instrucciones del agente haciendo que produzca información fraudulenta que afecta las decisiones comerciales.

## Ejemplos de Escenarios de Ataque

1. EchoLeak: Inyección de *prompt* indirecta de cero clics. Un atacante envía por correo electrónico un mensaje manipulado que activa silenciosamente a Microsoft 365 Copilot para ejecutar instrucciones ocultas, lo que hace que la IA exfiltre correos electrónicos confidenciales, archivos y registros de chat sin ninguna interacción del usuario.

2. Inyección de *prompt* en operadores a través de contenido web. Un atacante coloca contenido malicioso en una página web que el agente operador procesa, por ejemplo, en escenarios de búsqueda o RAG, engañándolo para que siga instrucciones no autorizadas. El agente operador accede entonces a páginas internas autenticadas y expone los datos privados de los usuarios, lo que demuestra cómo los agentes autónomos con poca protección pueden filtrar información sensible a través de la inyección de *prompts*.

3. Desviación del bloqueo de objetivos (*goal-lock drift*) mediante *prompts* programados. Una invitación de calendario maliciosa inyecta una instrucción recurrente de "modo silencioso" que repondera sutilmente los objetivos cada mañana, guiando al planificador hacia aprobaciones de baja fricción mientras mantiene las acciones dentro de las políticas declaradas.

4. Ataque de Incepción en usuarios de ChatGPT. Un documento de Google Docs malicioso inyecta instrucciones para que ChatGPT exfiltre datos de los usuarios y convence al usuario de tomar una decisión comercial poco acertada.

## Directrices de Prevención y Mitigación

1. Trate todas las entradas en lenguaje natural (por ejemplo, texto proporcionado por el usuario, documentos cargados, contenido recuperado) como no confiables. Enrútelas a través de las mismas salvaguardas de validación de entradas y de inyección de *prompts* definidas en LLM01:2025 antes de que puedan influir en la selección de objetivos, la planificación o las llamadas a herramientas.

2. Minimice el impacto del secuestro de objetivos aplicando el principio de privilegios mínimos para las herramientas de agentes y exigiendo la aprobación humana para acciones de alto impacto o que cambien los objetivos.

3. Defina y bloquee los *prompts* de sistema del agente para que las prioridades de los objetivos y las acciones permitidas sean explícitas y auditables. Los cambios en los objetivos o en las definiciones de las recompensas deben pasar por la gestión de configuración y la aprobación humana.

4. En tiempo de ejecución, valide tanto la intención del usuario como la intención del agente antes de ejecutar acciones que cambien los objetivos o sean de alto impacto. Requiera confirmación —mediante aprobación humana, motor de políticas o barreras de protección de la plataforma— siempre que el agente proponga acciones que se desvíen de la tarea o alcance original. Pausa o bloquee la ejecución ante cualquier cambio inesperado de objetivo, muestre la desviación para su revisión y regístrela para su auditoría.

5. Al construir agentes, evalúe el uso de la "cápsula de intención" (*intent capsule*), un patrón emergente para vincular el objetivo declarado, las restricciones y el contexto a cada ciclo de ejecución en un sobre firmado, restringiendo su uso en tiempo de ejecución.

6. Desinfecte y valide cualquier fuente de datos conectada —incluyendo entradas de RAG, correos electrónicos, invitaciones de calendario, archivos cargados, API externas, resultados de navegación y mensajes entre agentes— utilizando CDR (Reconstrucción y Desinfección de Contenido), detección de portadores de *prompts* y filtrado de contenido antes de que los datos puedan influir en los objetivos o acciones del agente.

7. Mantenga un registro completo y un monitoreo continuo de la actividad del agente, estableciendo una línea base de comportamiento que incluya el estado de los objetivos, patrones de uso de herramientas y propiedades invariantes (por ejemplo, esquemas, patrones de acceso). Realice un seguimiento de un identificador estable para el objetivo activo cuando sea posible, y emita alertas sobre cualquier desviación —como cambios inesperados de objetivos, secuencias de herramientas anómalas o desviaciones de la línea base establecida— para que el desplazamiento no autorizado de objetivos sea inmediatamente visible en las operaciones.

8. Realice pruebas periódicas de *red-team* que simulen la anulación de objetivos y verifique la eficacia de la reversión (*rollback*).

9. Incorpore agentes de IA en el Programa de Amenazas Internas establecido para monitorear cualquier *prompt* interno destinado a obtener acceso a datos sensibles o a alterar el comportamiento del agente, y permita la investigación en caso de actividad atípica.

## Referencias

1. Security Advisory - ChatGPT Crawler Reflective DDOS Vulnerability: Aviso de seguridad que detalla la vulnerabilidad.

2. AIM Echoleak Blog Post: Publicación de blog que describe la vulnerabilidad.

3. ChatGPT Plugin Exploit Explained: From Prompt Injection to Accessing Private Data.

4. AgentFlayer: Ataque de incepción de 0 clics en usuarios de ChatGPT.