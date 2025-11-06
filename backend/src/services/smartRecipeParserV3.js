/**
 * ========================================
 * SMART RECIPE PARSER V3.0
 * ========================================
 *
 * Nutzt INTELLIGENTE PATTERNS aus Machine Learning
 * Multi-Pass-Ansatz: Erst Struktur, dann Details
 */

const IntelligentPatternLearner = require('./intelligentPatternLearner');

class SmartRecipeParserV3 {
  /**
   * HAUPTFUNKTION: Parse Rezept aus Text
   */
  static parse(text, patterns = null) {
    console.log('\n🧠 ===== SMART RECIPE PARSER V3.0 =====');

    // Lade intelligente Patterns
    if (!patterns) {
      patterns = IntelligentPatternLearner.getLearnedPatterns();
    }

    if (!patterns) {
      console.warn('⚠️ Keine intelligenten Patterns gefunden! Verwende Fallback.');
      return this.parseFallback(text);
    }

    console.log(`📚 Nutze Patterns gelernt aus ${patterns.learnedFrom} Rezepten`);

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    console.log(`📄 Text hat ${lines.length} nicht-leere Zeilen`);

    // MULTI-PASS PARSING
    const recipe = {
      name: '',
      ingredients: [],
      steps: [],
      servings: 0,
      prep_time: 0,
      cook_time: 0,
      description: ''
    };

    // PASS 1: STRUCTURE DETECTION
    const structure = this.detectStructure(lines, patterns);
    console.log(`\n🔍 PASS 1 - Struktur erkannt:`);
    console.log(`   - Titel: Zeile ${structure.titleLine}`);
    console.log(`   - Zutaten: Zeile ${structure.ingredientsStart} bis ${structure.ingredientsEnd}`);
    console.log(`   - Schritte: Zeile ${structure.stepsStart} bis ${structure.stepsEnd}`);

    // PASS 2: EXTRACT DETAILS
    recipe.name = this.extractTitle(lines, structure);
    recipe.servings = this.extractServings(lines, structure);
    const timeInfo = this.extractTime(lines, structure);
    recipe.prep_time = timeInfo.prep;
    recipe.cook_time = timeInfo.cook;

    console.log(`\n📝 PASS 2 - Basis-Infos:`);
    console.log(`   - Titel: "${recipe.name}"`);
    console.log(`   - Portionen: ${recipe.servings}`);
    console.log(`   - Zeit: ${recipe.prep_time} + ${recipe.cook_time} Min`);

    // PASS 3: EXTRACT INGREDIENTS
    recipe.ingredients = this.extractIngredients(lines, structure, patterns);
    console.log(`\n🥕 PASS 3 - Zutaten: ${recipe.ingredients.length} gefunden`);

    // PASS 4: EXTRACT STEPS
    recipe.steps = this.extractSteps(lines, structure, patterns);
    console.log(`📋 PASS 4 - Schritte: ${recipe.steps.length} gefunden`);

    // BERECHNE CONFIDENCE
    const confidence = this.calculateConfidence(recipe, patterns);
    console.log(`\n✅ Confidence Score: ${confidence}%`);
    console.log('=====================================\n');

    return recipe;
  }

  /**
   * PASS 1: STRUKTUR-ERKENNUNG
   * Finde wo Zutaten, Schritte, etc. sind
   */
  static detectStructure(lines, patterns) {
    const structure = {
      titleLine: 0,
      ingredientsStart: -1,
      ingredientsEnd: -1,
      stepsStart: -1,
      stepsEnd: -1
    };

    // Titel ist meist in ersten 5 Zeilen, die längste oder GROSSGESCHRIEBEN
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (line === line.toUpperCase() && line.length > 5 && line.length < 50) {
        structure.titleLine = i;
        break;
      }
    }

