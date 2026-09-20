<!-- status: draft -->
# ASI06: Speicher- und Kontextvergiftung (Memory & Context Poisoning)

## Beschreibung

Agentische Systeme stützen sich auf gespeicherte und abrufbare Informationen, die einen Schnappschuss ihres Konversationsverlaufs, ein Speicher-Tool oder erweiterten Kontext darstellen können, was Kontinuität über Aufgaben und Reasoning-Zyklen hinweg unterstützt. Kontext umfasst alle Informationen, die ein Agent behält, abruft oder wiederverwendet, wie z. B. Zusammenfassungen, Embeddings und RAG-Speicher, schließt jedoch einmalige Eingabeprompts aus, die unter LLM01:2025 Prompt Injection behandelt werden.

Bei Speicher- und Kontextvergiftung korrumpieren oder speisen Angreifer diesen Kontext mit bösartigen oder irreführenden Daten, wodurch zukünftiges Reasoning, Planung oder Tool-Nutzung verzerrt, unsicher oder zur Exfiltration beitragend werden. Ingestionsquellen wie Uploads, API-Feeds, Benutzereingaben oder Peer-Agent-Austausch können nicht vertrauenswürdig oder nur teilweise validiert sein.

Dieses Risiko unterscheidet sich von ASI01 (Goal Hijack), das direkte Zielmanipulation erfasst, und ASI08 (Cascading Failures), das die Degradation nach erfolgter Vergiftung beschreibt. Speichervergiftung führt jedoch häufig zu Zielentführung (ASI01), da korrumpierter Kontext oder Langzeitgedächtnis die Zielinterpretation, den Reasoning-Pfad oder die Tool-Auswahllogik des Agenten verändern kann.

Es baut auf LLM01:2025 Prompt Injection, LLM04:2025 Data and Model Poisoning und LLM08:2025 Vector and Embedding Weaknesses auf, konzentriert sich jedoch auf die dauerhafte Korruption des Agentengedächtnisses und abrufbaren Kontexts, die sich über Sitzungen hinweg fortpflanzt und autonomes Reasoning verändert.

Es ordnet sich T1 Memory Poisoning in Agentic Threats and Mitigations zu, mit verwandten Auswirkungen in T4 Memory Overload, T6 Broken Goals und T12 Shared Memory Poisoning. In AIVSS erhöhen die AARS-Felder Memory Use und Contextual Awareness den agentischen Schwachstellenwert.

## Häufige Beispiele der Schwachstelle

1. Vergiftung von RAG und Embeddings: Bösartige oder manipulierte Daten gelangen über vergiftete Quellen, direkte Uploads oder übermäßig vertrauenswürdige Pipelines in die Vektordatenbank. Dies führt zu falschen Antworten, die als gezielte Payloads betrachtet werden.

2. Vergiftung des gemeinsam genutzten Benutzerkontexts: Wiederverwendete oder gemeinsam genutzte Kontexte ermöglichen es Angreifern, über normale Chats Daten einzuschleusen, die spätere Sitzungen beeinflussen. Zu den Auswirkungen zählen Fehlinformationen, unsichere Codeausführung oder fehlerhafte Tool-Aktionen.

Page 24

genai.owasp.org

3. Manipulation des Kontextfensters: Ein Angreifer schleust präparierte Inhalte in eine laufende Konversation oder Aufgabe ein, sodass diese später zusammengefasst oder im Gedächtnis gespeichert werden und zukünftiges Reasoning oder Entscheidungen kontaminieren, selbst nachdem die ursprüngliche Sitzung beendet ist.

4. Langzeitgedächtnis-Drift: Schrittweise Aussetzung gegenüber subtil verfälschten Daten, Zusammenfassungen oder Peer-Agent-Feedback verschiebt allmählich gespeichertes Wissen oder Zielgewichtung und erzeugt im Laufe der Zeit Verhaltens- oder Richtlinienabweichungen.

5. Systemische Fehlausrichtung und Backdoors: Vergiftetes Gedächtnis verschiebt die Persona des Modells und pflanzt triggerbasierte Backdoors ein, die versteckte Anweisungen ausführen, wie zerstörerischen Code oder Datenlecks.

6. Agentenübergreifende Ausbreitung: Kontaminierter Kontext oder gemeinsam genutztes Gedächtnis breitet sich zwischen kooperierenden Agenten aus, verstärkt die Korruption und ermöglicht langfristige Datenlecks oder koordinierte Drift.

## Beispiel-Angriffsszenarien

1. Vergiftung des Reisebuchungsgedächtnisses: Ein Angreifer verstärkt kontinuierlich einen gefälschten Flugpreis, der Assistent speichert ihn als Wahrheit, genehmigt dann Buchungen zu diesem Preis und umgeht Zahlungsprüfungen.

2. Ausnutzung des Kontextfensters: Der Angreifer verteilt Versuche auf mehrere Sitzungen, sodass frühere Ablehnungen aus dem Kontext herausfallen, und die KI gewährt schließlich eskalierende Berechtigungen bis hin zum Administratorzugriff.

