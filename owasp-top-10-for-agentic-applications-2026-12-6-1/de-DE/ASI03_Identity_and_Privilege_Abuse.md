<!-- status: draft -->
# ASI03: Identitäts- und Privilegienmissbrauch (Identity and Privilege Abuse)

## Beschreibung

Identitäts- und Privilegienmissbrauch nutzt dynamisches Vertrauen und Delegation in Agenten aus, um Zugriff zu eskalieren und Kontrollen zu umgehen, indem Delegationsketten, Rollenvererbung, Kontrollflüsse und Agentenkontext manipuliert werden; der Kontext umfasst zwischengespeicherte Anmeldedaten oder Konversationsverläufe über miteinander verbundene Systeme hinweg. In diesem Zusammenhang bezieht sich Identität sowohl auf die definierte Persona des Agenten als auch auf jegliches Authentifizierungsmaterial, das ihn repräsentiert. Agent-zu-Agent-Vertrauen oder vererbte Anmeldedaten können ausgenutzt werden, um Zugriff zu eskalieren, Privilegien zu kapern oder nicht autorisierte Aktionen auszuführen.

Dieses Risiko entsteht durch die architektonische Diskrepanz zwischen nutzerzentrierten Identitätssystemen und agentischem Design. Ohne eine eigene, klar geregelte Identität operiert ein Agent in einer Attributionslücke, die die Durchsetzung echter minimaler Rechtevergabe (Least Privilege) unmöglich macht. Identität umfasst in diesem Kontext sowohl die zugewiesene Persona des Agenten als auch jegliches Authentifizierungsmaterial (API-Schlüssel, OAuth-Tokens, delegierte Nutzersitzungen), das ihn repräsentiert.

Dies unterscheidet sich vom Szenario in ASI02 (Tool Misuse), bei dem es sich um eine unbeabsichtigte oder unsichere Nutzung bereits gewährter Privilegien durch einen Principal handelt, der seine eigenen Tools missbraucht.

Identitäts- und Privilegienmissbrauch ist die agentische Weiterentwicklung von Excessive Agency (LLM06:2025). Er nutzt häufig Prompt Injection (LLM01:2025), und aufgrund von Agentenberechtigungen, Tool-Integrationen und Multi-Agenten-Systemen kann die Auswirkung verstärkt werden und über Sensitive Information Disclosure (LLM02:2025) hinausgehen, um direkt die Vertraulichkeit, Integrität und Verfügbarkeit von Systemen und Daten zu gefährden, auf die der Agent zugreifen kann.

In den OWASP ASI Threats and Mitigations entspricht dies eins zu eins T3: Privilege Compromise, und in OWASP AIVSS entspricht es Core Risk 2: Agent Access Control Violation.

## Häufige Beispiele der Schwachstelle

1. Ungebundene Privilegienvererbung (Un-scoped Privilege Inheritance). Tritt auf, wenn ein hochprivilegierter Manager Aufgaben delegiert, ohne eine Beschränkung nach dem Prinzip der minimalen Rechtevergabe anzuwenden – oft aus Bequemlichkeit oder aufgrund architektonischer Einschränkungen – und dabei seinen gesamten Zugriffskontext weitergibt. Ein eng begrenzter Worker erhält dadurch übermäßige Rechte. Low- oder No-Code-Agenten mit Standardprivilegien, wie uneingeschränktem Internetzugang, erben ebenfalls mehr Berechtigungen als beabsichtigt.

2. Speicherbasierte Privilegienbeibehaltung & Datenleck (Memory-Based Privilege Retention & Data Leakage). Entsteht, wenn Agenten Anmeldedaten, Schlüssel oder abgerufene Daten zur Kontexterhaltung und Wiederverwendung zwischenspeichern. Wenn der Speicher zwischen Aufgaben oder Nutzern nicht segmentiert oder gelöscht wird,

genai.owasp.org

können Angreifer den Agenten dazu bringen, zwischengespeicherte Geheimnisse wiederzuverwenden, Privilegien zu eskalieren oder Daten aus einer vorherigen sicheren Sitzung in eine schwächere zu leaken.

