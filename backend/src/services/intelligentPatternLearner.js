/**
 * ========================================
 * INTELLIGENT PATTERN LEARNING V3.0
 * ========================================
 *
 * Lernt STRUKTURELL aus AI-Trainingsdaten:
 * 1. WO stehen Zutaten/Schritte im Dokument?
 * 2. WELCHE Keywords markieren Sections?
 * 3. WIE sind Zeilen formatiert?
 * 4. WELCHE Muster sind zuverlässig?
 */

const { getTrainingDB } = require('../db/training-db');

class IntelligentPatternLearner {
  constructor() {
    this.learningResults = {
      sectionKeywords: {
        ingredients: new Map(), // Keyword -> Häufigkeit
        steps: new Map()
      },
      structuralPatterns: {
        ingredientLineFormats: [], // Format-Examples
        stepLineFormats: [],
        documentStructure: [] // Position von Sections
      },
      statistics: {
        totalRecipes: 0,
        avgIngredientsCount: 0,
        avgStepsCount: 0,
        commonUnits: new Map()
      }
    };
  }

  /**
   * HAUPTFUNKTION: Lerne aus ALLEN AI-Trainingsdaten
   */
  async learnFromAllTrainingData() {
    const db = getTrainingDB();

    // Hole ALLE erfolgreichen AI-Parses (Konfidenz > 70%)
    const trainingData = db.prepare(`
      SELECT pdf_text, parsed_result, source, confidence_score, pdf_filename
      FROM pdf_training_data
      WHERE source LIKE 'ai-%' AND confidence_score > 70
      ORDER BY confidence_score DESC
    `).all();

    console.log(`\n🧠 ===== INTELLIGENTES PATTERN LEARNING V3.0 =====`);
    console.log(`📊 Analysiere ${trainingData.length} erfolgreiche AI-Rezepte...`);

    for (const data of trainingData) {
      try {
        const recipe = JSON.parse(data.parsed_result);
        const text = data.pdf_text;
        const lines = text.split('\n');

        this.learningResults.statistics.totalRecipes++;

        // 1. LERNE SECTION-KEYWORDS
        this.learnSectionKeywords(lines, recipe);

        // 2. LERNE STRUKTURELLE POSITIONEN
        this.learnStructuralPositions(lines, recipe);

        // 3. LERNE LINE-FORMATE
        this.learnLineFormats(lines, recipe);

        // 4. SAMMLE STATISTIKEN
        this.collectStatistics(recipe);

      } catch (error) {
        console.error(`❌ Fehler bei ${data.pdf_filename || 'unbekannt'}:`, error.message);
      }
    }

    // AGGREGIERE UND SPEICHERE
    const patterns = this.aggregatePatterns();
    await this.savePatterns(patterns);

    this.printLearningReport();

    return patterns;
  }

  /**
   * 1. LERNE SECTION-KEYWORDS (VEREINFACHT & ROBUSTER)
   * Suche DIREKT nach Zeilen die Keywords enthalten
   */
  learnSectionKeywords(lines, recipe) {
    // ZUTATEN-KEYWORDS: Suche in ALLEN Zeilen
    const ingredientKeywords = ['zutaten', 'ingredients', 'brauchst', 'benötigt', 'du brauchst', 'das brauchst'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();

      // Nur kurze Zeilen (< 50 Zeichen) = wahrscheinlich Header
      if (line.length > 0 && line.length < 50) {
        for (const keyword of ingredientKeywords) {
          if (line.includes(keyword)) {
            const count = this.learningResults.sectionKeywords.ingredients.get(keyword) || 0;
            this.learningResults.sectionKeywords.ingredients.set(keyword, count + 1);
            break; // Nur einmal pro Zeile
          }
        }
      }
    }

    // SCHRITTE-KEYWORDS: Suche in ALLEN Zeilen
    const stepKeywords = ['zubereitung', 'anleitung', 'schritte', 'so geht', 'preparation', 'instructions', 'und so', 'so wird'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();

      if (line.length > 0 && line.length < 50) {
        for (const keyword of stepKeywords) {
          if (line.includes(keyword)) {
            const count = this.learningResults.sectionKeywords.steps.get(keyword) || 0;
            this.learningResults.sectionKeywords.steps.set(keyword, count + 1);
            break;
          }
        }
      }
    }
  }

