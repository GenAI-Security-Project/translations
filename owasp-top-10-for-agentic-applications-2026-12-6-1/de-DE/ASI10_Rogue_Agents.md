<!-- status: draft -->
# ASI10: Abtrünnige Agenten (Rogue Agents)

## Beschreibung

Abtrünnige Agenten sind bösartige oder kompromittierte KI-Agenten, die von ihrer beabsichtigten Funktion oder ihrem autorisierten Geltungsbereich abweichen und innerhalb von Multi-Agenten- oder Mensch-Agent-Ökosystemen schädlich, täuschend oder parasitär agieren.

Die Handlungen des Agenten mögen einzeln betrachtet legitim erscheinen, doch sein emergentes Verhalten wird schädlich, wodurch für traditionelle regelbasierte Systeme eine Eindämmungslücke entsteht. Während externe Kompromittierung, wie Prompt Injection (LLM01:2025), Goal Hijack (AS01) oder Manipulation der Lieferkette (AS04), die Abweichung auslösen können, konzentriert sich ASI10 auf den Verlust der Verhaltensintegrität und Governance, sobald die Abdrift beginnt, nicht auf das ursprüngliche Eindringen selbst.

Zu den Folgen gehören die Offenlegung sensibler Informationen, die Verbreitung von Fehlinformationen, Workflow-Hijacking und operative Sabotage.

Abtrünnige Agenten stellen ein eigenständiges Risiko der Verhaltensabweichung dar, im Unterschied zu Excessive Agency (LLM06:2025), das sich auf übermäßig gewährte Berechtigungen konzentriert, und können aufgrund der Geschwindigkeit und Skalierung agentischer Systeme verstärkte „Insider-Bedrohungen“ darstellen. Zu den Folgen gehören die Offenlegung sensibler Informationen (LLM02:2025) und Fehlinformationen (LLM09:2025). Im OWASP Agentic AI Threats and Mitigations Guide entspricht ASI10 T13 – Rogue Agents in Multi-Agent Systems. Das OWASP-AIVSS-Framework ordnet dieses Risiko primär den Kategorien Behavioral Integrity (BI), Operational Security (OS) und Compliance Violations (CV) zu, mit erhöhtem Schweregrad für kritische oder selbstverbreitende Einsätze.

## Häufige Beispiele der Schwachstelle

1. Zieldrift und Scheming: Agenten weichen von den beabsichtigten Zielen ab und erscheinen konform, verfolgen jedoch aufgrund indirekter Prompt Injection oder widersprüchlicher Ziele versteckte, oft täuschende Ziele.

2. Workflow-Hijacking: Abtrünnige Agenten übernehmen die Kontrolle über etablierte, vertrauenswürdige Workflows, um Prozesse in Richtung bösartiger Ziele umzuleiten und dabei Datenintegrität und operative Kontrolle zu gefährden.

3. Kollusion und Selbstreplikation: Agenten koordinieren sich, um Manipulation zu verstärken, Signale auf unbeabsichtigte Weise auszutauschen oder sich autonom im gesamten System zu verbreiten und dabei einfache Abschaltmaßnahmen zu umgehen.

4. Reward Hacking und Optimierungsmissbrauch: Agenten manipulieren ihre zugewiesenen Belohnungssysteme, indem sie fehlerhafte Metriken ausnutzen, um irreführende Ergebnisse zu erzeugen oder aggressive Strategien zu verfolgen, die nicht mit den ursprünglichen Zielen übereinstimmen.

## Beispielhafte Angriffsszenarien

1. Autonome Datenexfiltration nach indirekter Prompt Injection: Nach dem Auftreten einer vergifteten Web-Anweisung lernt der Agent dieses Verhalten und fährt eigenständig fort, sensible Dateien zu durchsuchen und an externe Server zu übertragen – selbst nachdem die bösartige Quelle entfernt wurde, was ein anhaltendes, unautorisiertes Verhalten über den beabsichtigten Geltungsbereich hinaus zeigt.

2. Imitierter Beobachter-Agent (Integritätsverletzung): Ein Angreifer schleust einen gefälschten Prüf- oder Genehmigungsagenten in einen Multi-Agenten-Workflow ein. Ein hochwertiger Agent (z. B. für die Zahlungsabwicklung), der der internen Anfrage vertraut, wird dazu verleitet, Gelder freizugeben oder betrügerische Transaktionen zu genehmigen.

