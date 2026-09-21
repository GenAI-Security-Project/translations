<!-- status: draft -->
# ASI08: Kaskadierende Ausfälle (Cascading Failures)

## Beschreibung

Agentische kaskadierende Ausfälle treten auf, wenn sich ein einzelner Fehler (Halluzination, bösartige Eingabe, kompromittiertes Tool oder vergiftetes Gedächtnis) über autonome Agenten hinweg ausbreitet und sich zu einem systemweiten Schaden aufsummiert. Da Agenten autonom planen, persistieren und delegieren, kann ein einzelner Fehler schrittweise menschliche Kontrollen umgehen und in einem gespeicherten Zustand fortbestehen. Wenn Agenten neue emergente Verbindungen zu Tools oder Peers eingehen, verketten sich diese latenten Fehler zu privilegierten Operationen, die Vertraulichkeit, Integrität und Verfügbarkeit kompromittieren – was zu weitverbreiteten Dienstausfällen über Agentennetzwerke, Systeme und Workflows hinweg führt.

Kaskadierende Ausfälle beschreiben die Ausbreitung und Verstärkung eines ursprünglichen Fehlers – nicht die ursprüngliche Schwachstelle selbst – über Agenten, Tools und Workflows hinweg, wodurch ein einzelner Fehler zu einer systemweiten Auswirkung wird.

ASI08 konzentriert sich auf die Ausbreitung und Verstärkung von Fehlern und nicht auf deren Ursprung. Verwenden Sie den ursprünglichen Defekt unter ASI04, ASI06 oder ASI07, wenn er eine direkte Kompromittierung darstellt – wie eine kontaminierte Abhängigkeit, ein vergiftetes Gedächtnis oder eine gefälschte Nachricht – und wenden Sie ASI08 nur an, wenn sich dieser Defekt über Agenten, Sitzungen oder Workflows hinweg ausbreitet und dabei messbare Verzweigung (Fan-out) oder systemische Auswirkungen über die ursprüngliche Verletzung hinaus verursacht.

Beobachtbare Symptome umfassen schnelle Verzweigung (Fan-out), bei der eine fehlerhafte Entscheidung viele nachgelagerte Agenten oder Aufgaben in kurzer Zeit auslöst, domänen- oder mandantenübergreifende Ausbreitung über den ursprünglichen Kontext hinaus, oszillierende Wiederholungsversuche oder Rückkopplungsschleifen zwischen Agenten sowie nachgelagerte Warteschlangenstürme oder wiederholte identische Absichten – all dies liefert klare Erkennungsansätze, die ASI08 operativ handhabbar machen.

Kaskadierende Ausfälle verstärken sich über vernetzte Agenten hinweg und verketten Risiken der OWASP LLM Top 10. LLM01:2025 Prompt Injection und LLM06:2025 Excessive Agency können autonome Tool-Ausführungen auslösen, die Fehler ohne menschliche Kontrollen verbreiten, während LLM04:2025 Data and Model Poisoning im persistenten Gedächtnis Entscheidungen über Sitzungen und Workflows hinweg verzerren kann. Agentic AI – Threats and Mitigations 1.1 behandelt diese Bedrohung in T5 – Cascading Hallucination Attacks, während T8 – Repudiation and Untraceability eine grundlegende Verteidigung hervorhebt: die Fähigkeit, kaskadierendes Verhalten durch belastbare Protokollierung und Nichtabstreitbarkeitsmechanismen (Non-Repudiation), die stille Ausbreitung verhindern, nachzuverfolgen, zuzuordnen und zu überprüfen. Diese sich aufsummierenden Bedrohungen verdeutlichen jedoch eine potenzielle Diskrepanz zwischen der Geschwindigkeit und dem Ausmaß der Fehlerausbreitung in einem Multi-Agenten-System und der Fähigkeit von Menschen, damit Schritt zu halten, um einen sicheren und effektiven Betrieb des Systems zu gewährleisten. Dies hinterlässt einige nicht gemilderte Risiken, die das Unternehmen sorgfältig bewerten muss, um sicherzustellen, dass sie innerhalb des gesamten Risikobudgets der Organisation liegen.

