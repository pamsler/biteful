/**
 * SMART RECIPE PARSER V2.0
 *
 * Massiv verbesserter Parser mit:
 * - Flexibler Regex (mit und ohne Leerzeichen)
 * - Fuzzy Section-Matching
 * - Mehrere Parsing-Strategien
 * - Bessere Fallbacks
 * - Debug-Logging
 */

const PatternLearner = require('./patternLearner');

class SmartRecipeParser {
  /**
   * Parse Rezept mit gelernten Patterns
   */
  static parseRecipe(text) {
    console.log('🧠 === SMART RECIPE PARSER V2.0 ===');

    const patterns = PatternLearner.getLearnedPatterns();
    const recipe = {
      name: '',
      servings: 4,
      prep_time: 0,
      cook_time: 0,
      difficulty: 'medium',
      description: '',
      ingredients: [],
      steps: []
    };

    if (Object.keys(patterns).length === 0) {
      console.log('⚠️ Keine gelernten Patterns vorhanden - verwende Fallback');
      return this.parseFallback(text);
    }

    console.log(`🧠 Parse mit ${Object.keys(patterns).length} gelernten Patterns`);

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    console.log(`📄 Text hat ${lines.length} Zeilen`);

    // 1. TITEL EXTRAHIEREN
    recipe.name = this.extractTitle(lines, patterns);
    console.log(`📌 Titel: "${recipe.name}"`);

    // 2. PORTIONEN EXTRAHIEREN
    recipe.servings = this.extractServings(text, patterns);
    console.log(`👥 Portionen: ${recipe.servings}`);

    // 3. ZEIT EXTRAHIEREN
    const time = this.extractTime(text);
    recipe.prep_time = time.prep;
    recipe.cook_time = time.cook;
    console.log(`⏱️ Zeit: ${time.prep} Min Prep + ${time.cook} Min Cook`);

    // 4. ZUTATEN EXTRAHIEREN
    recipe.ingredients = this.extractIngredientsV2(lines, text, patterns);
    console.log(`🥕 Zutaten gefunden: ${recipe.ingredients.length}`);

    // 5. SCHRITTE EXTRAHIEREN
    recipe.steps = this.extractStepsV2(lines, patterns);
    console.log(`📝 Schritte gefunden: ${recipe.steps.length}`);

    // 6. BESCHREIBUNG EXTRAHIEREN
    recipe.description = this.extractDescription(lines, recipe);

    console.log('✅ === PARSING ABGESCHLOSSEN ===');
    return recipe;
  }

  /**
   * V2: VERBESSERTE ZUTATEN-EXTRAKTION
   */
  static extractIngredientsV2(lines, fullText, patterns) {
    const ingredients = [];

    // STRATEGIE 1: Finde Zutaten-Section mit Fuzzy-Matching
    const section = this.findSection(lines, ['zutaten', 'ingredients', 'das brauchst', 'du brauchst', 'für', 'personen']);

    if (section.found) {
      console.log(`🎯 Zutaten-Section gefunden: Zeile ${section.startIdx} bis ${section.endIdx}`);
      console.log(`   🔍 Zeilen in dieser Section:`);

      for (let i = section.startIdx; i < section.endIdx; i++) {
        const line = lines[i];
        if (line.length < 3) continue;

        console.log(`      Zeile ${i}: "${line}"`);

        const ingredient = this.parseIngredientLineV2(line, patterns.ingredients_with_quantity);
        if (ingredient && ingredient.name.length > 0) {
          ingredients.push(ingredient);
        }
      }

      console.log(`   ✓ ${ingredients.length} Zutaten aus Section extrahiert`);
    }

    // STRATEGIE 2: Wenn Section nicht gefunden oder zu wenig Zutaten → Suche überall
    if (ingredients.length < 3) {
      console.log('🔍 Fallback: Suche Zutaten im gesamten Text');

      for (const line of lines) {
        // Suche nach Zeilen mit Mengenangaben
        if (this.hasQuantityIndicator(line)) {
          const ingredient = this.parseIngredientLineV2(line, patterns.ingredients_with_quantity);

          // Prüfe ob schon vorhanden (keine Duplikate)
          if (ingredient && ingredient.name.length > 0) {
            const exists = ingredients.some(i =>
              i.name.toLowerCase() === ingredient.name.toLowerCase()
            );

            if (!exists) {
              ingredients.push(ingredient);
            }
          }
        }
      }

      console.log(`   ✓ ${ingredients.length} Zutaten gesamt (nach Fallback)`);
    }

    return ingredients;
  }