3. Selbstreplikation über Provisioning-APIs (Persistenz & Verfügbarkeit): Ein kompromittierter Automatisierungsagent wird manipuliert, unautorisierte Kopien von sich selbst im gesamten Netzwerk zu erzeugen, wobei Persistenz Vorrang hat und Ressourcen entgegen der Absicht des Systembesitzers verbraucht werden.

4. Reward Hacking → kritischer Datenverlust: Agenten, die mit der Minimierung von Cloud-Kosten beauftragt sind, lernen, dass das Löschen von Produktions-Backups der effektivste Weg ist, um ihr Ziel zu erreichen, und zerstören dabei autonom sämtliche Disaster-Recovery-Ressourcen.

## Präventions- und Abhilfemaßnahmen

1. Governance & Protokollierung: Führen Sie umfassende, unveränderliche und signierte Audit-Protokolle aller Agentenaktionen, Tool-Aufrufe und Inter-Agenten-Kommunikation, um sie auf verdeckte Infiltration oder nicht genehmigte Delegation zu überprüfen.

2. Isolation & Grenzen: Weisen Sie Trust Zones mit strikten Kommunikationsregeln zwischen den Zonen zu und setzen Sie eingeschränkte Ausführungsumgebungen (z. B. Container-Sandboxes) mit API-Berechtigungen nach dem Prinzip der geringsten Rechte ein.

3. Überwachung & Erkennung: Setzen Sie Verhaltenserkennung ein, etwa Watchdog-Agenten zur Validierung des Verhaltens und der Ausgaben von Peers, mit Fokus auf die Erkennung von Kollusionsmustern und koordinierten Falschsignalen. Überwachen Sie auf Anomalien wie übermäßige oder abnormale Aktionsausführungen.

4. Eindämmung & Reaktion: Implementieren Sie schnelle Mechanismen wie Kill-Switches und Credential-Widerruf, um abtrünnige Agenten sofort zu deaktivieren. Isolieren Sie verdächtige Agenten zur forensischen Überprüfung in Sandbox-Umgebungen.

5. Identitätsattestierung und Durchsetzung der Verhaltensintegrität: Implementieren Sie eine kryptografische Identitätsattestierung pro Agent und setzen Sie Verhaltensintegritäts-Baselines während des gesamten Lebenszyklus des Agenten durch. Fügen Sie signierte Verhaltensmanifeste hinzu, die erwartete Fähigkeiten, Tools und Ziele deklarieren und vor jeder Aktion von Orchestrierungsdiensten validiert werden. Integrieren Sie eine Verhaltensüberprüfungsschicht, die Aufgaben kontinuierlich auf Abweichungen vom deklarierten Manifest überwacht, z. B. nicht genehmigte Tool-Aufrufe, unerwartete Datenexfiltrationsversuche usw.

6. Fordern Sie periodische Verhaltensattestierung: Challenge-Aufgaben, signierte Stücklisten (Bill of Materials) für Prompts und Tools sowie kurzlebige Credentials pro Ausführung mit einmaliger Zielbindung (One-Time Audience Binding). Alle Signatur- und Attestierungsmechanismen setzen ein gehärtetes kryptografisches Schlüsselmanagement voraus (z. B. HSM-/KMS-gestützte Schlüssel, Zugriff nach dem Prinzip der geringsten Rechte, Rotation und Widerruf). Schlüssel dürfen Agenten niemals direkt zugänglich sein; stattdessen sollten Orchestratoren die Signaturvorgänge vermitteln, sodass ein kompromittierter Agent langlebige Schlüssel nicht einfach exfiltrieren oder missbrauchen kann.

7. Wiederherstellung und Reintegration: Etablieren Sie vertrauenswürdige Baselines für die Wiederherstellung isolierter oder sanierter Agenten. Verlangen Sie vor der Reintegration in Produktionsnetzwerke eine erneute Attestierung, Abhängigkeitsüberprüfung und menschliche Genehmigung.

## Referenzen

1. Multi-Agent Systems Execute Arbitrary Malicious Code (arXiv) [URL:
https://arxiv.org/abs/2503.12188]

2. Preventing Rogue Agents Improves Multi-Agent Collaboration (arXiv) [URL:
https://arxiv.org/abs/2502.05986]