## Häufige Beispiele der Schwachstelle

1. Kopplung von Planer und Ausführer: Ein halluzinierender oder kompromittierter Planer gibt unsichere Schritte aus, die der Ausführer automatisch ohne Validierung durchführt, wodurch sich die Auswirkung über Agenten hinweg vervielfacht.

2. Korrumpiertes persistentes Gedächtnis: Vergiftete langfristige Ziele oder Zustandseinträge beeinflussen weiterhin neue Pläne und Delegationen und verbreiten denselben Fehler auch dann, wenn die ursprüngliche Quelle nicht mehr existiert.

3. Agentenübergreifende Kaskaden durch vergiftete Nachrichten: Eine einzelne korrumpierte Aktualisierung führt dazu, dass Peer-Agenten auf falsche Warnmeldungen oder Neustartanweisungen reagieren und die Störung über Regionen hinweg verbreiten.

4. Kaskadierender Tool-Missbrauch und Privilegieneskalation: Der Missbrauch einer Integration oder eines erhöhten Anmeldedatensatzes durch einen Agenten führt dazu, dass nachgelagerte Agenten unsichere Aktionen wiederholen oder vererbte Daten preisgeben.

5. Auto-Deployment-Kaskade durch kontaminiertes Update: Eine von einem Orchestrator ausgerollte vergiftete oder fehlerhafte Version verbreitet sich automatisch auf alle verbundenen Agenten und verstärkt die Verletzung über ihren Ursprung hinaus.

6. Governance-Drift-Kaskade: Die menschliche Aufsicht schwächt sich nach wiederholtem Erfolg ab; Massengenehmigungen oder gelockerte Richtlinien verbreiten ungeprüfte Konfigurationsabweichungen über Agenten hinweg.

7. Verstärkung durch Rückkopplungsschleifen: Zwei oder mehr Agenten verlassen sich auf die Ausgaben des jeweils anderen, wodurch eine sich selbst verstärkende Schleife entsteht, die anfängliche Fehler oder Fehlalarme vergrößert.

## Beispiele für Angriffsszenarien

1. Kaskade im Finanzhandel: Prompt Injection (LLM01:2025) vergiftet einen Marktanalyse-Agenten und bläht Risikogrenzen auf; Positions- und Ausführungsagenten handeln automatisch größere Positionen, während die Compliance-Funktion für „parameterkonforme“ Aktivitäten blind bleibt.

2. Ausbreitung von Behandlungsprotokollen im Gesundheitswesen: Lieferkettenmanipulation gemäß ASI04 korrumpiert Arzneimitteldaten; die Behandlung passt Protokolle automatisch an, und die Versorgungskoordination verbreitet sie netzwerkweit ohne menschliche Überprüfung.

3. Zusammenbruch der Cloud-Orchestrierung: LLM04:2025-Vergiftung in der Ressourcenplanung fügt nicht autorisierte Berechtigungen und unnötigen Overhead hinzu; Sicherheit wendet sie an, und Deployment stellt mit Backdoors versehene, kostspielige Infrastruktur ohne Genehmigung pro Änderung bereit.

4. Kompromittierung des Sicherheitsbetriebs: Gestohlene Dienstanmeldedaten – über LLM06:2025 und LLM03:2025 – führen dazu, dass Erkennungsabwehrmechanismen echte Alarme als falsch markieren, das Incident-Response-Team Kontrollen deaktiviert und Protokolle löscht, und die Compliance-Berichterstattung saubere Kennzahlen meldet.

5. Ausfall der Qualitätskontrolle (QC) in der Fertigung: ASI06-Gedächtnisinjektion mit LLM08:2025-vergiftetem Wissen führt dazu, dass die QC fehlerhafte Teile genehmigt und gute Teile ablehnt; Inventar und Terminplanung optimieren auf Basis fehlerhafter Daten, was zu fehlerhaften Lieferungen und Verlusten führt.

6. Rückkopplungsschleife bei der automatischen Fehlerbehebung: Ein Remediation-Agent unterdrückt Warnmeldungen, um Latenz-SLAs einzuhalten; ein Planungsagent interpretiert weniger Warnmeldungen als Erfolg und weitet die Automatisierung aus, was potenziell blinde Flecken über Regionen hinweg verstärkt.