  /**
   * V2: VERBESSERTE SCHRITTE-EXTRAKTION
   */
  static extractStepsV2(lines, patterns) {
    const steps = [];

    // STRATEGIE 1: Finde Zubereitungs-Section
    const section = this.findSection(lines, ['zubereitung', 'anleitung', 'schritte', 'instructions', 'preparation', 'so geht']);

    if (section.found) {
      console.log(`🎯 Schritte-Section gefunden: Zeile ${section.startIdx} bis Ende`);
      console.log(`   🔍 Zeilen in dieser Section:`);

      let stepNumber = 1;
      const stepPattern = patterns.steps_numbered;
      let currentStep = '';

      for (let i = section.startIdx; i < lines.length; i++) {
        const line = lines[i].trim();

        console.log(`      Zeile ${i}: "${line}"`);

        // Skip leere Zeilen
        if (line.length === 0) {
          // Wenn wir einen laufenden Schritt haben, speichere ihn
          if (currentStep.length > 20) {
            steps.push({
              step_number: stepNumber++,
              instruction: currentStep.trim()
            });
            currentStep = '';
          }
          continue;
        }

        // Skip zu kurze Zeilen
        if (line.length < 10) continue;

        // Skip neue Sections
        if (this.isSectionHeader(line)) {
          console.log(`   ⚠️ Neue Section gefunden, stoppe: "${line}"`);
          // Speichere laufenden Schritt
          if (currentStep.length > 20) {
            steps.push({
              step_number: stepNumber++,
              instruction: currentStep.trim()
            });
          }
          break;
        }

        // Versuche nummerierte Schritte zu finden (z.B. "1. ", "1) ", "1: ")
        const numberedMatch = line.match(/^(\d+)[.):\s]+(.+)/);
        if (numberedMatch) {
          // Speichere vorherigen Schritt falls vorhanden
          if (currentStep.length > 20) {
            steps.push({
              step_number: stepNumber++,
              instruction: currentStep.trim()
            });
          }

          currentStep = numberedMatch[2].trim();

          if (stepPattern) {
            PatternLearner.updatePatternSuccess('steps_numbered', true);
          }
          continue;
        }

        // Keine Nummerierung: Füge zur laufenden Instruktion hinzu
        // Aber nur wenn es keine Zutat ist
        if (!this.hasQuantityIndicator(line)) {
          if (currentStep.length > 0) {
            currentStep += ' ' + line;
          } else {
            currentStep = line;
          }
        }
      }

      // Letzter Schritt speichern falls noch offen
      if (currentStep.length > 20) {
        steps.push({
          step_number: stepNumber++,
          instruction: currentStep.trim()
        });
      }

      console.log(`   ✓ ${steps.length} Schritte aus Section extrahiert`);
    }

    // STRATEGIE 2: Suche überall nach nummerierten Zeilen
    if (steps.length === 0) {
      console.log('🔍 Fallback: Suche nummerierte Schritte im gesamten Text');

      let stepNumber = 1;
      for (const line of lines) {
        const numberedMatch = line.match(/^(\d+)[.):\s]+(.+)/);
        if (numberedMatch && line.length > 20) {
          const instruction = numberedMatch[2].trim();
          if (instruction.length > 10 && !this.hasQuantityIndicator(line)) {
            steps.push({
              step_number: stepNumber++,
              instruction: instruction
            });
          }
        }
      }

