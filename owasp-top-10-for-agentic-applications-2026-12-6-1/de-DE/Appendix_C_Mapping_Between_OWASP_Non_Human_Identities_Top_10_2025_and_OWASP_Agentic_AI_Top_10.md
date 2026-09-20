<!-- status: draft -->
# Anhang C - Zuordnung zwischen OWASP Non-Human Identities Top 10 (2025) und OWASP Agentic AI Top 10

Die folgende Tabelle ordnet die Risiken der OWASP Non-Human Identities (NHI) Top 10 (2025) den Einträgen der

OWASP Agentic AI Top 10 (ASI), den Agentic-AI-Bedrohungen & Gegenmaßnahmen (T-Codes) sowie den

AIVSS-Kernrisikokategorien zu, um die Übereinstimmung zwischen identitätszentrierten und

agentenverhaltenszentrierten Risiken aufzuzeigen.

NHI-Risiko-ID / Kurzbeschreibung Zugeordnete ASI Zugeordnete Zugeordnete AIVSS-

Titel Top-10-Einträge T-Codes / Bedrohungen Kernrisiko-

& Gegenmaßnahmen Übereinstimmung

NHI1: Unsachgemäßes Versäumnis, nicht ASI04 – Agentic T17 Supply-Chain- Agent Supply Chain

Offboarding genutzte Supply Chain Kompromittierung · T2 & Dependency

Non-Human Vulnerabilities Tool Misuse Attacks

Identities zu

deaktivieren oder zu

entfernen, führt zu

einer dauerhaften

Angriffsfläche.

NHI2: Secret Offenlegung von API- ASI02 – Tool Misuse T6 Goal Memory Use &

Leakage Keys, Tokens oder & Exploitation · Manipulation · T1 Contextual

Zertifikaten, die von ASI06 – Memory & Memory Poisoning Awareness

Non-Human Context Poisoning

Identities

verwendet werden.

NHI3: Verwundbare Integrierte Drittanbieter- ASI04 – Supply T12 Agent Agent Supply Chain

Third-Party-NHI Identitäten werden Chain Communication & Dependency

kompromittiert und Vulnerabilities · Poisoning · T13 Attacks

ausgenutzt. ASI03 – Identity & Rogue Agents

Privilege Abuse

NHI4: Unsichere Schwache oder ASI03 – Identity & T16 Insecure Inter- Agent Access

Authentifizierung veraltete Privilege Abuse · Agent Protocol Control Violation

Authentifizierungs- ASI07 – Insecure Abuse

mechanismen für Inter-Agent

NHIs. Communication

NHI5: Non-Human Identitäten mit ASI02 – Tool Misuse T2 Tool Misuse · T3 Agent Access

Überprivilegierte übermäßigen & Exploitation · Privilege Control Violation

NHI Berechtigungen ASI03 – Identity & Compromise

ausgestattet. Privilege Abuse

NHI6: Unsichere Fehlkonfigurierte ASI04 – Supply T11 Unexpected RCE Insecure Agent

Cloud- CI/CD- und Chain & Code Attacks Critical Systems

Bereitstellungs- Cloud-Setups mit Vulnerabilities · Interaction

konfigurationen statischen ASI05 – Unexpected

Anmeldedaten. Code Execution

(RCE)

NHI7: Anmeldedaten oder ASI06 – Memory & T4 Memory Overload Memory Use &

Langlebige Secrets Keys mit langer Context Poisoning · · T12 Shared Memory Contextual

Gültigkeitsdauer ASI08 – Cascading Poisoning Awareness

erhöhen die Failures

Verweildauer des

Angreifers.

NHI8: Fehlende Wiederverwendung ASI08 – Cascading T8 Repudiation & Agent Cascading

Umgebungs- von NHIs über Failures · ASI07 – Untraceability · T12 Failures

isolation Dev-/Test-/Prod- Insecure Inter- Agent

Umgebungen Agent Communication

hinweg ermöglicht Communication Poisoning

laterale Bewegung.

NHI9: NHI- Wiederverwendung ASI08 – Cascading T5 Cascading Agent Cascading

Wiederverwendung derselben NHI über Failures · ASI04 – Hallucination Failures

mehrere Dienste Supply Chain Attacks · T13 Rogue

hinweg verstärkt die Vulnerabilities Agents

Auswirkung einer

Kompromittierung.

NHI10: Menschliche Menschen, die Non- ASI09 – Human- T10 Overwhelming Agent

Nutzung von NHI Human-Credentials Agent Trust Human in the Loop · Untraceability /

verwenden, Exploitation · ASI01 T7 Misaligned & Human

verursachen Verlust – Agent Goal Hijack Deceptive Manipulation

der Behaviors

Rechenschaftspflicht

und Missbrauch von

Berechtigungen.
