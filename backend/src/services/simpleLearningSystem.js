/**
 * ========================================
 * SIMPLE LEARNING SYSTEM V4.0
 * ========================================
 *
 * PHILOSOPHIE:
 * - Speichere ALLES was AI erfolgreich geparst hat
 * - Keine komplizierten Patterns
 * - Lerne aus BEISPIELEN, nicht aus Abstraktionen
 * - Nach 1000-3000 PDFs: System wird autonom
 */

const { getTrainingDB } = require('../db/training-db');

class SimpleLearningSystem {
  /**
   * HAUPT-FUNKTION: Analysiere alle Trainingsdaten
   */
  static analyzeTrainingData() {
    const db = getTrainingDB();

    // Hole ALLE erfolgreichen AI-Parses
    const allData = db.prepare(`
      SELECT COUNT(*) as total,
             AVG(confidence_score) as avg_confidence,
             source
      FROM pdf_training_data
      WHERE source LIKE 'ai-%' AND confidence_score > 70
      GROUP BY source
    `).all();

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM pdf_training_data WHERE confidence_score > 70
    `).get();

    console.log(`\n📚 ===== SIMPLE LEARNING SYSTEM V4.0 =====`);
    console.log(`✅ Trainierte Rezepte: ${total.count}`);

    for (const row of allData) {
      console.log(`   - ${row.source}: ${row.total} Rezepte (Ø ${row.avg_confidence.toFixed(1)}% Konfidenz)`);
    }

    // Berechne Autonomie-Readiness
    const readiness = this.calculateAutonomyReadiness(total.count);

    console.log(`\n🎯 Autonomie-Readiness: ${readiness.percentage}%`);
    console.log(`   - Aktuell: ${total.count} Rezepte`);
    console.log(`   - Minimum für Basic: 500 Rezepte (${readiness.toBasic}% erreicht)`);
    console.log(`   - Empfohlen für Good: 1500 Rezepte (${readiness.toGood}% erreicht)`);
    console.log(`   - Optimal für Excellent: 3000 Rezepte (${readiness.toExcellent}% erreicht)`);

    if (total.count < 500) {
      console.log(`\n💡 EMPFEHLUNG: Trainiere noch ${500 - total.count} Rezepte für Basic-Autonomie`);
    } else if (total.count < 1500) {
      console.log(`\n💡 EMPFEHLUNG: Trainiere noch ${1500 - total.count} Rezepte für Good-Autonomie`);
    } else if (total.count < 3000) {
      console.log(`\n💡 EMPFEHLUNG: Trainiere noch ${3000 - total.count} Rezepte für Excellent-Autonomie`);
    } else {
      console.log(`\n🎉 PERFEKT! System hat genug Daten für vollständige Autonomie!`);
    }

    console.log(`========================================\n`);

    return {
      totalRecipes: total.count,
      readiness: readiness,
      bySource: allData
    };
  }

  /**
   * BERECHNE AUTONOMIE-READINESS
   */
  static calculateAutonomyReadiness(count) {
    const milestones = {
      basic: 500,     // Minimum für grundlegende Autonomie
      good: 1500,     // Empfohlen für gute Ergebnisse
      excellent: 3000 // Optimal für exzellente Ergebnisse
    };

    // Berechne Prozentsätze
    const toBasic = Math.min(100, (count / milestones.basic) * 100);
    const toGood = Math.min(100, (count / milestones.good) * 100);
    const toExcellent = Math.min(100, (count / milestones.excellent) * 100);

    // Gesamte Readiness (weighted average)
    const percentage = Math.round(
      (toBasic * 0.2) + (toGood * 0.3) + (toExcellent * 0.5)
    );

    let level = 'training';
    if (count >= milestones.excellent) level = 'excellent';
    else if (count >= milestones.good) level = 'good';
    else if (count >= milestones.basic) level = 'basic';

    return {
      percentage,
      level,
      count,
      toBasic: Math.round(toBasic),
      toGood: Math.round(toGood),
      toExcellent: Math.round(toExcellent),
      milestones
    };
  }

  /**
   * FINDE ÄHNLICHE REZEPTE IN DATENBANK
   * Für ML-basiertes Parsing: Suche ähnliche Texte
   */
  static findSimilarRecipes(text, limit = 10) {
    const db = getTrainingDB();

    // Extrahiere Keywords aus Text
    const keywords = this.extractKeywords(text);

    if (keywords.length === 0) return [];

    // Suche Rezepte die diese Keywords enthalten
    const placeholders = keywords.map(() => 'pdf_text LIKE ?').join(' OR ');
    const params = keywords.map(k => `%${k}%`);

    const similar = db.prepare(`
      SELECT id, pdf_text, parsed_result, confidence_score, source
      FROM pdf_training_data
      WHERE (${placeholders})
        AND confidence_score > 80
        AND source LIKE 'ai-%'
      ORDER BY confidence_score DESC
      LIMIT ${limit}
    `).all(...params);

    return similar;
  }

  /**
   * EXTRAHIERE KEYWORDS AUS TEXT
   */
  static extractKeywords(text) {
    const keywords = [];
    const lines = text.split('\n').map(l => l.trim().toLowerCase());

    // Suche nach charakteristischen Keywords
    const importantKeywords = [
      'zutaten', 'ingredients', 'brauchst',
      'zubereitung', 'anleitung', 'schritte',
      'personen', 'portionen', 'minuten'
    ];

    for (const line of lines) {
      for (const keyword of importantKeywords) {
        if (line.includes(keyword) && !keywords.includes(keyword)) {
          keywords.push(keyword);
        }
      }
    }

    return keywords;
  }

  /**
   * SPEICHERE ERFOLGREICHES AI-PARSE
   */
  static saveAIParse(pdfText, parsedResult, source, confidenceScore, filename, fileSize, fileType = 'pdf') {
    const db = getTrainingDB();

    // Speichere in Datenbank
    db.prepare(`
      INSERT INTO pdf_training_data
        (pdf_text, parsed_result, source, confidence_score, pdf_filename, pdf_size_bytes, file_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      pdfText,
      JSON.stringify(parsedResult),
      source,
      confidenceScore,
      filename,
      fileSize,
      fileType
    );

    console.log(`✅ AI-Parse gespeichert: ${filename} (${source}, ${confidenceScore}% Konfidenz)`);

    // Update Learning Stats
    this.updateLearningStats(source);
  }

