<!-- status: draft -->
# ASI06: Envenenamiento de Memoria y Contexto (Memory & Context Poisoning)

## Descripción

Los sistemas agénticos dependen de información almacenada y recuperable, la cual puede ser una instantánea de su historial de conversaciones, una herramienta de memoria o un contexto ampliado, lo que respalda la continuidad entre tareas y ciclos de razonamiento. El contexto incluye cualquier información que un agente retenga, recupere o reutilice, como resúmenes, *embeddings* y almacenes de RAG, pero excluye los *prompts* de entrada únicos cubiertos en LLM01:2025 Inyección de Prompts (Prompt Injection).

En el Envenenamiento de Memoria y Contexto, los atacantes corrompen o introducen datos maliciosos o engañosos en este contexto, provocando que el razonamiento, la planificación o el uso de herramientas futuros se sesguen, no sean seguros o faciliten la exfiltración. Las fuentes de ingesta, como cargas de archivos, canales de API, entradas de usuario o intercambios entre agentes, pueden no ser de confianza o estar solo parcialmente validadas.

Este riesgo es distinto de ASI01 (Secuestro de Objetivos / Goal Hijack), que abarca la manipulación directa de objetivos, y de ASI08 (Fallos en Cascada / Cascading Failures), que describe la degradación después de que ocurre el envenenamiento. Sin embargo, el envenenamiento de memoria conduce frecuentemente al secuestro de objetivos (ASI01), ya que el contexto corrupto o la memoria a largo plazo pueden alterar la interpretación de objetivos, la ruta de razonamiento o la lógica de selección de herramientas del agente.

Se basa en LLM01:2025 Inyección de Prompts (Prompt Injection), LLM04:2025 Envenenamiento de Datos y Modelos (Data and Model Poisoning) y LLM08:2025 Debilidades de Vectores y Embeddings (Vector and Embedding Weaknesses), pero se centra en la corrupción persistente de la memoria del agente y el contexto recuperable que se propaga a través de las sesiones y altera el razonamiento autónomo.

Se mapea a T1 Memory Poisoning en *Agentic Threats and Mitigations*, con impactos relacionados en T4 Memory Overload, T6 Broken Goals y T12 Shared Memory Poisoning. En AIVSS, los campos AARS de uso de memoria (Memory Use) y conciencia contextual (Contextual Awareness) aumentan la puntuación de vulnerabilidad agéntica.

## Ejemplos Comunes de la Vulnerabilidad

1. Envenenamiento de RAG y *embeddings*: Datos maliciosos o manipulados ingresan a la base de datos vectorial a través de fuentes envenenadas, cargas directas o canales sobre los que se confía demasiado. Esto da como resultado respuestas falsas que son consideradas y cargas útiles objetivo.

2. Envenenamiento de contexto de usuario compartido: Los contextos reutilizados o compartidos permiten a los atacantes inyectar datos a través de chats normales, influyendo en sesiones posteriores. Los efectos incluyen desinformación, ejecución de código inseguro o acciones de herramientas incorrectas.

3. Manipulación de la ventana de contexto: Un atacante inyecta contenido manipulado en una conversación o tarea en curso para que luego se resuma o persista en la memoria, contaminando el razonamiento o las decisiones futuras incluso después de que finalice la sesión original.

4. Deriva de la memoria a largo plazo: La exposición incremental a datos, resúmenes o comentarios de agentes pares sutilmente contaminados desplaza gradualmente el conocimiento almacenado o la ponderación de objetivos, produciendo desviaciones de comportamiento o políticas con el tiempo.

5. Desalineación sistémica y puertas traseras (*backdoors*): La memoria envenenada cambia la personalidad del modelo e implanta puertas traseras basadas en activadores que ejecutan instrucciones ocultas, como código destructivo o fugas de datos.

6. Propagación multiagente: El contexto contaminado o la memoria compartida se propagan entre agentes cooperativos, agravando la corrupción y permitiendo la fuga de datos a largo plazo o una deriva coordinada.

## Ejemplos de Escenarios de Ataque

1. Envenenamiento de la memoria de reservas de viajes: Un atacante sigue reforzando el precio falso de un vuelo, el asistente lo almacena como verdad y luego aprueba reservas a ese precio y elude las verificaciones de pago.