3. Ausnutzung von Cross-Agent-Vertrauen (Confused Deputy). In Multi-Agenten-Systemen vertrauen Agenten internen Anfragen häufig standardmäßig. Ein kompromittierter, niedrig privilegierter Agent kann glaubwürdig wirkende Anweisungen an einen hochprivilegierten Agenten weiterleiten, der diese ausführt, ohne die ursprüngliche Absicht des Nutzers erneut zu prüfen – wodurch seine erhöhten Berechtigungen missbraucht werden.

4. Time-of-Check to Time-of-Use (TOCTOU) in Agenten-Workflows. Berechtigungen werden möglicherweise zu Beginn eines Workflows überprüft, ändern sich jedoch oder laufen ab, bevor die Ausführung erfolgt. Der Agent fährt mit der veralteten Autorisierung fort und führt Aktionen aus, die der Nutzer nicht mehr genehmigen darf.

5. Injektion synthetischer Identität (Synthetic Identity Injection). Angreifer geben sich als interne Agenten aus, indem sie unverifizierte Bezeichnungen (z. B. „Admin Helper“) verwenden, um vererbtes Vertrauen zu erlangen und privilegierte Aktionen unter einer erfundenen Identität auszuführen.

## Beispielhafte Angriffsszenarien

1. Missbrauch delegierter Privilegien: Ein Finanz-Agent delegiert an einen „DB-Abfrage“-Agenten,

gibt dabei aber alle seine Berechtigungen weiter. Ein Angreifer, der die Abfrage-Prompts steuert,

nutzt den vererbten Zugriff, um HR- und Rechtsdaten zu exfiltrieren.

2. Speicherbasierte Eskalation: Ein IT-Admin-Agent speichert während eines Patch-Vorgangs

SSH-Anmeldedaten zwischen. Später verwendet ein Nicht-Administrator dieselbe Sitzung erneut

und bringt ihn dazu, diese Anmeldedaten zu nutzen, um ein nicht autorisiertes Konto zu erstellen.

3. Ausnutzung von Cross-Agent-Vertrauen: Eine gefälschte E-Mail von der IT weist einen

E-Mail-Sortier-Agenten an, einen Finanz-Agenten anzuweisen, Geld auf ein bestimmtes Konto zu

überweisen. Der Sortier-Agent leitet dies weiter, und der Finanz-Agent, der einem internen

Agenten vertraut, verarbeitet die betrügerische Zahlung ohne Verifizierung.

4. Geräte-Code-Phishing über Agenten hinweg: Ein Angreifer teilt einen Geräte-Code-Link, dem

- -

ein Browsing-Agent folgt; ein separater „Helfer“-Agent vervollständigt den Code und bindet den

Tenant des Opfers an vom Angreifer kontrollierte Scopes.

5. Workflow-Autorisierungsdrift: Ein Beschaffungs-Agent überprüft die Genehmigung zu Beginn

einer Kaufsequenz. Stunden später wird das Ausgabelimit des Nutzers reduziert, aber der

Workflow fährt mit dem alten Autorisierungstoken fort und schließt die nun nicht autorisierte

Transaktion ab.

6. Gefälschte Agenten-Persona: Ein Angreifer registriert einen gefälschten „Admin Helper“-Agenten

in einem internen Agent2Agent-Register mit einer gefälschten Agent-Karte. Andere Agenten, die

der Beschreibung vertrauen, leiten privilegierte Wartungsaufgaben an ihn weiter. Der vom

Angreifer kontrollierte Agent erteilt daraufhin Systembefehle unter angenommenem internen

Vertrauen.

7. Identitätsfreigabe (Identity Sharing). Ein Agent erhält im Namen eines Nutzers, oft seines

Erstellers, Zugriff auf Systeme. Er ermöglicht anderen Nutzern dann implizit, diese Identität zu

nutzen, indem sie seine Tools als diese Identität aufrufen.

