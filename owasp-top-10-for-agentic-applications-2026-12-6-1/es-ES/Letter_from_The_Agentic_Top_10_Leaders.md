<!-- status: draft -->
# Carta de los Líderes del Agentic Top 10

Los sistemas de IA agéntica están pasando rápidamente de la fase de pruebas a la producción en los sectores financiero, de salud, de defensa, de infraestructura crítica y público. A diferencia de las automatizaciones específicas para una tarea, los agentes planifican, deciden y actúan a través de múltiples pasos y sistemas, a menudo en nombre de usuarios y equipos. La Iniciativa de Seguridad Agéntica (Agentic Security Initiative) ya ha comenzado a definir salvaguardas para las aplicaciones agénticas mediante la publicación de un conjunto de directrices que abarcan todo el ciclo de vida.

Nuestra taxonomía principal (IA Agéntica - Amenazas y Mitigaciones / *Agentic AI - Threats and Mitigations*) proporciona una definición base de los agentes, su relación con las aplicaciones de LLM, el papel de la autonomía y un tratamiento detallado de las amenazas y mitigaciones. Documentos adicionales cubren el modelado de amenazas (Guía de Modelado de Amenazas Agénticas / *Agentic Threat Modelling Guide*), la seguridad en la arquitectura, diseño, desarrollo y despliegue de aplicaciones agénticas (Asegurando Aplicaciones Agénticas / *Securing Agentic Applications*), así como la gobernanza (Estado de la Seguridad y Gobernanza de la IA Agéntica / *State of Agentic AI Security and Governance*).

Estas publicaciones proporcionan un conjunto completo de directrices concebido como referencia y cobertura en profundidad. Sin embargo, su amplitud puede dificultar su traducción a la práctica diaria para desarrolladores, defensores y tomadores de decisiones.

Nuestro Top 10 de OWASP para Aplicaciones Agénticas (o OWASP Agentic Top 10) sirve como brújula y referencia principal para los líderes de seguridad y profesionales con el fin de comprender y abordar las 10 amenazas de mayor impacto, y comenzar su travesía.

Utiliza el formato estándar y popular de OWASP Top 10 para ofrecer orientación concisa, práctica y aplicable. Cada entrada incluye una breve descripción, vulnerabilidades comunes, escenarios de ejemplo y, lo más importante, mitigaciones prácticas que los equipos pueden comenzar a implementar hoy mismo.

Nuestro objetivo es simplificar y conectar la orientación existente, no contribuir a una saturación de directrices superpuestas. Nos vinculamos con nuestra taxonomía de Amenazas y Mitigaciones de la IA Agéntica (*Agentic AI Threats and Mitigations*), la cual sigue siendo nuestra taxonomía fundamental y detallada en la que se basa este Top 10.

Nuestro enfoque son las aplicaciones agénticas, pero estas no existirán de forma aislada, sino que formarán parte del desarrollo de una aplicación de LLM. Como resultado, nuestras entradas hacen referencia al Top 10 de OWASP para Aplicaciones de LLM y a otros estándares relevantes. Estos incluyen varios otros Top 10 de OWASP, el estándar CycloneDX, el Top 10 de Identidades No Humanas (NHI) y el Sistema de Puntuación de Vulnerabilidades de IA de OWASP (AIVSS) para la puntuación y priorización.

Los agentes amplifican las vulnerabilidades existentes. Profundizamos en los conceptos de Menor Privilegio (*Least-Privilege*) y Exceso de Agencia (*Excessive Agency*) introduciendo el concepto de Menor Agencia (*Least-Agency*). Esto encapsula nuestro consejo a las organizaciones de evitar la autonomía innecesaria; implementar un comportamiento agéntico donde no es necesario amplía la superficie de ataque sin aportar valor. De igual manera, una observabilidad sólida se vuelve indispensable: sin una visibilidad clara de lo que están haciendo los agentes, por qué lo están haciendo y qué herramientas están invocando, la autonomía innecesaria puede expandir silenciosamente la superficie de ataque y convertir problemas menores en fallos sistémicos.

Este documento es el resultado del trabajo de la comunidad global de OWASP. Docenas de expertos en seguridad de la industria, la academia y el gobierno aportaron investigación sobre amenazas, hallazgos de *red-team* y mitigaciones probadas en campo, con el apoyo de organizaciones que desarrollan plataformas agénticas, instituciones públicas y proveedores de productos.

La sección de Agradecimientos proporciona una lista de nuestros líderes de entrada, colaboradores, nuestra distinguida junta de revisión de expertos y las organizaciones que participaron en nuestra revisión, lo que nos permite incorporar perspectivas diversas del mundo real.

Les estamos muy agradecidos y continuaremos evolucionando utilizando nuestro enfoque impulsado por la comunidad y liderado por expertos de OWASP, basado en la colaboración abierta, la revisión por pares y la evidencia proveniente de investigaciones, *exploits*, incidentes y desafíos de despliegues en el mundo real.

Atentamente,

John Sotiropoulos, Miembro de la Junta del Proyecto OWASP GenAI Security y Co-líder de ASI, Presidente de Agentic Top 10

Keren Katz, Líder de Agentic Top 10, Proyecto OWASP GenAI Security - Equipo Principal de ASI

Ron F. Del Rosario, Miembro del Equipo Principal del Proyecto OWASP GenAI Security y Co-líder de ASI