2. Explotación de la ventana de contexto: El atacante divide los intentos entre sesiones para que los rechazos anteriores desaparezcan del contexto, y la IA finalmente otorga permisos escalados hasta el acceso de administrador.

3. Envenenamiento de memoria para el sistema: El atacante reentrena la memoria de una IA de seguridad para etiquetar la actividad maliciosa como normal, permitiendo que los ataques pasen desapercibidos.

4. Envenenamiento de memoria compartida: El atacante inserta políticas de reembolso falsas en la memoria compartida, otros agentes las reutilizan y el negocio sufre malas decisiones, pérdidas y disputas.

5. Fuga vectorial entre inquilinos (*cross-tenant*): Contenido casi duplicado sembrado por un atacante explota filtros de espacio de nombres laxos, extrayendo el fragmento confidencial de otro inquilino hacia la recuperación por alta similitud de coseno.

6. Envenenamiento de la memoria del asistente: Un atacante implanta la memoria de los asistentes de usuario a través de Inyección de Prompts Indirecta (Indirect Prompt Injection), comprometiendo las sesiones actuales y futuras de ese usuario.

## Directrices de Prevención y Mitigación

1. Protección de datos base: Cifrado en tránsito y en reposo combinado con acceso de mínimo privilegio.

2. Validación de contenido: Analizar todas las nuevas escrituras de memoria y salidas del modelo (reglas + IA) en busca de contenido malicioso o confidencial antes de confirmar (*commit*).

3. Segmentación de memoria: Aislar las sesiones de usuario y los contextos de dominio para evitar fugas de conocimiento y datos confidenciales.

4. Acceso y retención: Permitir únicamente fuentes autenticadas y seleccionadas; aplicar acceso consciente del contexto por tarea; minimizar la retención según la sensibilidad de los datos.

5. Procedencia y anomalías: Requerir atribución de origen y detectar actualizaciones o frecuencias sospechosas.

6. Evitar la reingestión automática de las propias salidas generadas por un agente en la memoria confiable para evitar la contaminación autorreforzada o el "envenenamiento de arranque" (*bootstrap poisoning*).

7. Resiliencia y verificación: Realizar pruebas de adversarios, usar instantáneas/reversiones (*snapshots/rollback*) y control de versiones, y requerir revisión humana para acciones de alto riesgo. Donde opere almacenes compartidos de vectores o memoria, use espacios de nombres (*namespaces*) por inquilino y puntuaciones de confianza para las entradas, aplicando descomposición (*decay*) o caducidad a la memoria no verificada con el tiempo y admitiendo la reversión/cuarentena para el envenenamiento sospechoso.

8. Expirar la memoria no verificada para limitar la persistencia del envenenamiento.

9. Ponderar la recuperación según la confianza y la titularidad (*tenancy*): Requerir dos factores para mostrar memoria de alto impacto (por ejemplo, puntuación de procedencia más etiqueta verificada por humanos) y degradar las entradas de baja confianza con el tiempo.

## Referencias

1. New hack uses prompt injection to corrupt Gemini’s long-term memory, https://arstechnica.com/security/2025/02/new-hack-uses-prompt-injection-to-corrupt-geminis- long-term-memory/

2. Attackers Can Manipulate AI Memory to Spread Lies, https://www.bankinfosecurity.com/attackers- manipulate-ai-memory-to-spread-lies-a-27699

3. Poisoned RAG, https://arxiv.org/pdf/2402.07867

4. AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases, https://arxiv.org/abs/2407.12784

5. Securing Agentic AI: A Comprehensive Threat Model and Mitigation Framework for Generative AI Agents, https://arxiv.org/pdf/2504.19956

6. Dynamic Cheatsheet: Test Time Learning with Adaptive Memory, - https://arxiv.org/abs/2504.07952v1

7. Memento: Fine-tuning LLM Agents without Fine-tuning LLMs, https://arxiv.org/abs/2508.16153

8. AgentFlayer: persistent 0click exploit on ChatGPT.

9. Hacker plants false memories in ChatGPT to steal user data in perpetuity

10. The Trifecta: How Three New Gemini Vulnerabilities in Cloud Assist, Search Model, and Browsing Allowed Private Data Exfiltration