genai.owasp.org

## Präventions- und Minderungsrichtlinien

1. Aufgabenbezogene, zeitlich begrenzte Berechtigungen durchsetzen: Kurzlebige, eng

begrenzte Tokens pro Aufgabe ausstellen und Rechte durch Berechtigungsgrenzen begrenzen –

unter Verwendung von Identitäten pro Agent und kurzlebigen Anmeldedaten (z. B. mTLS-Zertifikate

oder begrenzte Tokens) –, um den Schadensradius zu begrenzen, delegierten Missbrauch und

Angriffe im Wartungsfenster zu blockieren sowie ungebundene Vererbung, verwaiste Privilegien

und Eskalation durch Reflection-Loops zu mindern.

2. Agentenidentitäten und -kontexte isolieren: Sitzungsbezogene Sandboxes mit getrennten

Berechtigungen und Speichern betreiben und den Zustand zwischen Aufgaben löschen, um

speicherbasierte Eskalation zu verhindern und repository-übergreifende Datenexfiltration zu

reduzieren.

3. Autorisierung pro Aktion vorschreiben: Jeden privilegierten Schritt mit einer zentralisierten

Richtlinien-Engine erneut verifizieren, die externe Daten prüft, um Ausnutzung von

Cross-Agent-Vertrauen und Eskalation durch Reflection-Loops zu stoppen.

4. Human-in-the-Loop bei Privilegieneskalation anwenden: Menschliche Genehmigung für

hochprivilegierte oder irreversible Aktionen verlangen, um ein Sicherheitsnetz zu bieten, das

speicherbasierte Eskalation, Ausnutzung von Cross-Agent-Vertrauen und Angriffe im

Wartungsfenster stoppen würde.

5. Absicht definieren: OAuth-Tokens an eine signierte Absichtserklärung binden, die Subjekt,

Zielgruppe, Zweck und Sitzung enthält. Jede Token-Nutzung ablehnen, bei der die gebundene

Absicht nicht mit der aktuellen Anfrage übereinstimmt.

6. Plattformen für agentisches Identitätsmanagement evaluieren. Große Plattformen integrieren

Agenten in ihre Identitäts- und Zugriffsmanagementsysteme und behandeln sie als verwaltete

nicht-menschliche Identitäten mit begrenzten Anmeldedaten, Audit-Trails und

Lebenszyklus-Kontrollen. Beispiele sind Microsoft Entra, AWS Bedrock Agents, Salesforce

Agentforce, Workdays Agentic System of Record (ASOR)-Modell und ähnliche neu entstehende

Muster in Google Vertex AI.

7. Berechtigungen an Subjekt, Ressource, Zweck und Dauer binden. Erneute Authentifizierung

bei Kontextwechsel verlangen. Privilegienvererbung zwischen Agenten verhindern, es sei denn, die

ursprüngliche Absicht wird erneut validiert. Automatisierten Widerruf bei Inaktivität oder Anomalien

einbeziehen.

8. Delegierte und transitive Berechtigungen erkennen: Überwachen, wann ein Agent indirekt

durch Delegationsketten neue Berechtigungen erhält. Fälle kennzeichnen, in denen ein niedrig

privilegierter Agent während Multi-Agenten-Workflows höher privilegierte Scopes erbt oder

zugewiesen bekommt.

9. Abnormale Cross-Agent-Privilegieneskalation und Phishing-Abläufe nach Art von

Geräte-Codes erkennen, indem überwacht wird, wann Agenten neue Scopes anfordern oder

Tokens außerhalb ihrer ursprünglichen, signierten Absicht wiederverwenden.

## Referenzen

1. https://research.aimultiple.com/agentic-ai-cybersecurity/
2. https://www.docker.com/blog/mcp-horror-stories-github-prompt-injection/
3. https://css.csail.mit.edu/6.858/2015/readings/confused-deputy.html
4. 15 Ways to Break Your Copilot, BHUSA 2024
5. NVD - cve-2025-31491

genai.owasp.org