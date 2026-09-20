<!-- status: draft -->
# ASI07: Unsichere Inter-Agenten-Kommunikation (Insecure Inter-Agent Communication)

## Beschreibung

Multi-Agenten-Systeme sind auf eine kontinuierliche Kommunikation zwischen autonomen Agenten angewiesen, die sich über APIs, Message-Busse und gemeinsam genutzten Speicher koordinieren, was die Angriffsfläche erheblich vergrößert. Dezentrale Architektur, unterschiedliche Autonomiegrade und ungleichmäßiges Vertrauen machen perimeterbasierte Sicherheitsmodelle unwirksam. Schwache Inter-Agenten-Kontrollen für Authentifizierung, Integrität, Vertraulichkeit oder Autorisierung ermöglichen es Angreifern, Nachrichten abzufangen, zu manipulieren, zu fälschen oder zu blockieren.

Unsichere Inter-Agenten-Kommunikation tritt auf, wenn diesen Austauschprozessen eine angemessene Authentifizierung, Integrität oder semantische Validierung fehlt – wodurch das Abfangen, Fälschen oder Manipulieren von Agentennachrichten und -absichten ermöglicht wird. Die Bedrohung erstreckt sich über Transport-, Routing-, Discovery- und semantische Ebenen, einschließlich verdeckter Kanäle oder Seitenkanäle, über die Agenten Daten durch Timing- oder Verhaltenshinweise preisgeben oder ableiten lassen.

Dies unterscheidet sich von ASI03 (Identity & Privilege Abuse), das sich auf den Missbrauch von Anmeldedaten und Berechtigungen konzentriert, sowie von ASI06 (Memory & Context Poisoning), das auf die Korruption gespeicherten Wissens abzielt. ASI07 konzentriert sich auf die Kompromittierung von Echtzeitnachrichten zwischen Agenten, was zu Fehlinformationen, Berechtigungsverwirrung oder koordinierter Manipulation über verteilte agentische Systeme hinweg führt.

Dieser Eintrag wird durch T12 – Agent Communication Poisoning & T16 – Insecure Inter-Agent Protocol Abuse in Agentic Threats and Mitigations abgedeckt.

## Häufige Beispiele für die Schwachstelle

1. Unverschlüsselte Kanäle, die semantische Manipulation ermöglichen: Ein MITM fängt unverschlüsselte Nachrichten ab und injiziert versteckte Anweisungen, die die Ziele und die Entscheidungslogik des Agenten verändern.

2. Nachrichtenmanipulation, die zu kontextübergreifender Kontamination führt: Veränderte oder eingeschleuste Nachrichten verwischen die Aufgabengrenzen zwischen Agenten, was zu Datenlecks oder Zielverwirrung während der Koordination führt.

3. Replay auf Vertrauensketten: Wiederholte Delegations- oder Vertrauensnachrichten verleiten Agenten dazu, Zugriff zu gewähren oder veraltete Anweisungen zu befolgen.

4. Protokoll-Downgrade und Descriptor-Fälschung, die zu Autoritätsverwirrung führt: Angreifer zwingen Agenten in schwächere Kommunikationsmodi oder fälschen Agenten-Deskriptoren, sodass bösartige Befehle als gültiger Austausch erscheinen.

5. Nachrichten-Routing-Angriffe auf Discovery und Koordination: Fehlgeleiteter Discovery-Verkehr fälscht Beziehungen zu bösartigen Agenten oder nicht autorisierten Koordinatoren.

6. Metadatenanalyse für Verhaltensprofilierung: Verkehrsmuster offenbaren Entscheidungszyklen und Beziehungen, was die Vorhersage und Manipulation des Agentenverhaltens ermöglicht.

## Beispiel-Angriffsszenarien

1. Semantische Injektion über unverschlüsselte Kommunikation: Über HTTP oder andere nicht authentifizierte Kanäle injiziert ein MITM-Angreifer versteckte Anweisungen, wodurch Agenten voreingenommene oder bösartige Ergebnisse produzieren, während sie normal erscheinen.

2. Vertrauensvergiftung durch Nachrichtenmanipulation: In einem agentischen Handelsnetzwerk verzerren veränderte Reputationsnachrichten, welchen Agenten für Entscheidungen vertraut wird.

3. Kontextverwirrung durch Replay: Wiederholte Notfallkoordinationsnachrichten lösen veraltete Verfahren und Ressourcenfehlallokationen aus.

4. Zielmanipulation durch Protokoll-Downgrade: Ein erzwungener, veralteter, unverschlüsselter Modus ermöglicht es Angreifern, Ziele und Risikoparameter einzuschleusen, was zu schädlichen Empfehlungen führt.

5. Agent-in-the-Middle durch MCP-Descriptor-Vergiftung: Ein bösartiger MCP-Endpunkt wirbt mit gefälschten Agenten-Deskriptoren oder falschen Fähigkeiten. Wird ihm vertraut, leitet er sensible Daten über die Infrastruktur des Angreifers um.