    // Finde Zutaten-Section mit gelernten Keywords
    const ingKeywords = patterns.sectionKeywords.ingredients.map(k => k.keyword);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      // Ist das ein Zutaten-Header?
      for (const keyword of ingKeywords) {
        if (line.includes(keyword) && line.length < 50) {
          structure.ingredientsStart = i + 1; // Nächste Zeile nach Header

          // Finde Ende: Nächster Section-Header (auch GROSSGESCHRIEBEN)
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            const nextLineLower = nextLine.toLowerCase();

            // Ist das ein neuer Section-Header?
            const isNewSection =
              this.isSectionHeader(nextLineLower, patterns) ||
              (nextLine === nextLine.toUpperCase() && nextLine.length > 5 && nextLine.length < 50 && /[A-ZÄÖÜ]/.test(nextLine));

            if (isNewSection) {
              structure.ingredientsEnd = j;
              break;
            }
          }

          if (structure.ingredientsEnd === -1) {
            // Nutze heuristic: Zutaten sind meist im ersten Drittel
            structure.ingredientsEnd = Math.min(i + 20, lines.length);
          }

          break;
        }
      }

      if (structure.ingredientsStart !== -1) break;
    }

    // Finde Schritte-Section mit MEHR Keywords
    const stepKeywords = [
      ...patterns.sectionKeywords.steps.map(k => k.keyword),
      'gemacht', 'wirds', 'gelingt', 'macht', 'tun'
    ];

    for (let i = structure.ingredientsEnd; i < lines.length; i++) {
      const line = lines[i].toLowerCase();

      // Prüfe ob es ein Header ist (kurz, ODER komplett GROSSGESCHRIEBEN)
      const isHeader = (line.length < 50) || (lines[i] === lines[i].toUpperCase() && /[A-ZÄÖÜ]/.test(lines[i]));

      if (isHeader) {
        for (const keyword of stepKeywords) {
          if (line.includes(keyword)) {
            structure.stepsStart = i + 1;
            structure.stepsEnd = lines.length;
            break;
          }
        }
      }

      if (structure.stepsStart !== -1) break;
    }

    // Fallback: Wenn keine Zutaten gefunden, nutze Position-Heuristik
    if (structure.ingredientsStart === -1) {
      const estimatedStart = Math.floor(lines.length * patterns.structuralInfo.avgIngredientPosition);
      structure.ingredientsStart = estimatedStart;
      structure.ingredientsEnd = Math.min(estimatedStart + 15, lines.length);
    }

    // Fallback: Wenn keine Schritte gefunden
    if (structure.stepsStart === -1 && structure.ingredientsEnd !== -1) {
      structure.stepsStart = structure.ingredientsEnd + 1;
      structure.stepsEnd = lines.length;
    }

    return structure;
  }

  /**
   * HELPER: Ist eine Zeile ein Section-Header?
   */
  static isSectionHeader(line, patterns) {
    // Zu lang = kein Header
    if (line.length > 50 || line.length < 3) return false;

    // Enthält Section-Keywords?
    const allKeywords = [
      ...patterns.sectionKeywords.ingredients.map(k => k.keyword),
      ...patterns.sectionKeywords.steps.map(k => k.keyword)
    ];

    for (const keyword of allKeywords) {
      if (line.includes(keyword)) return true;
    }

    // Ist komplett GROSSGESCHRIEBEN?
    if (line === line.toUpperCase() && /[A-ZÄÖÜ]/.test(line)) return true;

    return false;
  }

  /**
   * EXTRACT TITLE
   */
  static extractTitle(lines, structure) {
    const line = lines[structure.titleLine] || lines[0] || 'Unbekanntes Rezept';

    // Cleanup
    return line.replace(/[0-9]+\s*(min|stunden|std|kcal|personen)/gi, '').trim();
  }

  /**
   * EXTRACT SERVINGS
   */
  static extractServings(lines, structure) {
    // Suche in ersten 15 Zeilen
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const line = lines[i].toLowerCase();

      // "für 4 personen", "4 portionen", etc.
      const match = line.match(/(\d+)\s*(portion|person|stück|personen|portionen)/i);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return 4; // Default
  }

  /**
   * EXTRACT TIME
   */
  static extractTime(lines, structure) {
    let prep = 0;
    let cook = 0;

    // Suche in ersten 15 Zeilen
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const line = lines[i].toLowerCase();

      // "30 min aktiv", "45 minuten"
      const match = line.match(/(\d+)\s*(min|minuten|std|stunden)/i);
      if (match) {
        const time = parseInt(match[1]);
        const unit = match[2];

        // Konvertiere zu Minuten
        const minutes = unit.match(/std|stunden/) ? time * 60 : time;

        if (line.includes('aktiv') || line.includes('prep') || line.includes('vorbereitung')) {
          prep = minutes;
        } else if (line.includes('gesamt') || line.includes('total')) {
          cook = Math.max(0, minutes - prep);
        } else if (prep === 0) {
          prep = minutes;
        }
      }
    }

    return { prep, cook };
  }

  /**
   * PASS 3: EXTRACT INGREDIENTS
   */
  static extractIngredients(lines, structure, patterns) {
    const ingredients = [];

    if (structure.ingredientsStart === -1) return ingredients;

    console.log(`\n   🔍 Analysiere Zeilen ${structure.ingredientsStart} bis ${structure.ingredientsEnd}:`);

    for (let i = structure.ingredientsStart; i < structure.ingredientsEnd; i++) {
      const line = lines[i];

      if (line.length < 3) continue;

      console.log(`      Zeile ${i}: "${line}"`);

      const ingredient = this.parseIngredientLine(line, patterns);

      if (ingredient) {
        ingredients.push(ingredient);
        console.log(`         ✅ → ${ingredient.amount} ${ingredient.unit} ${ingredient.name}`);
      }
    }

    return ingredients;
  }

  /**
   * PARSE EINZELNE ZUTATEN-ZEILE
   */
  static parseIngredientLine(line, patterns) {
    const trimmed = line.trim();

    // Skip sehr kurze oder sehr lange Zeilen
    if (trimmed.length < 3 || trimmed.length > 100) return null;

    // Skip Zeilen mit Koch-Verben
    const cookingVerbs = /\b(verrühren|mischen|kochen|braten|schneiden|würzen|hinzugeben|geben|rühren|erhitzen|backen|anbraten|dünsten|garen|ziehen|lassen|servieren|garnieren|abschmecken|unterrühren)/i;
    if (cookingVerbs.test(trimmed)) return null;

    // Nutze Pattern-Learning: Welche Units sind häufig?
    const commonUnits = patterns.commonUnits.map(u => u.unit).join('|');

    // Erstelle Regex für alle Units
    const unitsList = ['g', 'kg', 'ml', 'l', 'tl', 'el', 'esslöffel', 'teelöffel', 'prise', 'messerspitze', 'stück', 'stücke', 'scheibe', 'zehe', 'bund', 'dose', 'packung', 'päckchen'];

    // SUPER-FLEXIBLE PATTERN: Matched ALLE Varianten
    // "250 g Mehl", "250gMehl", "250 gMehl", "250gRamen", "2 ELÖl"
    for (const unit of unitsList) {
      // Pattern mit optionalem Leerzeichen überall
      const pattern = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${unit})\\s*([a-zA-ZäöüÄÖÜß][a-zA-ZäöüÄÖÜß\\-\\s]{1,40})`, 'i');
      const match = trimmed.match(pattern);

      if (match) {
        const amount = parseFloat(match[1].replace(',', '.'));
        const matchedUnit = match[2].toLowerCase();
        let name = match[3].trim();

        // Cleanup Name: Schneide bei Komma/Semikolon ab
        name = name.split(/[,;]/)[0].trim();

        // Skip wenn Name zu kurz
        if (name.length < 2) continue;

        // Skip Zeit-Angaben
        if (/^(min|minuten|std|stunden|kcal)/.test(name.toLowerCase())) continue;

        console.log(`         ✅ MATCH: "${trimmed}" → ${amount} ${matchedUnit} "${name}"`);

        return { name, amount, unit: matchedUnit };
      }
    }

    // PATTERN 2: Nur Menge + Name (keine Einheit)
    // Beispiel: "2 Eier", "4 Zwiebeln", "2frische Eier"
    const pattern2 = /^(\d+(?:[.,]\d+)?)\s*([a-zA-ZäöüÄÖÜß][a-zäöüß\s]{2,30})/i;
    const match2 = trimmed.match(pattern2);

    if (match2) {
      const amount = parseFloat(match2[1].replace(',', '.'));
      let name = match2[2].trim();

      // Cleanup
      name = name.split(/[,;]/)[0].trim();

      // Skip Zeit-Angaben
      if (!/^(min|minuten|std|stunden|kcal)/.test(name.toLowerCase())) {
        console.log(`         ✅ MATCH (ohne Einheit): "${trimmed}" → ${amount} Stück "${name}"`);
        return { name, amount, unit: 'stück' };
      }
    }

    return null;
  }

  /**
   * PASS 4: EXTRACT STEPS
   */
  static extractSteps(lines, structure, patterns) {
    const steps = [];

    if (structure.stepsStart === -1) return steps;

    console.log(`\n   🔍 Analysiere Zeilen ${structure.stepsStart} bis ${structure.stepsEnd}:`);

    let currentStep = '';
    let stepNumber = 1;

    for (let i = structure.stepsStart; i < structure.stepsEnd; i++) {
      const line = lines[i];

      if (line.length === 0) {
        // Leere Zeile = Schritt-Ende
        if (currentStep.length > 30) {
          steps.push({
            step_number: stepNumber++,
            instruction: currentStep.trim()
          });
          console.log(`      ✅ Schritt ${stepNumber - 1}: ${currentStep.substring(0, 60)}...`);
          currentStep = '';
        }
        continue;
      }

      // Skip kurze Zeilen
      if (line.length < 15) continue;

      // Skip Section-Headers
      if (this.isSectionHeader(line.toLowerCase(), patterns)) {
        break;
      }

      // Ist es ein nummerierter Schritt? (z.B. "1. ", "1) ")
      const numberedMatch = line.match(/^(\d+)[.):\s]+(.+)/);
      if (numberedMatch) {
        // Speichere vorherigen Schritt
        if (currentStep.length > 30) {
          steps.push({
            step_number: stepNumber++,
            instruction: currentStep.trim()
          });
          console.log(`      ✅ Schritt ${stepNumber - 1}: ${currentStep.substring(0, 60)}...`);
        }

        currentStep = numberedMatch[2].trim();
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
      steps.push({
        step_number: stepNumber++,
        instruction: currentStep.trim()
      });
      console.log(`      ✅ Schritt ${stepNumber - 1}: ${currentStep.substring(0, 60)}...`);
    }

    return steps;
  }

  /**
   * CALCULATE CONFIDENCE
   */
  static calculateConfidence(recipe, patterns) {
    let score = 0;

    // Hat Titel?
    if (recipe.name && recipe.name.length > 3) score += 20;

    // Hat Zutaten?
    if (recipe.ingredients.length >= 3) score += 30;
    else if (recipe.ingredients.length >= 1) score += 15;

    // Hat Schritte?
    if (recipe.steps.length >= 2) score += 30;
    else if (recipe.steps.length >= 1) score += 15;

    // Hat Portionen?
    if (recipe.servings > 0) score += 10;

    // Hat Zeit?
    if (recipe.prep_time > 0) score += 10;

    return Math.min(100, score);
  }

  /**
   * FALLBACK: Wenn keine Patterns vorhanden
   */
  static parseFallback(text) {
    console.warn('⚠️ Verwende Fallback-Parser (keine ML-Patterns)');

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    return {
      name: lines[0] || 'Unbekanntes Rezept',
      ingredients: [],
      steps: [],
      servings: 4,
      prep_time: 0,
      cook_time: 0,
      description: 'Bitte Patterns trainieren für besseres Parsing.'
    };
  }
}

module.exports = SmartRecipeParserV3;
