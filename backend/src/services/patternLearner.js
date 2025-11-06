/**
 * INTELLIGENT PATTERN LEARNING SERVICE
 *
 * Lernt aus AI-Trainingsdaten und extrahiert Muster für:
 * - Zutaten-Erkennung
 * - Schritt-Erkennung
 * - Struktur-Keywords
 * - Mengenangaben
 */

const { getTrainingDB } = require('../db/training-db');

class PatternLearner {
  constructor() {
    this.patterns = {
      ingredients: [],
      steps: [],
      titles: [],
      servings: [],
      time: []
    };
  }

  /**
   * Analysiere alle AI-Trainingsdaten und lerne Patterns
   */
  async learnFromTrainingData() {
    const db = getTrainingDB();

    // Hole alle erfolgreichen AI-Parses (Konfidenz > 70%)
    const trainingData = db.prepare(`
      SELECT pdf_text, parsed_result, source, confidence_score
      FROM pdf_training_data
      WHERE source LIKE 'ai-%' AND confidence_score > 70
      ORDER BY confidence_score DESC
    `).all();

    console.log(`🧠 Lerne aus ${trainingData.length} erfolgreichen AI-Parses...`);

    let totalPatterns = 0;

    for (const data of trainingData) {
      try {
        const recipe = JSON.parse(data.parsed_result);
        const text = data.pdf_text;

        // Lerne Zutaten-Patterns
        totalPatterns += this.learnIngredientPatterns(text, recipe.ingredients);

        // Lerne Schritt-Patterns
        totalPatterns += this.learnStepPatterns(text, recipe.steps);

        // Lerne Titel-Patterns
        totalPatterns += this.learnTitlePattern(text, recipe.name);

        // Lerne Portionen-Patterns
        totalPatterns += this.learnServingsPattern(text, recipe.servings);

      } catch (error) {
        console.error('Fehler beim Parsen von Trainingsdaten:', error.message);
      }
    }

    // Speichere gelernte Patterns in Datenbank
    await this.savePatterns();

    console.log(`✅ ${totalPatterns} Patterns gelernt und gespeichert!`);
    return totalPatterns;
  }

  /**
   * Lerne wie Zutaten im Text strukturiert sind
   */
  learnIngredientPatterns(text, ingredients) {
    if (!ingredients || ingredients.length === 0) return 0;

    const lines = text.split('\n');
    let learned = 0;

    // Finde Zeilen, die Zutaten enthalten
    for (const ingredient of ingredients) {
      // Support both formats: ingredient.name (old) and ingredient.ingredient_name (AI format)
      const name = ingredient.name || ingredient.ingredient_name;
      if (!name) continue;

      const ingredientName = name.toLowerCase();

      for (const line of lines) {
        const lowerLine = line.toLowerCase();

        if (lowerLine.includes(ingredientName)) {
          // Extrahiere Pattern aus der Zeile
          const pattern = this.extractIngredientPattern(line, ingredient);

          if (pattern) {
            this.patterns.ingredients.push(pattern);
            learned++;
          }
          break; // Nur erste Übereinstimmung
        }
      }
    }

    return learned;
  }