6. A2A-Registrierungsfälschung: Ein Angreifer registriert einen gefälschten Peer-Agenten im Discovery-Dienst mit einem geklonten Schema und fängt privilegierten Koordinationsverkehr ab.

7. Semantisches Split-Brain: Eine einzelne Anweisung wird von verschiedenen Agenten in abweichende Absichten interpretiert, was zu widersprüchlichen, aber scheinbar legitimen Aktionen führt.

## Richtlinien zur Prävention und Schadensbegrenzung

1. Sichere Agentenkanäle: Verwenden Sie Ende-zu-Ende-Verschlüsselung mit agentenspezifischen Anmeldedaten und gegenseitiger Authentifizierung. Erzwingen Sie PKI-Zertifikat-Pinning, Forward Secrecy und regelmäßige Protokollüberprüfungen, um Abfangen oder Fälschung zu verhindern.

2. Nachrichtenintegrität und semantischer Schutz: Signieren Sie Nachrichten digital, hashen Sie sowohl Payload als auch Kontext, und validieren Sie auf versteckte oder veränderte natürlichsprachliche Anweisungen. Wenden Sie natürlichsprachbewusste Bereinigung und Intent-Diffing an, um Ziel- und Parametermanipulation sowie versteckte oder veränderte natürlichsprachliche Anweisungen zu erkennen.

3. Agentenbewusster Replay-Schutz: Schützen Sie alle Austauschvorgänge mit Nonces, Sitzungskennungen und Zeitstempeln, die an Aufgabenfenster gebunden sind. Führen Sie kurzfristige Nachrichten-Fingerabdrücke oder Zustands-Hashes, um kontextübergreifende Replays zu erkennen.

4. Protokoll- und Fähigkeitssicherheit: Deaktivieren Sie schwache oder veraltete Kommunikationsmodi. Verlangen Sie agentenspezifische Vertrauensverhandlung und binden Sie die Protokollauthentifizierung an die Agentenidentität. Erzwingen Sie Versions- und Fähigkeitsrichtlinien an Gateways oder Middleware.

5. Begrenzung metadatenbasierter Rückschlüsse: Reduzieren Sie die Angriffsfläche für Verkehrsanalysen, indem Sie – soweit machbar – Nachrichten mit fester Größe oder Padding verwenden, Kommunikationsraten glätten und deterministische Kommunikationspläne vermeiden. Diese leichtgewichtigen Maßnahmen erschweren es Angreifern, Agentenrollen oder Entscheidungszyklen allein aus Metadaten abzuleiten, ohne dass eine umfassende Protokoll-Neugestaltung erforderlich ist.

6. Protokoll-Pinning und Versionsdurchsetzung: Definieren und erzwingen Sie zulässige Protokollversionen (z. B. MCP, A2A, gRPC). Lehnen Sie Downgrade-Versuche oder nicht erkannte Schemata ab und validieren Sie, dass beide Peers übereinstimmende Fähigkeits- und Versions-Fingerabdrücke vorweisen.

7. Schutz von Discovery und Routing: Authentifizieren Sie alle Discovery- und Koordinationsnachrichten mittels kryptografischer Identität. Sichern Sie Verzeichnisse mit Zugriffskontrollen und verifizierten Reputationen, validieren Sie Identität und Absicht durchgängig und überwachen Sie auf anomale Routing-Abläufe.

8. Attestiertes Register und Agentenverifizierung: Verwenden Sie Register oder Marktplätze, die eine digitale Attestierung von Agentenidentität, Herkunft und Descriptor-Integrität bereitstellen. Verlangen Sie signierte Agent Cards und eine kontinuierliche Verifizierung, bevor Discovery- oder Koordinationsnachrichten akzeptiert werden. Nutzen Sie die PKI-vertrauenswürdigen Root-Zertifikatsregister, um eine robuste Agentenverifizierung und Attestierung kritischer Attribute zu ermöglichen.

9. Typisierte Verträge und Schemavalidierung: Verwenden Sie versionierte, typisierte Nachrichtenschemata mit expliziten Zielgruppen pro Nachricht. Lehnen Sie Nachrichten ab, die die Validierung nicht bestehen oder eine Schema-Herabkonvertierung ohne deklarierte Kompatibilität versuchen. Typisierte Verträge helfen bei der Struktur, aber semantische Divergenz zwischen Agenten bleibt eine inhärente Herausforderung; Gegenmaßnahmen konzentrieren sich daher auf Integrität, Herkunft und kontrollierte Kommunikationsmuster, statt eine vollständige semantische Angleichung anzustreben.

## Referenzen

1. Local Model Poisoning Attacks to Byzantine-Robust Federated Learning - USENIX Security 2020

2. Manipulating the Byzantine: Optimizing Model Poisoning Attacks and Defenses for Federated

Learning - NDSS

3. Resilient Consensus Control for Multi-Agent Systems - MDPI / PMC