  /**
   * UPDATE LEARNING STATS
   */
  static updateLearningStats(source) {
    const db = getTrainingDB();

    // Hole aktuelle Stats
    let stats = db.prepare('SELECT * FROM learning_stats LIMIT 1').get();

    if (!stats) {
      // Erstelle neue Stats
      db.prepare(`
        INSERT INTO learning_stats
          (total_pdfs_trained, ai_assisted_count, autonomous_count, average_confidence, learning_phase)
        VALUES (1, 1, 0, 100, 'training')
      `).run();
    } else {
      // Update Stats
      const isAI = source.startsWith('ai-');
      const newTotal = stats.total_pdfs_trained + 1;
      const newAICount = isAI ? stats.ai_assisted_count + 1 : stats.ai_assisted_count;
      const newAutoCount = !isAI ? stats.autonomous_count + 1 : stats.autonomous_count;

      // Berechne neue Phase basierend auf Anzahl
      let newPhase = 'training';
      if (newTotal >= 1500) newPhase = 'autonomous';
      else if (newTotal >= 500) newPhase = 'hybrid';

      db.prepare(`
        UPDATE learning_stats
        SET total_pdfs_trained = ?,
            ai_assisted_count = ?,
            autonomous_count = ?,
            learning_phase = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newTotal, newAICount, newAutoCount, newPhase, stats.id);
    }
  }

  /**
   * HOLE LEARNING STATS
   */
  static getLearningStats() {
    const db = getTrainingDB();

    const stats = db.prepare('SELECT * FROM learning_stats LIMIT 1').get();

    if (!stats) {
      return {
        total_pdfs_trained: 0,
        ai_assisted_count: 0,
        autonomous_count: 0,
        learning_phase: 'training',
        readiness: this.calculateAutonomyReadiness(0)
      };
    }

    return {
      ...stats,
      readiness: this.calculateAutonomyReadiness(stats.total_pdfs_trained)
    };
  }

  /**
   * SIMPLE ML PARSE - Versuche aus Beispielen zu lernen
   */
  static tryMLParse(text) {
    const similar = this.findSimilarRecipes(text, 5);

    if (similar.length === 0) {
      console.log('⚠️ Keine ähnlichen Rezepte gefunden - ML kann nicht helfen');
      return null;
    }

    console.log(`🔍 ${similar.length} ähnliche Rezepte in Datenbank gefunden`);

    // Versuche Pattern aus ähnlichen Rezepten zu extrahieren
    // TODO: Hier könnte man später Machine Learning hinzufügen
    // Für jetzt: Return null = AI Fallback

    return null;
  }
}

module.exports = SimpleLearningSystem;