7. Ein regionaler Ausfall des Cloud-DNS bei einem Hyperscaler kann gleichzeitig mehrere KI-Dienste beeinträchtigen, die davon abhängen, und so eine Kaskade von Agentenausfällen über viele Organisationen hinweg verursachen.

8. Agentische Cyberabwehrsysteme und Firewalls: Die Ausbreitung einer Halluzination über einen bevorstehenden Angriff oder eine eingeschleuste Falschmeldung breitet sich in den zugrunde liegenden Multi-Agenten-Systemen aus und verursacht unnötige, aber katastrophale Verteidigungsmaßnahmen wie Abschaltungen, Verweigerungen und Netzwerktrennungen.

## Präventions- und Minderungsrichtlinien

1. Zero-Trust-Modell im Anwendungsdesign: Systemgestaltung mit Fehlertoleranz, die von einem Verfügbarkeitsausfall von LLM:2025-, agentischen Funktionskomponenten und externen Quellen ausgeht.

2. Isolierung und Vertrauensgrenzen: Sandboxing von Agenten, geringstmögliche Rechtevergabe, Netzwerksegmentierung, eingegrenzte APIs und gegenseitige Authentifizierung, um die Ausbreitung von Fehlern einzudämmen.

3. Just-in-Time-, einmaliger Tool-Zugriff mit Laufzeitprüfungen: Ausgabe kurzlebiger, aufgabengebundener Anmeldedaten für jeden Agentenlauf und Validierung jedes wirkungsstarken Tool-Aufrufs gegen eine Policy-as-Code-Regel vor der Ausführung. Dies stellt sicher, dass ein kompromittierter oder abweichender Agent keine Kettenreaktionen über andere Agenten oder Systeme hinweg auslösen kann.

4. Unabhängige Richtliniendurchsetzung: Trennung von Planung und Ausführung durch eine externe Policy-Engine, um zu verhindern, dass korrupte Planung schädliche Aktionen auslöst.

5. Ausgabevalidierung und menschliche Kontrollpunkte: Checkpoints, Governance-Agenten oder menschliche Überprüfung bei hohem Risiko, bevor Agentenausgaben nachgelagert weiterverbreitet werden.

6. Ratenbegrenzung und Überwachung: Erkennung sich schnell ausbreitender Befehle und Drosselung oder Pausierung bei Anomalien.

7. Implementierung von Schadensradius-Schutzmaßnahmen (Blast-Radius Guardrails) wie Quoten, Fortschrittsobergrenzen und Circuit Breakern zwischen Planer und Ausführer.

8. Erkennung von Verhaltens- und Governance-Drift: Verfolgung von Entscheidungen im Vergleich zu Baselines und Ausrichtung; Kennzeichnung schrittweiser Verschlechterung.

9. Digital-Twin-Replay und Policy-Gating: Erneute Ausführung der aufgezeichneten Agentenaktionen der letzten Woche in einem isolierten Klon der Produktionsumgebung, um zu testen, ob dieselbe Abfolge kaskadierende Ausfälle auslösen würde. Erweiterung von Richtlinien nur dann zulassen, wenn diese Replay-Tests vordefinierte Schadensradius-Obergrenzen vor dem Deployment bestehen.

10. Protokollierung und Nichtabstreitbarkeit (Non-Repudiation): Aufzeichnung aller agentenübergreifenden Nachrichten, Richtlinienentscheidungen und Ausführungsergebnisse in manipulationssicheren, zeitgestempelten Protokollen, die an kryptografische Agentenidentitäten gebunden sind. Führen Sie Abstammungsmetadaten (Lineage-Metadaten) für jede weiterverbreitete Aktion, um forensische Nachverfolgbarkeit, Rollback-Validierung und Rechenschaftspflicht während Kaskaden zu unterstützen.

## Referenzen

1. https://sre.google/sre-book/addressing-cascading-failures/

2.

https://cwe.mitre.org/data/definitions/400.html