  /**
   * Extrahiere Pattern aus einer Zutaten-Zeile
   */
  extractIngredientPattern(line, ingredient) {
    // Prüfe auch das ingredient-Objekt selbst (AI-Format)
    const hasAmount = ingredient.amount !== undefined && ingredient.amount !== null && ingredient.amount > 0;
    const unit = ingredient.unit || '';

    // Erkenne Mengenangaben in der Zeile
    const quantityMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|tl|el|prise|messerspitze|stück|stücke)?/i);

    // Wenn AI-Daten Mengenangabe haben ODER Zeile Mengenangabe hat
    if (hasAmount || quantityMatch) {
      return {
        type: 'ingredient_with_quantity',
        hasNumber: true,
        hasUnit: !!(unit || quantityMatch?.[2]),
        unit: (unit || quantityMatch?.[2])?.toLowerCase(),
        position: 'start', // Meist am Zeilenanfang
        confidence: 0.8
      };
    }

    // Zutaten ohne Mengenangabe
    return {
      type: 'ingredient_simple',
      hasNumber: false,
      position: 'anywhere',
      confidence: 0.6
    };
  }

  /**
   * Lerne wie Zubereitungsschritte strukturiert sind
   */
  learnStepPatterns(text, steps) {
    if (!steps || steps.length === 0) return 0;

    const lines = text.split('\n');
    let learned = 0;

    // Finde Zeilen mit Zubereitungsschritten
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.instruction) continue;

      const stepText = step.instruction.substring(0, 50).toLowerCase(); // Erste 50 Zeichen

      for (const line of lines) {
        const lowerLine = line.toLowerCase();

        if (lowerLine.includes(stepText.substring(0, 20))) {
          const pattern = this.extractStepPattern(line, i + 1);

          if (pattern) {
            this.patterns.steps.push(pattern);
            learned++;
          }
          break;
        }
      }
    }

    return learned;
  }

  /**
   * Extrahiere Pattern aus einem Zubereitungsschritt
   */
  extractStepPattern(line, stepNumber) {
    // Prüfe auf Nummerierung
    const numberMatch = line.match(/^(\d+)[.)\s]/);

    if (numberMatch) {
      return {
        type: 'numbered_step',
        hasNumber: true,
        numberFormat: numberMatch[1],
        confidence: 0.9
      };
    }

    // Prüfe auf Bullet Points
    if (line.match(/^[-•·]/)) {
      return {
        type: 'bullet_step',
        hasBullet: true,
        confidence: 0.7
      };
    }

    return {
      type: 'paragraph_step',
      confidence: 0.5
    };
  }

  /**
   * Lerne wie Titel strukturiert sind
   */
  learnTitlePattern(text, title) {
    if (!title) return 0;

    const lines = text.split('\n');

    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      const lowerTitle = title.toLowerCase();

      if (lowerLine.includes(lowerTitle) || lowerTitle.includes(lowerLine)) {
        const pattern = {
          type: 'title',
          position: i < 3 ? 'top' : 'middle',
          isUpperCase: line === line.toUpperCase(),
          isCentered: line.startsWith(' ') && line.endsWith(' '),
          length: line.length,
          confidence: 0.9
        };

        this.patterns.titles.push(pattern);
        return 1;
      }
    }

    return 0;
  }

  /**
   * Lerne Portionen-Patterns
   */
  learnServingsPattern(text, servings) {
    if (!servings) return 0;

    const servingsStr = servings.toString();
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.includes(servingsStr)) {
        const pattern = {
          type: 'servings',
          keywords: ['portion', 'person', 'stück'],
          hasNumber: true,
          confidence: 0.8
        };

        this.patterns.servings.push(pattern);
        return 1;
      }
    }

    return 0;
  }

  /**
   * Speichere gelernte Patterns in Datenbank
   */
  async savePatterns() {
    const db = getTrainingDB();

    // Aggregiere Patterns nach Typ
    const aggregated = this.aggregatePatterns();

    // Lösche alte Patterns
    db.prepare('DELETE FROM learned_patterns').run();

    // Speichere neue Patterns
    const insertStmt = db.prepare(`
      INSERT INTO learned_patterns (pattern_type, pattern_regex, pattern_data, success_rate, usage_count)
      VALUES (?, ?, ?, ?, 0)
    `);

    for (const [type, data] of Object.entries(aggregated)) {
      insertStmt.run(
        type,
        data.regex || null,
        JSON.stringify(data),
        data.confidence || 0.5
      );
    }

    console.log(`📊 ${Object.keys(aggregated).length} Pattern-Typen gespeichert`);
  }

  /**
   * Aggregiere ähnliche Patterns
   */
  aggregatePatterns() {
    const result = {};

    // Zutaten-Patterns aggregieren
    const ingredientWithQty = this.patterns.ingredients.filter(p => p.hasNumber);
    const totalIngredients = this.patterns.ingredients.length;

    console.log(`📊 Zutaten-Patterns: ${totalIngredients} total, ${ingredientWithQty.length} mit Mengenangaben`);

    // Erstelle IMMER ein ingredients Pattern (auch als Fallback)
    if (totalIngredients > 0) {
      const units = [...new Set(ingredientWithQty.map(p => p.unit).filter(Boolean))];

      result.ingredients_with_quantity = {
        count: ingredientWithQty.length || totalIngredients,
        confidence: ingredientWithQty.length > 0 ? 0.85 : 0.6,
        units: units.length > 0 ? units : ['g', 'kg', 'ml', 'l', 'tl', 'el', 'prise', 'stück'],
        regex: '\\d+(?:[.,]\\d+)?\\s*(?:g|kg|ml|l|tl|el|prise|messerspitze|stück|stücke)?',
        hasQuantityPatterns: ingredientWithQty.length > 0,
        fallbackMode: ingredientWithQty.length === 0
      };

      console.log(`✅ ingredients_with_quantity Pattern erstellt (Confidence: ${result.ingredients_with_quantity.confidence})`);
    } else {
      console.warn('⚠️ Keine Zutaten-Patterns gelernt!');
    }

    // Schritt-Patterns aggregieren
    const numberedSteps = this.patterns.steps.filter(p => p.hasNumber);
    if (numberedSteps.length > 0) {
      result.steps_numbered = {
        count: numberedSteps.length,
        confidence: 0.9,
        regex: '^\\d+[.)]\\s+'
      };
    }

    // Titel-Patterns
    if (this.patterns.titles.length > 0) {
      const topTitles = this.patterns.titles.filter(p => p.position === 'top');
      result.title_top = {
        count: topTitles.length,
        confidence: 0.9,
        position: 'top'
      };
    }

    // Portionen-Patterns
    if (this.patterns.servings.length > 0) {
      result.servings = {
        count: this.patterns.servings.length,
        confidence: 0.8,
        keywords: ['portion', 'person', 'stück']
      };
    }

    return result;
  }

  /**
   * Hole gelernte Patterns aus Datenbank
   */
  static getLearnedPatterns() {
    const db = getTrainingDB();

    const patterns = db.prepare(`
      SELECT pattern_type, pattern_data, success_rate, usage_count
      FROM learned_patterns
      ORDER BY success_rate DESC
    `).all();

    const parsed = {};
    for (const row of patterns) {
      try {
        parsed[row.pattern_type] = {
          ...JSON.parse(row.pattern_data),
          success_rate: row.success_rate,
          usage_count: row.usage_count
        };
      } catch (error) {
        console.error(`Fehler beim Parsen von Pattern ${row.pattern_type}:`, error.message);
      }
    }

    return parsed;
  }

  /**
   * Update Pattern Success Rate nach erfolgreicher Nutzung
   */
  static updatePatternSuccess(patternType, wasSuccessful) {
    const db = getTrainingDB();

    const pattern = db.prepare('SELECT * FROM learned_patterns WHERE pattern_type = ?').get(patternType);

    if (pattern) {
      const newUsageCount = pattern.usage_count + 1;
      const successIncrement = wasSuccessful ? 1 : 0;
      const newSuccessRate = ((pattern.success_rate * pattern.usage_count) + successIncrement) / newUsageCount;

      db.prepare(`
        UPDATE learned_patterns
        SET success_rate = ?, usage_count = ?, updated_at = CURRENT_TIMESTAMP
        WHERE pattern_type = ?
      `).run(newSuccessRate, newUsageCount, patternType);
    }
  }
}

module.exports = PatternLearner;
