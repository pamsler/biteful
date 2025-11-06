/**
 * ========================================
 * SMART HYBRID PARSER V2.0
 * ========================================
 *
 * STRATEGIE:
 * 1. Versuche einfachen Regex-Parser
 * 2. Confidence < 60%? → AI Fallback
 * 3. Speichere AI-Ergebnis für Training
 * 4. Nach 1500+ PDFs: System arbeitet autonom
 */

const SimpleLearningSystem = require('./simpleLearningSystem');

class SmartHybridParser {
  /**
   * PARSE REZEPT - Smart Hybrid Approach
   */
  static parse(text, forceAutonomous = false) {
    console.log(`\n🧠 ===== SMART HYBRID PARSER V2.0 =====`);

    if (forceAutonomous) {
      console.log(`⚠️ FORCE AUTONOMOUS MODE - AI deaktiviert für Test!`);
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log(`📄 Text hat ${lines.length} Zeilen`);

    // SCHRITT 1: Versuche Simple Parser
    const recipe = this.simpleParser(lines);

    // SCHRITT 2: Berechne Confidence
    const confidence = this.calculateConfidence(recipe);

    console.log(`📊 Simple Parser Confidence: ${confidence}%`);

    // SCHRITT 3: Entscheide ob AI nötig ist
    const needsAI = confidence < 60 && !forceAutonomous;

    if (needsAI) {
      console.log(`🤖 Confidence zu niedrig (${confidence}%) → AI Fallback benötigt`);
      return {
        success: false,
        recipe: recipe,
        confidence: confidence,
        needsAI: true,
        message: 'Simple Parser nicht erfolgreich - AI Fallback benötigt'
      };
    }

    console.log(`✅ Simple Parser erfolgreich! (${confidence}%)`);
    console.log(`=====================================\n`);

    return {
      success: true,
      recipe: recipe,
      confidence: confidence,
      needsAI: false,
      method: forceAutonomous ? 'regex-forced' : 'regex'
    };
  }

  /**
   * SIMPLE PARSER - Robuste Basis-Logik
   */
  static simpleParser(lines) {
    const recipe = {
      name: '',
      ingredients: [],
      steps: [],
      servings: 4,
      prep_time: 0,
      cook_time: 0,
      description: ''
    };

    // 1. TITEL: Erste Zeile die lang genug ist ODER GROSSGESCHRIEBEN
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (line.length > 5 && line.length < 60) {
        if (line === line.toUpperCase() || i === 0) {
          recipe.name = line;
          break;
        }
      }
    }

    // 2. PORTIONEN: Suche "4 Personen", "für 2", etc.
    for (const line of lines) {
      const match = line.match(/(\d+)\s*(person|portion|portionen|personen)/i);
      if (match) {
        recipe.servings = parseInt(match[1]);
        break;
      }
    }

    // 3. ZEIT: Intelligentes Parsing für Vorbereitungs- und Kochzeit
    for (const line of lines) {
      const lower = line.toLowerCase();
      const timeMatch = lower.match(/(\d+)\s*(min|minuten)/i);

      if (timeMatch) {
        const minutes = parseInt(timeMatch[1]);

        // Koch-/Backzeit: "aktiv kochen", "backen", "braten", "garen"
        if (lower.includes('aktiv') || lower.includes('koch') || lower.includes('back') ||
            lower.includes('brat') || lower.includes('gar')) {
          if (!lower.includes('gesamt') && !lower.includes('total') && !lower.includes('insgesamt')) {
            recipe.cook_time = minutes;
            console.log(`   ⏱️ Koch-/Backzeit gefunden: ${minutes} min`);
            continue;
          }
        }

        // Vorbereitungszeit: "vorbereitung", "zubereitung", "prep"
        if (lower.includes('vorbereit') || lower.includes('zubereit') || lower.includes('prep')) {
          if (!lower.includes('gesamt') && !lower.includes('total') && !lower.includes('insgesamt')) {
            recipe.prep_time = minutes;
            console.log(`   ⏱️ Vorbereitungszeit gefunden: ${minutes} min`);
            continue;
          }
        }

        // Gesamtzeit: Ignoriere diese (oder verwende als Fallback)
        if (lower.includes('gesamt') || lower.includes('total') || lower.includes('insgesamt')) {
          console.log(`   ⏱️ Gesamtzeit gefunden: ${minutes} min (wird ignoriert)`);
          continue;
        }

        // Fallback: Erste Zeit ohne spezifischen Kontext → prep_time (nur wenn noch nicht gesetzt)
        if (recipe.prep_time === 0 && recipe.cook_time === 0) {
          recipe.prep_time = minutes;
          console.log(`   ⏱️ Zeit gefunden (Fallback): ${minutes} min → Vorbereitungszeit`);
        }
      }
    }

    // 4. FINDE ZUTATEN-SECTION
    let ingrStart = -1;
    let ingrEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      // Zutaten-Header?
      if (line.includes('zutaten') || line.includes('brauchst') || line.includes('für')) {
        if (line.length < 50) {
          ingrStart = i + 1;

          // Finde Ende: Nächster Section-Header
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            if (this.isSectionHeader(nextLine)) {
              ingrEnd = j;
              break;
            }
          }

          if (ingrEnd === -1) ingrEnd = Math.min(i + 20, lines.length);
          break;
        }
      }
    }

    console.log(`🎯 Zutaten-Section: Zeile ${ingrStart} bis ${ingrEnd}`);

    // 5. EXTRAHIERE ZUTATEN
    if (ingrStart !== -1) {
      for (let i = ingrStart; i < ingrEnd; i++) {
        const line = lines[i];
        if (line.length < 3) continue;

        const ingredient = this.parseIngredient(line);
        if (ingredient) {
          recipe.ingredients.push(ingredient);
          console.log(`   🥕 "${line}" → ${ingredient.amount} ${ingredient.unit} ${ingredient.name}`);
        }
      }
    }

    // 6. FINDE SCHRITTE-SECTION
    let stepsStart = ingrEnd !== -1 ? ingrEnd : Math.floor(lines.length / 2);

    for (let i = stepsStart; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      if (line.includes('zubereitung') || line.includes('anleitung') || line.includes('schritte') ||
          line.includes('gemacht') || line.includes('geht')) {
        if (line.length < 60) {
          stepsStart = i + 1;
          break;
        }
      }
    }

    console.log(`📝 Schritte-Section: Zeile ${stepsStart} bis Ende`);

    // 7. EXTRAHIERE SCHRITTE
    let currentStep = '';
    let stepNumber = 1;

    for (let i = stepsStart; i < lines.length; i++) {
      const line = lines[i];

      if (line.length === 0) {
        if (currentStep.length > 30) {
          recipe.steps.push({
            step_number: stepNumber++,
            instruction: currentStep.trim()
          });
          console.log(`   📋 Schritt ${stepNumber - 1}: ${currentStep.substring(0, 50)}...`);
          currentStep = '';
        }
        continue;
      }

      // Skip Section-Headers
      if (this.isSectionHeader(line)) continue;

      // Zu kurze Zeilen skippen
      if (line.length < 15) continue;

      // Nummerierter Schritt?
      const numbered = line.match(/^(\d+)[.):\s]+(.+)/);
      if (numbered) {
        if (currentStep.length > 30) {
          recipe.steps.push({
            step_number: stepNumber++,
            instruction: currentStep.trim()
          });
          console.log(`   📋 Schritt ${stepNumber - 1}: ${currentStep.substring(0, 50)}...`);
        }
        currentStep = numbered[2];
        continue;
      }

      // Füge zur aktuellen Instruktion hinzu
      if (currentStep.length > 0) {
        currentStep += ' ' + line;
      } else {
        currentStep = line;
      }
    }

    // Letzter Schritt
    if (currentStep.length > 30) {
      recipe.steps.push({
        step_number: stepNumber++,
        instruction: currentStep.trim()
      });
      console.log(`   📋 Schritt ${stepNumber - 1}: ${currentStep.substring(0, 50)}...`);
    }

    return recipe;
  }

  /**
   * PARSE EINZELNE ZUTAT - Super flexibel
   */
  static parseIngredient(line) {
    const trimmed = line.trim();

    // Liste aller Units
    const units = ['g', 'kg', 'ml', 'l', 'tl', 'el', 'esslöffel', 'teelöffel', 'prise', 'messerspitze', 'stück', 'stücke', 'scheibe', 'zehe', 'bund', 'dose', 'packung', 'päckchen'];

    // Versuche jede Unit
    for (const unit of units) {
      // Super-flexibles Pattern: "250 g Mehl", "250gMehl", "250 gMehl"
      const pattern = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${unit})\\s*([a-zA-ZäöüÄÖÜß][a-zA-ZäöüÄÖÜß\\-\\s]{1,50})`, 'i');
      const match = trimmed.match(pattern);

      if (match) {
        let amount = parseFloat(match[1].replace(',', '.'));
        // Entferne unnötige Dezimalstellen: 250.00 → 250, 250.5 → 250.5
        amount = amount % 1 === 0 ? parseInt(amount) : amount;
        const matchedUnit = match[2].toLowerCase();
        let name = match[3].trim().split(/[,;]/)[0].trim();

        if (name.length >= 2) {
          return { name, amount, unit: matchedUnit };
        }
      }
    }

    // Pattern ohne Einheit: "2 Eier", "2frische Eier"
    const noUnitPattern = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZäöüÄÖÜß][a-zäöüß\s]{2,40})/i;
    const match = trimmed.match(noUnitPattern);

    if (match) {
      let amount = parseFloat(match[1].replace(',', '.'));
      // Entferne unnötige Dezimalstellen: 2.00 → 2, 1.5 → 1.5
      amount = amount % 1 === 0 ? parseInt(amount) : amount;
      let name = match[2].trim().split(/[,;]/)[0].trim();

      if (name.length >= 2 && !/^(min|minuten|std|kcal)/.test(name.toLowerCase())) {
        return { name, amount, unit: 'stück' };
      }
    }

    return null;
  }

  /**
   * IST SECTION-HEADER?
   */
  static isSectionHeader(line) {
    if (line.length > 60 || line.length < 3) return false;

    // Komplett GROSSGESCHRIEBEN?
    if (line === line.toUpperCase() && /[A-ZÄÖÜ]/.test(line)) return true;

    // Enthält Keywords?
    const keywords = ['zutaten', 'zubereitung', 'anleitung', 'schritte', 'tipp', 'hinweis'];
    const lower = line.toLowerCase();

    for (const keyword of keywords) {
      if (lower.includes(keyword)) return true;
    }

    return false;
  }

  /**
   * BERECHNE CONFIDENCE - STRENGE VERSION
   */
  static calculateConfidence(recipe) {
    let score = 0;

    // Titel vorhanden?
    if (recipe.name && recipe.name.length > 3) score += 15;

    // Zutaten vorhanden UND QUALITÄT?
    if (recipe.ingredients.length >= 5) {
      // Prüfe Qualität der Zutaten
      const validIngredients = recipe.ingredients.filter(ing => {
        // Name muss mindestens 3 Zeichen haben
        if (ing.name.length < 3) return false;
        // Name darf nicht mit Zahl beginnen (z.B. "4 Portionen")
        if (/^\d/.test(ing.name)) return false;
        // Amount muss sinnvoll sein (> 0)
        if (ing.amount <= 0) return false;
        return true;
      });

      const qualityRatio = validIngredients.length / recipe.ingredients.length;

      if (qualityRatio >= 0.8) score += 35; // 80%+ sind gut
      else if (qualityRatio >= 0.6) score += 20; // 60-80% sind ok
      else score += 10; // < 60% sind schlecht

    } else if (recipe.ingredients.length >= 3) {
      score += 15;
    } else if (recipe.ingredients.length >= 1) {
      score += 5;
    }

    // Schritte vorhanden UND QUALITÄT? (KRITISCHSTER FAKTOR!)
    if (recipe.steps.length >= 5) {
      // Prüfe ob Schritte lang genug sind
      const validSteps = recipe.steps.filter(step => {
        return step.instruction.length >= 30; // Mindestens 30 Zeichen
      });

      const qualityRatio = validSteps.length / recipe.steps.length;

      if (qualityRatio >= 0.8) score += 40; // 80%+ lange Schritte
      else if (qualityRatio >= 0.6) score += 25; // 60-80% lange Schritte
      else score += 15; // < 60% kurze Schritte

    } else if (recipe.steps.length >= 3) {
      // 3-4 Schritte = wahrscheinlich unvollständig
      // Prüfe Länge der Schritte
      const avgLength = recipe.steps.reduce((sum, s) => sum + s.instruction.length, 0) / recipe.steps.length;
      if (avgLength >= 50) score += 15;
      else score += 10;

    } else if (recipe.steps.length >= 1) {
      // ⚠️ KRITISCH: 1-2 Schritte sind DEFINITIV unvollständig!
      // Reduziere Score drastisch
      score = Math.floor(score * 0.7); // 30% Penalty!
      console.log(`   ⚠️ Nur ${recipe.steps.length} Schritt(e) - zu wenig! Score reduziert um 30%`);
    } else {
      // Keine Schritte = komplett fehlgeschlagen
      score = Math.floor(score * 0.5); // 50% Penalty!
      console.log(`   ❌ Keine Schritte gefunden - kritischer Fehler!`);
    }

    // Portionen sinnvoll?
    if (recipe.servings > 0 && recipe.servings <= 20) score += 10;

    console.log(`   📊 Confidence-Details:`);
    console.log(`      - Zutaten: ${recipe.ingredients.length} (Score: ${score >= 35 ? '✅' : '⚠️'})`);
    console.log(`      - Schritte: ${recipe.steps.length} (Score: ${score >= 40 ? '✅' : '⚠️'})`);
    console.log(`      - Gesamt: ${Math.min(100, score)}%`);

    return Math.min(100, score);
  }
}

module.exports = SmartHybridParser;