  /**
   * 2. LERNE STRUKTURELLE POSITIONEN
   * Wo im Dokument stehen normalerweise Zutaten/Schritte?
   */
  learnStructuralPositions(lines, recipe) {
    const totalLines = lines.length;

    if (recipe.ingredients && recipe.ingredients.length > 0) {
      // Finde erste Zutat
      const firstIng = recipe.ingredients[0];
      const ingName = (firstIng.name || firstIng.ingredient_name || '').toLowerCase();

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(ingName)) {
          const relativePosition = i / totalLines; // 0.0 bis 1.0

          this.learningResults.structuralPatterns.documentStructure.push({
            type: 'ingredients_start',
            relativePosition: relativePosition,
            absoluteLine: i
          });
          break;
        }
      }
    }

    if (recipe.steps && recipe.steps.length > 0) {
      // Finde ersten Schritt
      const firstStep = recipe.steps[0];
      const stepText = (firstStep.instruction || '').substring(0, 30).toLowerCase();

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(stepText)) {
          const relativePosition = i / totalLines;

          this.learningResults.structuralPatterns.documentStructure.push({
            type: 'steps_start',
            relativePosition: relativePosition,
            absoluteLine: i
          });
          break;
        }
      }
    }
  }

  /**
   * 3. LERNE LINE-FORMATE
   * Wie sehen Zutaten-Zeilen aus? Wie Schritt-Zeilen?
   */
  learnLineFormats(lines, recipe) {
    // Lerne aus ersten 5 Zutaten
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      for (const ingredient of recipe.ingredients.slice(0, 5)) {
        const ingName = (ingredient.name || ingredient.ingredient_name || '').toLowerCase();
        const amount = ingredient.amount || 0;
        const unit = (ingredient.unit || '').toLowerCase();

        // Finde die Zeile im Text
        for (const line of lines) {
          const lowerLine = line.toLowerCase();

          if (lowerLine.includes(ingName) && line.length < 100) {
            // Analysiere Format
            const format = this.analyzeLineFormat(line, { name: ingName, amount, unit });

            if (format) {
              this.learningResults.structuralPatterns.ingredientLineFormats.push(format);
            }
            break;
          }
        }
      }
    }

    // Lerne aus ersten 3 Schritten
    if (recipe.steps && recipe.steps.length > 0) {
      for (const step of recipe.steps.slice(0, 3)) {
        const stepText = (step.instruction || '').substring(0, 50);

        for (const line of lines) {
          if (line.includes(stepText.substring(0, 20)) && line.length > 20) {
            const format = this.analyzeStepFormat(line, step.step_number || 0);

            if (format) {
              this.learningResults.structuralPatterns.stepLineFormats.push(format);
            }
            break;
          }
        }
      }
    }
  }

  /**
   * HELPER: Analysiere Format einer Zutaten-Zeile
   */
  analyzeLineFormat(line, data) {
    const trimmed = line.trim();

    // Hat Nummer am Anfang?
    const hasLeadingNumber = /^\d+/.test(trimmed);

    // Hat Einheit?
    const hasUnit = data.unit && data.unit.length > 0;

    // Position der Zahl
    const numberMatch = trimmed.match(/(\d+(?:[.,]\d+)?)/);
    const numberPosition = numberMatch ? trimmed.indexOf(numberMatch[0]) : -1;

    // Leerzeichen vor/nach Einheit?
    let spaceBeforeUnit = null;
    let spaceAfterUnit = null;

    if (hasUnit && data.unit) {
      const unitRegex = new RegExp(`\\s(${data.unit})`, 'i');
      const noSpaceRegex = new RegExp(`(${data.unit})`, 'i');

      spaceBeforeUnit = unitRegex.test(trimmed);

      const unitMatch = trimmed.match(new RegExp(`${data.unit}\\s+`, 'i'));
      spaceAfterUnit = unitMatch !== null;
    }

    return {
      hasLeadingNumber,
      hasUnit,
      numberPosition: numberPosition === 0 ? 'start' : numberPosition > 0 ? 'middle' : 'none',
      spaceBeforeUnit,
      spaceAfterUnit,
      lineLength: trimmed.length,
      example: trimmed.substring(0, 50)
    };
  }

  /**
   * HELPER: Analysiere Format einer Schritt-Zeile
   */
  analyzeStepFormat(line, stepNumber) {
    const trimmed = line.trim();

    // Hat Nummerierung?
    const numberMatch = trimmed.match(/^(\d+)[.):\s]/);
    const hasNumbering = numberMatch !== null;
    const numberFormat = numberMatch ? numberMatch[1] : null;

    // Hat Bullet Point?
    const hasBullet = /^[-•·]/.test(trimmed);

    return {
      hasNumbering,
      numberFormat,
      hasBullet,
      startsWithVerb: /^[A-ZÄÖÜ][a-zäöü]+\s+/.test(trimmed),
      lineLength: trimmed.length,
      example: trimmed.substring(0, 60)
    };
  }

  /**
   * 4. SAMMLE STATISTIKEN
   */
  collectStatistics(recipe) {
    if (recipe.ingredients) {
      this.learningResults.statistics.avgIngredientsCount += recipe.ingredients.length;

      // Sammle häufigste Einheiten
      for (const ing of recipe.ingredients) {
        const unit = (ing.unit || '').toLowerCase();
        if (unit) {
          const count = this.learningResults.statistics.commonUnits.get(unit) || 0;
          this.learningResults.statistics.commonUnits.set(unit, count + 1);
        }
      }
    }

    if (recipe.steps) {
      this.learningResults.statistics.avgStepsCount += recipe.steps.length;
    }
  }

  /**
   * AGGREGIERE PATTERNS
   */
  aggregatePatterns() {
    const total = this.learningResults.statistics.totalRecipes;

    // Top Section Keywords
    const topIngKeywords = Array.from(this.learningResults.sectionKeywords.ingredients.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({
        keyword,
        frequency: count,
        confidence: count / total
      }));

    const topStepKeywords = Array.from(this.learningResults.sectionKeywords.steps.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({
        keyword,
        frequency: count,
        confidence: count / total
      }));

    // Durchschnittliche Positionen
    const ingPositions = this.learningResults.structuralPatterns.documentStructure
      .filter(p => p.type === 'ingredients_start');
    const avgIngPosition = ingPositions.length > 0
      ? ingPositions.reduce((sum, p) => sum + p.relativePosition, 0) / ingPositions.length
      : 0.2;

    const stepPositions = this.learningResults.structuralPatterns.documentStructure
      .filter(p => p.type === 'steps_start');
    const avgStepPosition = stepPositions.length > 0
      ? stepPositions.reduce((sum, p) => sum + p.relativePosition, 0) / stepPositions.length
      : 0.5;

    // Häufigste Line-Formate
    const ingredientFormats = this.aggregateIngredientFormats();
    const stepFormats = this.aggregateStepFormats();

    // Top Einheiten
    const topUnits = Array.from(this.learningResults.statistics.commonUnits.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([unit, count]) => ({ unit, count }));

    return {
      version: '3.0',
      learnedFrom: total,
      sectionKeywords: {
        ingredients: topIngKeywords,
        steps: topStepKeywords
      },
      structuralInfo: {
        avgIngredientPosition: avgIngPosition,
        avgStepPosition: avgStepPosition,
        avgIngredientsCount: this.learningResults.statistics.avgIngredientsCount / total,
        avgStepsCount: this.learningResults.statistics.avgStepsCount / total
      },
      lineFormats: {
        ingredients: ingredientFormats,
        steps: stepFormats
      },
      commonUnits: topUnits
    };
  }

  /**
   * AGGREGIERE INGREDIENT LINE FORMATE
   */
  aggregateIngredientFormats() {
    const formats = this.learningResults.structuralPatterns.ingredientLineFormats;
    if (formats.length === 0) return {};

    const total = formats.length;

    return {
      percentageWithLeadingNumber: formats.filter(f => f.hasLeadingNumber).length / total,
      percentageWithUnit: formats.filter(f => f.hasUnit).length / total,
      percentageSpaceBeforeUnit: formats.filter(f => f.spaceBeforeUnit).length / total,
      percentageSpaceAfterUnit: formats.filter(f => f.spaceAfterUnit).length / total,
      avgLength: formats.reduce((sum, f) => sum + f.lineLength, 0) / total
    };
  }

  /**
   * AGGREGIERE STEP LINE FORMATE
   */
  aggregateStepFormats() {
    const formats = this.learningResults.structuralPatterns.stepLineFormats;
    if (formats.length === 0) return {};

    const total = formats.length;

    return {
      percentageNumbered: formats.filter(f => f.hasNumbering).length / total,
      percentageBullet: formats.filter(f => f.hasBullet).length / total,
      percentageStartsWithVerb: formats.filter(f => f.startsWithVerb).length / total,
      avgLength: formats.reduce((sum, f) => sum + f.lineLength, 0) / total
    };
  }

  /**
   * SPEICHERE PATTERNS IN DATENBANK
   */
  async savePatterns(patterns) {
    const db = getTrainingDB();

    // Lösche alte Patterns
    db.prepare('DELETE FROM learned_patterns').run();

    // Speichere neue Patterns als JSON
    db.prepare(`
      INSERT INTO learned_patterns (pattern_type, pattern_data, success_rate, usage_count)
      VALUES (?, ?, ?, 0)
    `).run('intelligent_patterns_v3', JSON.stringify(patterns), 1.0);

    console.log(`💾 Intelligente Patterns in Datenbank gespeichert!`);
  }

  /**
   * PRINT LEARNING REPORT
   */
  printLearningReport() {
    console.log(`\n📊 ===== LEARNING REPORT =====`);
    console.log(`✅ Analysierte Rezepte: ${this.learningResults.statistics.totalRecipes}`);
    console.log(`\n🏷️ TOP SECTION KEYWORDS (Zutaten):`);

    const topIng = Array.from(this.learningResults.sectionKeywords.ingredients.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    topIng.forEach(([keyword, count]) => {
      console.log(`   - "${keyword}": ${count}x`);
    });

    console.log(`\n🏷️ TOP SECTION KEYWORDS (Schritte):`);

    const topStep = Array.from(this.learningResults.sectionKeywords.steps.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    topStep.forEach(([keyword, count]) => {
      console.log(`   - "${keyword}": ${count}x`);
    });

    console.log(`\n📍 DURCHSCHNITTLICHE POSITIONEN:`);
    const ingPos = this.learningResults.structuralPatterns.documentStructure
      .filter(p => p.type === 'ingredients_start');
    if (ingPos.length > 0) {
      const avg = ingPos.reduce((sum, p) => sum + p.relativePosition, 0) / ingPos.length;
      console.log(`   - Zutaten starten bei: ${(avg * 100).toFixed(0)}% des Dokuments`);
    }

    const stepPos = this.learningResults.structuralPatterns.documentStructure
      .filter(p => p.type === 'steps_start');
    if (stepPos.length > 0) {
      const avg = stepPos.reduce((sum, p) => sum + p.relativePosition, 0) / stepPos.length;
      console.log(`   - Schritte starten bei: ${(avg * 100).toFixed(0)}% des Dokuments`);
    }

    console.log(`\n🔢 STATISTIKEN:`);
    console.log(`   - Ø Zutaten pro Rezept: ${(this.learningResults.statistics.avgIngredientsCount / this.learningResults.statistics.totalRecipes).toFixed(1)}`);
    console.log(`   - Ø Schritte pro Rezept: ${(this.learningResults.statistics.avgStepsCount / this.learningResults.statistics.totalRecipes).toFixed(1)}`);

    console.log(`\n===========================\n`);
  }

  /**
   * LADE PATTERNS AUS DATENBANK
   */
  static getLearnedPatterns() {
    const db = getTrainingDB();

    const row = db.prepare(`
      SELECT pattern_data
      FROM learned_patterns
      WHERE pattern_type = 'intelligent_patterns_v3'
      LIMIT 1
    `).get();

    if (row && row.pattern_data) {
      return JSON.parse(row.pattern_data);
    }

    return null;
  }
}

module.exports = IntelligentPatternLearner;