3. Speichervergiftung für System: Der Angreifer trainiert das Gedächtnis einer Sicherheits-KI so um, dass bösartige Aktivitäten als normal eingestuft werden, wodurch Angriffe unentdeckt durchschlüpfen.

4. Vergiftung des gemeinsam genutzten Gedächtnisses: Der Angreifer fügt in das gemeinsam genutzte Gedächtnis gefälschte Rückerstattungsrichtlinien ein, andere Agenten übernehmen diese, und das Unternehmen erleidet Fehlentscheidungen, Verluste und Streitigkeiten.

5. Mandantenübergreifendes Vektor-Bleed: Von einem Angreifer eingebrachte, nahezu identische Inhalte nutzen lockere

- -

Namespace-Filter aus und ziehen durch hohe Kosinus-Ähnlichkeit sensible Chunks eines anderen Mandanten in den Abruf hinein.

6. Vergiftung des Assistentengedächtnisses: Ein Angreifer implantiert über Indirect Prompt Injection Inhalte in das Gedächtnis eines Benutzerassistenten und kompromittiert damit die aktuellen und zukünftigen Sitzungen dieses Benutzers.

## Präventions- und Abhilfemaßnahmen

1. Grundlegender Datenschutz: Verschlüsselung während der Übertragung und im Ruhezustand kombiniert mit Zugriff nach dem Prinzip der geringsten Rechte.

2. Inhaltsvalidierung: Alle neuen Speicherschreibvorgänge und Modellausgaben (Regeln + KI) vor dem Commit auf bösartige oder sensible Inhalte scannen.

3. Speichersegmentierung: Benutzersitzungen und Domänenkontexte isolieren, um Wissens- und Datenlecks zu verhindern.

4. Zugriff und Aufbewahrung: Nur authentifizierte, kuratierte Quellen zulassen; kontextbewussten Zugriff pro Aufgabe durchsetzen; Aufbewahrung entsprechend der Datensensibilität minimieren.

5. Herkunft und Anomalien: Quellenzuordnung verlangen und verdächtige Aktualisierungen oder Häufigkeiten erkennen.

Page 25

genai.owasp.org

6. Automatische Wiedereinspeisung der von einem Agenten selbst generierten Ausgaben in das vertrauenswürdige Gedächtnis verhindern, um selbstverstärkende Kontamination oder „Bootstrap-Vergiftung“ zu vermeiden.

7. Resilienz und Verifikation: Adversariale Tests durchführen, Snapshots/Rollback und Versionskontrolle verwenden und bei risikoreichen Aktionen eine menschliche Überprüfung verlangen. Wo Sie gemeinsam genutzte Vektor- oder Speicherstores betreiben, mandantenspezifische Namespaces und Vertrauenswerte für Einträge verwenden, unverifiziertes Gedächtnis mit der Zeit verfallen lassen oder ablaufen lassen und Rollback/Quarantäne bei Verdacht auf Vergiftung unterstützen.

8. Unverifiziertes Gedächtnis ablaufen lassen, um die Persistenz von Vergiftungen zu begrenzen.

9. Abruf nach Vertrauen und Mandantenzugehörigkeit gewichten: Zwei Faktoren verlangen, um Gedächtnis mit hoher Wirkung sichtbar zu machen (z. B. Herkunftsbewertung plus menschlich verifizierte Kennzeichnung), und Einträge mit geringem Vertrauen im Laufe der Zeit abklingen lassen.

## Referenzen

1. New hack uses prompt injection to corrupt Gemini's long-term memory,

https://arstechnica.com/security/2025/02/new-hack-uses-prompt-injection-to-corrupt-geminis-

long-term-memory/

2. Attackers Can Manipulate AI Memory to Spread Lies, https://www.bankinfosecurity.com/attackers-

manipulate-ai-memory-to-spread-lies-a-27699

3. Poisoned RAG, https://arxiv.org/pdf/2402.07867

4. AgentPoison: Red-teaming LLM Agents via Poisoning Memory or Knowledge Bases,

https://arxiv.org/abs/2407.12784

5. Securing Agentic AI: A Comprehensive Threat Model and Mitigation Framework for Generative AI

Agents, https://arxiv.org/pdf/2504.19956

6. Dynamic Cheatsheet: Test Time Learning with Adaptive Memory,

-

https://arxiv.org/abs/2504.07952v1

7. Memento: Fine-tuning LLM Agents without Fine-tuning LLMs, https://arxiv.org/abs/2508.16153

8. AgentFlayer: persistent 0click exploit on ChatGPT.

9. Hacker plants false memories in ChatGPT to steal user data in perpetuity

10. The Trifecta: How Three New Gemini Vulnerabilities in Cloud Assist, Search Model, and Browsing

Allowed Private Data Exfiltration

Page 26

genai.owasp.org