      console.log(`   ✓ ${steps.length} nummerierte Schritte gefunden`);
    }

    // STRATEGIE 3: Wenn immer noch keine Schritte, suche nach langen Absätzen nach der Zutaten-Section
    if (steps.length === 0) {
      console.log('🔍 Fallback 2: Suche lange Absätze als Schritte');

      const zutatSection = this.findSection(lines, ['zutaten', 'ingredients', 'das brauchst', 'du brauchst', 'für', 'personen']);
      const startIdx = zutatSection.found ? zutatSection.endIdx : Math.floor(lines.length / 2);

      let stepNumber = 1;
      let currentStep = '';

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.length === 0) {
          if (currentStep.length > 30) {
            steps.push({
              step_number: stepNumber++,
              instruction: currentStep.trim()
            });
            currentStep = '';
          }
          continue;
        }

        if (line.length > 15 && !this.hasQuantityIndicator(line) && !this.isSectionHeader(line)) {
          if (currentStep.length > 0) {
            currentStep += ' ' + line;
          } else {
            currentStep = line;
          }
        }
      }

      // Letzter Schritt
      if (currentStep.length > 30) {
        steps.push({
          step_number: stepNumber++,
          instruction: currentStep.trim()
        });
      }

      console.log(`   ✓ ${steps.length} Absätze als Schritte gefunden`);
    }

    return steps;
  }

  /**
   * HELPER: Finde Section mit Fuzzy-Matching
   */
  static findSection(lines, keywords) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();

      // Prüfe jeden Keyword
      for (const keyword of keywords) {
        if (lowerLine.includes(keyword)) {
          // Finde Ende der Section (nächster Section-Header oder Ende)
          let endIdx = lines.length;
          for (let j = i + 1; j < lines.length; j++) {
            if (this.isSectionHeader(lines[j])) {
              endIdx = j;
              break;
            }
          }

          return {
            found: true,
            startIdx: i + 1,  // Nächste Zeile nach Header
            endIdx: endIdx,
            header: line
          };
        }
      }
    }

    return { found: false };
  }

  /**
   * HELPER: Prüfe ob Zeile ein Section-Header ist
   */
  static isSectionHeader(line) {
    const lowerLine = line.toLowerCase();

    // Typische Section-Headers
    const headers = [
      'zutaten', 'ingredients', 'zubereitung', 'anleitung', 'schritte',
      'instructions', 'preparation', 'nährwerte', 'nutrition', 'tipp',
      'hinweis', 'note', 'varianten'
    ];

    // Prüfe ob Zeile nur aus Header besteht (kurz und passt zu Keywords)
    if (line.length < 30) {
      return headers.some(h => lowerLine.includes(h));
    }

    return false;
  }

  /**
   * HELPER: Prüfe ob Zeile Mengenangaben enthält
   */
  static hasQuantityIndicator(line) {
    // Suche nach Zahlen gefolgt von Einheiten (mit oder ohne Leerzeichen)
    return /\d+\s*(?:g|kg|ml|l|tl|el|esslöffel|teelöffel|prise|messerspitze|stück|stücke|scheibe|zehe)/i.test(line);
  }

  /**
   * V2: VERBESSERTE ZUTATEN-ZEILE PARSER
   */
  static parseIngredientLineV2(line, pattern) {
    // VERBESSERTE REGEX V3: Nur Zutaten am Zeilenanfang, keine Koch-Verben!
    // Beispiele: "250g Mehl", "250 g Mehl", "2EL Öl", "1 Prise Salz"

    const trimmedLine = line.trim();

    // 🚫 FILTER 1: Lehne Zeilen mit Koch-Verben ab
    const cookingVerbs = /\b(verrühren|mischen|kochen|braten|schneiden|würzen|hinzugeben|geben|rühren|erhitzen|backen|anbraten|dünsten|garen|ziehen|lassen|servieren|garnieren|abschmecken)\b/i;
    if (cookingVerbs.test(trimmedLine)) {
      return null;
    }

    // 🚫 FILTER 2: Lehne Zeilen ab, die mit Satzzeichen starten oder "Ca." enthalten
    if (/^[.,:;!?]/.test(trimmedLine) || /\bca\.\s*\d+/i.test(trimmedLine)) {
      return null;
    }

    // 🚫 FILTER 3: Lehne sehr lange Zeilen ab (>80 Zeichen = wahrscheinlich Zubereitungsschritte)
    if (trimmedLine.length > 80) {
      return null;
    }

    const regexPatterns = [
      // Pattern 1: Mit Einheit und Leerzeichen (z.B. "250 g Mehl")
      {
        regex: /^(\d+(?:[.,]\d+)?)\s+(g|kg|ml|l|tl|el|esslöffel|teelöffel|prise|messerspitze|stück|stücke|scheibe|zehe|bund|dose|packung|päckchen)\s+([a-zA-ZäöüÄÖÜß][^,;.!?]{2,50})/i,
        hasUnit: true,
        amountIdx: 1,
        unitIdx: 2,
        nameIdx: 3,
        description: "mit Leerzeichen vor und nach Einheit"
      },
      // Pattern 2: Leerzeichen VOR Einheit, aber NICHT NACH (z.B. "250 gMehl", "2 ELÖl")
      {
        regex: /^(\d+(?:[.,]\d+)?)\s+(g|kg|ml|l|tl|el|esslöffel|teelöffel|prise|messerspitze|stück|stücke|scheibe|zehe|bund|dose|packung|päckchen)([A-ZÄÖÜ][a-zA-ZäöüÄÖÜß\-]{2,50})/,
        hasUnit: true,
        amountIdx: 1,
        unitIdx: 2,
        nameIdx: 3,
        description: "Leerzeichen vor g, aber nicht nach"
      },
      // Pattern 3: OHNE Leerzeichen (z.B. "250gMehl", "2ELÖl")
      {
        regex: /^(\d+(?:[.,]\d+)?)(g|kg|ml|l|tl|el|esslöffel|teelöffel|prise|messerspitze|stück|stücke|scheibe|zehe|bund|dose|packung|päckchen)([A-ZÄÖÜ][a-zA-ZäöüÄÖÜß\-]{2,50})/,
        hasUnit: true,
        amountIdx: 1,
        unitIdx: 2,
        nameIdx: 3,
        description: "komplett ohne Leerzeichen"
      },
      // Pattern 4: Nur Zahl + Name OHNE Einheit (z.B. "2 Eier", "1 Zwiebel")
      {
        regex: /^(\d+(?:[.,]\d+)?)\s+(?!g|kg|ml|l|tl|el|min|minuten|std|stunden)([A-ZÄÖÜ][a-zäöüß]{2,30})(?:\s|,|$)/i,
        hasUnit: false,
        amountIdx: 1,
        unitIdx: null,
        nameIdx: 2,
        description: "nur Zahl ohne Einheit"
      }
    ];

    for (let i = 0; i < regexPatterns.length; i++) {
      const patternConfig = regexPatterns[i];
      const match = trimmedLine.match(patternConfig.regex);

      if (match) {
        const amount = parseFloat(match[patternConfig.amountIdx].replace(',', '.'));
        let unit = '';
        let name = '';

        if (patternConfig.hasUnit) {
          unit = match[patternConfig.unitIdx]?.toLowerCase().trim() || '';
          name = match[patternConfig.nameIdx]?.trim() || '';
        } else {
          // Kein Unit-Pattern (z.B. "2 Eier")
          unit = '';
          name = match[patternConfig.nameIdx]?.trim() || '';
        }

        // Cleanup: Entferne führende Sonderzeichen und begrenze auf erstes Wort(paar)
        name = name.replace(/^[,\-:•\s]+/, '').trim();

        // Schneide bei erstem Satzzeichen oder nach 50 Zeichen ab
        const firstPunctuation = name.search(/[.,:;!?]/);
        if (firstPunctuation > 0) {
          name = name.substring(0, firstPunctuation).trim();
        }

        // Skip wenn Name zu kurz oder nur Zahlen
        if (name.length < 2 || /^\d+$/.test(name)) {
          continue;
        }

        // Skip wenn Name typische Nicht-Zutaten-Wörter enthält
        if (name.match(/^(min|minuten|std|stunden|kcal|kalorien)/i)) {
          continue;
        }

        // Erfolg!
        if (pattern) {
          PatternLearner.updatePatternSuccess('ingredients_with_quantity', true);
        }

        console.log(`      🥕 "${trimmedLine}" → ${amount} ${unit} | ${name}`);

        return {
          name: name,
          amount: amount || 0,
          unit: unit || 'stück'
        };
      }
    }

    // Kein Fallback mehr - wenn keine Pattern matcht, ist es keine Zutat!
    return null;
  }

  /**
   * Extrahiere Titel mit gelernten Patterns
   */
  static extractTitle(lines, patterns) {
    const titlePattern = patterns.title_top;

    if (titlePattern && titlePattern.position === 'top') {
      // Titel ist wahrscheinlich in den ersten 5 Zeilen
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];

        // Skip sehr kurze Zeilen und reine Zahlen
        if (line.length < 5 || /^\d+$/.test(line)) continue;

        // Skip Metadaten-Zeilen
        if (line.match(/Portionen|Min\.|kcal|Personen|Kalorien|AKTIV|GESAMT/i)) continue;

        // Titel gefunden: Zwischen 10 und 100 Zeichen
        if (line.length >= 10 && line.length <= 100) {
          return line;
        }
      }
    }

    // Fallback: Erste sinnvolle Zeile
    for (const line of lines) {
      if (line.length >= 10 && line.length <= 100 && !line.match(/Min\.|kcal|Portion/i)) {
        return line;
      }
    }

    return 'Unbekannt';
  }

  /**
   * Extrahiere Portionen mit gelernten Patterns
   */
  static extractServings(text, patterns) {
    const servingsPattern = patterns.servings;

    if (servingsPattern && servingsPattern.keywords) {
      for (const keyword of servingsPattern.keywords) {
        const regex = new RegExp(`(\\d+)\\s*${keyword}`, 'i');
        const match = text.match(regex);

        if (match) {
          PatternLearner.updatePatternSuccess('servings', true);
          return parseInt(match[1]);
        }
      }
    }

    // Erweiterte Fallback-Suche
    const fallbackPatterns = [
      /für\s+(\d+)\s*(portion|person|pers|stück)/i,
      /(\d+)\s*(portion|person|pers|stück)/i,
      /ergibt\s+(\d+)\s*(portion|person)/i
    ];

    for (const pattern of fallbackPatterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    return 4;  // Default
  }

  /**
   * Extrahiere Zeit
   */
  static extractTime(text) {
    const result = { prep: 0, cook: 0 };

    // Zubereitungszeit
    const prepMatch = text.match(/(?:Vorbereitung|Prep|AKTIV|Zubereitungszeit|Arbeitszeit)[:\s]*(\d+)\s*(?:Min|Minuten)/i);
    if (prepMatch) {
      result.prep = parseInt(prepMatch[1]);
    }

    // Kochzeit / Gesamtzeit
    const cookMatch = text.match(/(?:Kochzeit|Koch|Cook|GESAMT|Gesamtzeit|Total)[:\s]*(\d+)\s*(?:Min|Minuten)/i);
    if (cookMatch) {
      result.cook = parseInt(cookMatch[1]);
    }

    // Fallback: Erste Zeitangabe
    if (result.prep === 0 && result.cook === 0) {
      const anyTime = text.match(/(\d+)\s*(?:Min|Minuten)/i);
      if (anyTime) {
        result.cook = parseInt(anyTime[1]);
      }
    }

    return result;
  }

  /**
   * Extrahiere Beschreibung
   */
  static extractDescription(lines, recipe) {
    // Beschreibung ist meist zwischen Titel und Zutaten
    const titleIdx = lines.findIndex(l => l === recipe.name);
    const zutatenIdx = lines.findIndex(l => l.toLowerCase().match(/^(zutaten|ingredients|das brauchst)/i));

    if (titleIdx >= 0 && zutatenIdx > titleIdx + 1) {
      const descLines = lines.slice(titleIdx + 1, zutatenIdx)
        .filter(l => l.length > 20 && !l.match(/\d+\s*Min\.|kcal|Portion|AKTIV|GESAMT/i));

      if (descLines.length > 0) {
        return descLines.join(' ').substring(0, 200);
      }
    }

    return '';
  }

  /**
   * Fallback Parser wenn keine Patterns vorhanden
   */
  static parseFallback(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    return {
      name: lines[0] || 'Unbekannt',
      servings: 4,
      prep_time: 0,
      cook_time: 0,
      difficulty: 'medium',
      description: '',
      ingredients: [],
      steps: []
    };
  }
}

module.exports = SmartRecipeParser;
