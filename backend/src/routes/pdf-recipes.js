const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const { Pool } = require('pg');
const { getTrainingDB } = require('../db/training-db');
const crypto = require('../services/cryptoService');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const EPub = require('epub2').EPub;
const fs = require('fs').promises;
const path = require('path');
const PatternLearner = require('../services/patternLearner');
const SmartRecipeParser = require('../services/smartRecipeParser');
const IntelligentPatternLearner = require('../services/intelligentPatternLearner');
const SmartRecipeParserV3 = require('../services/smartRecipeParserV3');
const SimpleLearningSystem = require('../services/simpleLearningSystem');
const SmartHybridParser = require('../services/smartHybridParser');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// PDF/EPUB Upload Konfiguration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max (EPUB können größer sein)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/epub+zip',
      'application/epub',
      'application/x-epub+zip'
    ];
    const allowedExtensions = ['.pdf', '.epub'];

    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF- und EPUB-Dateien sind erlaubt!'));
    }
  }
});

// ============================================
// SMART HYBRID PARSER - AI unterstützt ML
// ============================================
function parseRecipeWithSmartHybrid(text, forceAutonomous = false) {
  console.log('🧠 Starte SMART HYBRID PARSER V2.0...');

  // Nutze Smart Hybrid Parser
  return SmartHybridParser.parse(text, forceAutonomous);
}

// ============================================
// ALTE REGEX-FUNKTION (Fallback, falls benötigt)
// ============================================
function parseRecipeWithRegexOld(text) {
  console.log('🔍 Starte Regex-Parsing (Fallback)...');

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

  // Text normalisieren
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // ========================================
  // 1. REZEPTNAME EXTRAHIEREN
  // ========================================
  let nameLines = [];
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];

    // Stop bei Zutaten-Keywords
    if (line.match(/^(Zutaten|DAS BRAUCHTS|Ingredients|ZUTATEN|Portionen|PERSONEN)/i)) {
      break;
    }

    // Skip Zeit-Zeilen, Nährwerte, Kalorien
    if (line.match(/^\d+\s*Min\./i)) continue;
    if (line.match(/^(AKTIV|GESAMT|kcal|PRO PERSON)/i)) continue;
    if (line.match(/Fett:|Kohlenhydrate:|Eiweiss:|Energie:/i)) continue;
    if (line.match(/\d+\s*kcal/i)) continue;

    // Sammle sinnvolle Zeilen
    if (line.length > 2 && !line.match(/^\d+$/)) {
      nameLines.push(line);
    }
  }

  recipe.name = nameLines.join(' ').trim();
  console.log('📝 Rezeptname:', recipe.name);

  // ========================================
  // 2. PORTIONEN EXTRAHIEREN
  // ========================================
  const servingsPatterns = [
    /(\d+)\s*Portionen?/i,
    /(\d+)\s*Personen?/i,
    /FÜR\s*(\d+)\s*PERSONEN?/i,
    /(\d+)\s*servings?/i
  ];

  for (const pattern of servingsPatterns) {
    const match = text.match(pattern);
    if (match) {
      recipe.servings = parseInt(match[1]);
      console.log('👥 Portionen:', recipe.servings);
      break;
    }
  }

  // ========================================
  // 3. ZEIT EXTRAHIEREN
  // ========================================
  // Fooby Format: "30 Min. AKTIV" und "30 Min. GESAMT"
  const aktivMatch = text.match(/(\d+)\s*Min\.\s*AKTIV/i);
  const gesamtMatch = text.match(/(\d+)\s*Min\.\s*GESAMT/i);

  if (gesamtMatch) {
    const totalTime = parseInt(gesamtMatch[1]);

    if (aktivMatch) {
      // Beide vorhanden: AKTIV = prep, GESAMT-AKTIV = cook
      recipe.prep_time = parseInt(aktivMatch[1]);
      recipe.cook_time = Math.max(0, totalTime - recipe.prep_time);
      console.log('⏱️ Zeit (Fooby mit AKTIV):', { prep: recipe.prep_time, cook: recipe.cook_time });
    } else {
      // Nur GESAMT: Alles ist Kochzeit
      recipe.prep_time = 0;
      recipe.cook_time = totalTime;
      console.log('⏱️ Zeit (Fooby nur GESAMT):', { prep: recipe.prep_time, cook: recipe.cook_time });
    }
  }
  // Swissmilk Format: "Zubereiten: 45min"
  else {
    const zubereitenMatch = text.match(/Zubereiten:\s*(\d+)\s*min/i);
    const tischMatch = text.match(/Auf dem Tisch in:\s*(\d+)\s*min/i);

    if (zubereitenMatch || tischMatch) {
      const totalTime = parseInt((zubereitenMatch || tischMatch)[1]);
      // Nur Zubereitungszeit vorhanden, keine Aufteilung
      recipe.prep_time = 0;
      recipe.cook_time = totalTime;
      console.log('⏱️ Zeit (Swissmilk):', { prep: recipe.prep_time, cook: recipe.cook_time });
    }
  }

  // Schwierigkeit basierend auf Zeit
  const totalTime = recipe.prep_time + recipe.cook_time;
  if (totalTime > 0) {
    if (totalTime < 30) {
      recipe.difficulty = 'easy';
    } else if (totalTime > 60) {
      recipe.difficulty = 'hard';
    }
  }

  // ========================================
  // 4. ZUTATEN EXTRAHIEREN
  // ========================================
  const ingredientsKeywords = [
    'Zutaten',
    'ZUTATEN',
    'DAS BRAUCHTS FÜR',
    'DAS BRAUCHTS',
    'Das brauchts',
    'Ingredients',
    'INGREDIENTS'
  ];

  const stepsKeywords = [
    'Zubereitung',
    'ZUBEREITUNG',
    'UND SO WIRDS GEMACHT',
    'Und so wirds gemacht',
    'SO WIRD',
    'Instructions',
    'Preparation'
  ];

  let ingredientsStartIndex = -1;
  let ingredientsEndIndex = -1;

  // Finde Start der Zutaten-Sektion
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const keyword of ingredientsKeywords) {
      if (line.includes(keyword)) {
        ingredientsStartIndex = i + 1;
        break;
      }
    }
    if (ingredientsStartIndex !== -1) break;
  }

  // Finde Ende der Zutaten-Sektion (Start der Zubereitung)
  if (ingredientsStartIndex !== -1) {
    for (let i = ingredientsStartIndex; i < lines.length; i++) {
      const line = lines[i];
      for (const keyword of stepsKeywords) {
        if (line.includes(keyword)) {
          ingredientsEndIndex = i;
          break;
        }
      }
      if (ingredientsEndIndex !== -1) break;
    }
  }

  if (ingredientsStartIndex !== -1 && ingredientsEndIndex !== -1) {
    const ingredientLines = lines.slice(ingredientsStartIndex, ingredientsEndIndex);
    console.log(`🥕 Verarbeite ${ingredientLines.length} Zutaten-Zeilen`);

    for (const line of ingredientLines) {
      // Skip Subheadings und Portionen-Angaben
      if (line.match(/^\d+\s*(Portionen?|Personen?)/i)) continue;
      if (line.match(/^(Für|FÜR)\s*\d+/i)) continue;
      if (line.length < 3) continue;

      // Skip Fooby Subheadings wie "Ramen", "Speck", "Carbonara" (einzelnes Wort)
      if (line.match(/^[A-ZÄÖÜ][a-zäöüß]+$/) && line.split(' ').length === 1 && line.length < 15) continue;

      // Skip Swissmilk Subheadings mit Doppelpunkt
      if (line.endsWith(':') && line.split(' ').length <= 2) continue;

      // Pattern 1: Range-Mengen "300 - 400 g Hörnli" oder "500-600 g Fleisch"
      // WICHTIG: Flexible Leerzeichen, da PDF manchmal "250 gRamen" statt "250 g Ramen" extrahiert
      const rangePattern = /^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|dl|cl|EL|TL|Teelöffel|Esslöffel|Prise|Prisen|Stück|Stk|Bund|Bündel|Bundzwiebeln?|Dose|Dosen|Packung|Packungen|Scheibe|Scheiben|Zehe|Zehen|Zweig|Zweige)\s*(.+)$/i;

      let match = line.match(rangePattern);
      if (match) {
        const min = parseFloat(match[1].replace(',', '.'));
        const max = parseFloat(match[2].replace(',', '.'));
        const unit = match[3].trim();
        const ingredientFull = match[4].trim();

        const parts = ingredientFull.split(',');
        const name = parts[0].trim();
        const notes = parts.slice(1).join(',').trim();

        recipe.ingredients.push({
          ingredient_name: name,
          amount: min,
          amount_min: min,
          amount_max: max,
          unit: unit,
          notes: notes
        });
        console.log(`  ✓ Range-Zutat: ${min}-${max} ${unit} ${name}`);
        continue;
      }

      // Pattern 2: Normale Mengen "500 g Mehl" oder "2 EL Öl" oder "250 gRamen" (OHNE Leerzeichen!)
      // WICHTIG: \s* statt \s+ um auch ohne Leerzeichen zu matchen
      const normalPattern = /^(\d+(?:[.,\/]\d+)?)\s*(g|kg|ml|l|dl|cl|EL|TL|Teelöffel|Esslöffel|Prise|Prisen|Stück|Stk|Bund|Bündel|Bundzwiebeln?|Dose|Dosen|Packung|Packungen|Scheibe|Scheiben|Zehe|Zehen|Zweig|Zweige)\s*(.+)$/i;

      match = line.match(normalPattern);
      if (match) {
        const amount = parseFloat(match[1].replace(',', '.').replace('/', '.'));
        const unit = match[2].trim();
        const ingredientFull = match[3].trim();

        const parts = ingredientFull.split(',');
        const name = parts[0].trim();
        const notes = parts.slice(1).join(',').trim();

        recipe.ingredients.push({
          ingredient_name: name,
          amount: amount,
          unit: unit,
          notes: notes
        });
        console.log(`  ✓ Zutat: ${amount} ${unit} ${name}`);
        continue;
      }

      // Pattern 3: "2 frische Eier" oder "2 Zwiebeln"
      const simplePattern = /^(\d+(?:[.,]\d+)?)\s+(.+)$/;
      match = line.match(simplePattern);
      if (match) {
        const amount = parseFloat(match[1].replace(',', '.'));
        const ingredientFull = match[2].trim();

        const parts = ingredientFull.split(',');
        const name = parts[0].trim();
        const notes = parts.slice(1).join(',').trim();

        recipe.ingredients.push({
          ingredient_name: name,
          amount: amount,
          unit: '',
          notes: notes
        });
        console.log(`  ✓ Zutat ohne Einheit: ${amount} ${name}`);
        continue;
      }

      // Pattern 4: Nur Text ohne Menge "Salz und Pfeffer" oder "Salzwasser, siedend"
      if (line.length > 3 && !line.match(/^[A-ZÄÖÜ\s]+:$/)) {
        const parts = line.split(',');
        const name = parts[0].trim();
        const notes = parts.slice(1).join(',').trim();

        recipe.ingredients.push({
          ingredient_name: name,
          amount: 1,
          unit: '',
          notes: notes
        });
        console.log(`  ✓ Zutat ohne Menge: ${name}`);
      }
    }
  }

  console.log(`✅ ${recipe.ingredients.length} Zutaten extrahiert`);

  // ========================================
  // 5. ZUBEREITUNGSSCHRITTE EXTRAHIEREN
  // ========================================
  let stepsStartIndex = -1;

  // Finde Start der Schritte-Sektion
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const keyword of stepsKeywords) {
      if (line.includes(keyword)) {
        stepsStartIndex = i + 1;
        break;
      }
    }
    if (stepsStartIndex !== -1) break;
  }

  if (stepsStartIndex !== -1) {
    const stepLines = lines.slice(stepsStartIndex);
    console.log(`📋 Verarbeite ${stepLines.length} Schritte-Zeilen`);
    console.log('📋 Schritte-Zeilen:', JSON.stringify(stepLines.slice(0, 30), null, 2));

    // Prüfe ob es nummerierte Schritte gibt (Swissmilk Format)
    // Die Nummern können auf separaten Zeilen stehen: "1." dann der Text
    let hasNumberedSteps = false;
    for (let i = 0; i < stepLines.length; i++) {
      const line = stepLines[i];
      // Prüfe ob Zeile MIT Text nach Nummer hat ODER nur Nummer ist (nächste Zeile ist dann der Text)
      if (line.match(/^\d+\.\s+\w/) || line.match(/^\d+\.$/)) {
        hasNumberedSteps = true;
        break;
      }
    }

    let currentSteps = [];

    if (hasNumberedSteps) {
      console.log('  → Swissmilk-Format erkannt (nummerierte Schritte)');

      let currentStepText = '';

      for (let i = 0; i < stepLines.length; i++) {
        const line = stepLines[i];

        // Skip Footer-Zeilen
        if (line.includes('www.') || line.includes('fooby.ch') || line.includes('swissmilk.ch')) continue;
        if (line.includes('♥ saisonal') || line.includes('GUT ZU WISSEN')) continue;
        if (line.match(/^\d+\/\d+$/)) continue; // "1/2", "2/2"
        if (line.match(/Portion enthält/i)) continue;
        if (line.match(/Risotto kochen\?/i)) continue;
        // Skip Zeit-Zeilen
        if (line.match(/^Zubereiten:/i) || line.match(/^Auf dem Tisch/i)) continue;

        // Zeile ist nur eine Nummer "1.", "2.", etc.
        if (line.match(/^\d+\.$/)) {
          // Speichere vorherigen Schritt
          if (currentStepText.length > 10) {
            currentSteps.push({
              step_number: currentSteps.length + 1,
              instruction: currentStepText.endsWith('.') ? currentStepText : currentStepText + '.'
            });
            console.log(`  ✓ Schritt ${currentSteps.length}: ${currentStepText.substring(0, 50)}...`);
          }
          currentStepText = '';
          continue;
        }

        // Zeile startet mit "1. Text"
        const stepMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (stepMatch) {
          // Speichere vorherigen Schritt
          if (currentStepText.length > 10) {
            currentSteps.push({
              step_number: currentSteps.length + 1,
              instruction: currentStepText.endsWith('.') ? currentStepText : currentStepText + '.'
            });
            console.log(`  ✓ Schritt ${currentSteps.length}: ${currentStepText.substring(0, 50)}...`);
          }

          currentStepText = stepMatch[2].trim();
          continue;
        }

        // Normale Zeile - füge zum aktuellen Schritt hinzu
        if (line.length > 5) {
          if (currentStepText) {
            currentStepText += ' ' + line;
          } else {
            // Zeile ohne Nummer am Anfang - könnte auch ein Schritt sein
            currentStepText = line;
          }
        }
      }

      // Letzter Schritt
      if (currentStepText.length > 10) {
        currentSteps.push({
          step_number: currentSteps.length + 1,
          instruction: currentStepText.endsWith('.') ? currentStepText : currentStepText + '.'
        });
        console.log(`  ✓ Schritt ${currentSteps.length}: ${currentStepText.substring(0, 50)}...`);
      }
    }
    // FOOBY: Schritte sind in Sektionen (Ramen, Speck, Carbonara)
    else {
      console.log('  → Fooby-Format erkannt (Sektionen-basiert)');

      let currentStepText = '';

      for (const line of stepLines) {
        // Skip Footer-Zeilen
        if (line.includes('www.') || line.includes('fooby.ch') || line.includes('swissmilk.ch')) continue;
        if (line.includes('GUT ZU WISSEN') || line.includes('Das Rezept findest')) continue;

        // Subheadings (Ramen, Speck, Carbonara) - neuer Schritt
        // Muss VORHER geprüft werden bevor length-Check!
        if (line.match(/^[A-ZÄÖÜ][a-zäöüß]+$/) && line.split(' ').length === 1 && line.length < 20) {
          // Speichere vorherigen Schritt
          if (currentStepText.length > 20) {
            currentSteps.push({
              step_number: currentSteps.length + 1,
              instruction: currentStepText.endsWith('.') ? currentStepText : currentStepText + '.'
            });
            console.log(`  ✓ Schritt ${currentSteps.length}: ${currentStepText.substring(0, 50)}...`);
          }
          currentStepText = '';
          continue;
        }

        // Zu kurze Zeilen skippen (aber NACH Subheading-Check)
        if (line.length < 15) continue;

        // Sammle Schritt-Text
        if (currentStepText) {
          currentStepText += ' ' + line;
        } else {
          currentStepText = line;
        }
      }

      // Letzter Schritt
      if (currentStepText.length > 20) {
        currentSteps.push({
          step_number: currentSteps.length + 1,
          instruction: currentStepText.endsWith('.') ? currentStepText : currentStepText + '.'
        });
        console.log(`  ✓ Schritt ${currentSteps.length}: ${currentStepText.substring(0, 50)}...`);
      }
    }

    recipe.steps = currentSteps;
  }

  console.log(`✅ ${recipe.steps.length} Schritte extrahiert`);

  return recipe;
}

// ============================================
// OPTION C: AI-BASIERTES PDF PARSING
// ============================================
async function parseRecipeWithAI(text, provider, apiKey) {
  const prompt = `Du bist ein intelligenter Rezept-Extraktor. Analysiere den folgenden Text aus einem PDF-Rezept und extrahiere ALLE Informationen präzise.

WICHTIG: Antworte NUR mit einem validen JSON-Objekt, ohne zusätzlichen Text davor oder danach!

Das JSON muss EXAKT folgende Struktur haben:
{
  "name": "Rezeptname (NUR der Titel, KEINE Nährwerte, keine Kalorien)",
  "servings": 4,
  "prep_time": 0,
  "cook_time": 30,
  "difficulty": "easy|medium|hard",
  "description": "",
  "ingredients": [
    {
      "ingredient_name": "Zutat (NUR der Name, KEINE Einheit hier)",
      "amount": 200,
      "amount_min": 200,
      "amount_max": 300,
      "unit": "g (NUR die Einheit, z.B. g, kg, ml, EL, TL)",
      "notes": "z.B. geschält, gehackt (optional)"
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "instruction": "Vollständige Beschreibung des Schritts"
    }
  ]
}

KRITISCHE REGELN - Bitte GENAU befolgen:

1. REZEPTNAME:
   - NUR der Titel des Rezepts
   - KEINE Kalorien (kcal), KEINE Nährwerte (Fett, Kohlenhydrate, Eiweiss)
   - Beispiel: "RAMEN-CARBONARA" nicht "RAMEN-CARBONARA 506 kcal Fett: 21g..."

2. ZUTATEN - SEHR WICHTIG:
   - ingredient_name: NUR der Name (z.B. "Ramen-Nudeln", "Bratspeck")
   - amount: Die Menge als Zahl (z.B. 250, 80, 2)
   - unit: NUR die Einheit (z.B. "g", "kg", "ml", "l", "dl", "EL", "TL", "Stück")
   - Bei "250 g Ramen-Nudeln" → ingredient_name="Ramen-Nudeln", amount=250, unit="g"
   - Bei "2 EL Sojasauce" → ingredient_name="Sojasauce", amount=2, unit="EL"
   - Bei "2 frische Eier" → ingredient_name="frische Eier", amount=2, unit=""
   - Bei Mengenbereichen "300-400 g": amount=300, amount_min=300, amount_max=400, unit="g"

3. ZUBEREITUNGSSCHRITTE:
   - Extrahiere ALLE Schritte
   - Jeder Schritt als separates Objekt
   - Nummeriere fortlaufend (1, 2, 3, 4...)
   - Vollständige Anweisungen

4. ZEIT:
   - prep_time: Vorbereitungszeit in Minuten (0 wenn nicht angegeben)
   - cook_time: Kochzeit/Zubereitungszeit in Minuten
   - Bei "30 Min. AKTIV" → prep_time=30
   - Bei "30 Min. GESAMT" ohne AKTIV → prep_time=0, cook_time=30
   - Bei "Zubereiten: 45min" → prep_time=0, cook_time=45

5. SCHWIERIGKEIT:
   - "easy": unter 30 Minuten
   - "medium": 30-60 Minuten
   - "hard": über 60 Minuten

PDF-Text:
${text}

Antworte jetzt NUR mit dem JSON-Objekt:`;

  try {
    if (provider === 'claude') {
      return await parseWithClaude(prompt, apiKey);
    } else if (provider === 'openai') {
      return await parseWithOpenAI(prompt, apiKey);
    }
  } catch (error) {
    console.error('AI Parsing Error:', error);
    throw error;
  }
}

async function parseWithClaude(prompt, apiKey) {
  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const responseText = message.content[0].text;

  // Extrahiere JSON aus der Antwort
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Keine valide JSON-Antwort von Claude erhalten');
  }

  return JSON.parse(jsonMatch[0]);
}

async function parseWithOpenAI(prompt, apiKey) {
  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Du bist ein Rezept-Extraktor. Antworte NUR mit validem JSON, ohne zusätzlichen Text.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(completion.choices[0].message.content);
}

// ============================================
// BILD-EXTRAKTION AUS PDF V2.0
// ============================================
async function extractImageFromPDF(pdfBuffer) {
  try {
    console.log('📸 Starte Bild-Extraktion aus PDF...');

    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    const { createCanvas, Image } = require('canvas');
    const fs = require('fs').promises;
    const path = require('path');

    // Load PDF
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: false
    });

    const pdfDoc = await loadingTask.promise;
    console.log(`  📄 PDF hat ${pdfDoc.numPages} Seiten`);

    // Versuche embedded images zu extrahieren
    const page = await pdfDoc.getPage(1);
    const ops = await page.getOperatorList();

    console.log('  🔍 Suche nach eingebetteten Bildern...');

    let largestImage = null;
    let largestSize = 0;

    // Durchsuche Operatoren nach Bildern
    for (let i = 0; i < ops.fnArray.length; i++) {
      // paintImageXObject = 85, paintInlineImageXObject = 86
      if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject ||
          ops.fnArray[i] === pdfjsLib.OPS.paintInlineImageXObject) {

        const imageName = ops.argsArray[i][0];

        try {
          const image = await page.objs.get(imageName);

          if (image && image.width && image.height) {
            const size = image.width * image.height;
            console.log(`  🖼️ Bild gefunden: ${image.width}x${image.height} (${size} pixels)`);

            // Nur Bilder über 10000 Pixels (z.B. mindestens 100x100)
            if (size > 10000 && size > largestSize) {
              largestSize = size;
              largestImage = image;
            }
          }
        } catch (err) {
          // Bild konnte nicht geladen werden, weiter
          console.log('  ⚠️ Bild konnte nicht geladen werden:', err.message);
        }
      }
    }

    const uploadDir = path.join(__dirname, '../../uploads/pdf-images');
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `recipe-image-${Date.now()}.jpg`;
    const filepath = path.join(uploadDir, filename);

    if (largestImage) {
      // Embedded Image gefunden!
      console.log(`  ✅ Größtes Bild gewählt: ${largestImage.width}x${largestImage.height}`);

      const canvas = createCanvas(largestImage.width, largestImage.height);
      const context = canvas.getContext('2d');

      // Konvertiere PDF Image Data zu Canvas
      const imageData = context.createImageData(largestImage.width, largestImage.height);

      if (largestImage.data) {
        // RGB oder RGBA Daten
        const src = largestImage.data;
        const dest = imageData.data;

        for (let i = 0, j = 0; i < src.length; i += 3, j += 4) {
          dest[j] = src[i];       // R
          dest[j + 1] = src[i + 1]; // G
          dest[j + 2] = src[i + 2]; // B
          dest[j + 3] = 255;       // A
        }
      }

      context.putImageData(imageData, 0, 0);

      const buffer = canvas.toBuffer('image/jpeg', { quality: 0.85 });
      await fs.writeFile(filepath, buffer);

      const relativePath = `/uploads/pdf-images/${filename}`;
      console.log(`  ✅ Bild gespeichert: ${relativePath}`);
      return relativePath;

    } else {
      // FALLBACK: Rendere erste Seite als Bild
      console.log('  ⚠️ Keine eingebetteten Bilder gefunden, rendere Seite...');

      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      const buffer = canvas.toBuffer('image/jpeg', { quality: 0.85 });
      await fs.writeFile(filepath, buffer);

      const relativePath = `/uploads/pdf-images/${filename}`;
      console.log(`  ✅ Seiten-Rendering gespeichert: ${relativePath}`);
      return relativePath;
    }

  } catch (error) {
    console.error('❌ Fehler beim Extrahieren von Bildern:', error.message);
    console.error('   Stack:', error.stack);
    return null;
  }
}

// ============================================
// HELPER: BERECHNE CONFIDENCE SCORE
// ============================================
function calculateConfidence(recipe) {
  let score = 0;
  let maxScore = 100;

  // Titel vorhanden und sinnvoll (max 20 Punkte)
  if (recipe.name && recipe.name.length > 3 && recipe.name.length < 100) {
    score += 20;
  }

  // Zutaten vorhanden und mit Einheiten (max 30 Punkte)
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    score += 10;
    const withUnits = recipe.ingredients.filter(i => i.unit && i.unit.length > 0).length;
    const unitRatio = withUnits / recipe.ingredients.length;
    score += Math.round(unitRatio * 20);
  }

  // Schritte vorhanden und sinnvoll (max 30 Punkte)
  if (recipe.steps && recipe.steps.length > 0) {
    score += 15;
    const avgLength = recipe.steps.reduce((sum, s) => sum + s.instruction.length, 0) / recipe.steps.length;
    if (avgLength > 30) score += 15; // Schritte haben sinnvolle Länge
  }

  // Zeit vorhanden (max 10 Punkte)
  if (recipe.cook_time > 0 || recipe.prep_time > 0) {
    score += 10;
  }

  // Portionen vorhanden (max 10 Punkte)
  if (recipe.servings > 0 && recipe.servings < 50) {
    score += 10;
  }

  return Math.min(score, maxScore);
}

// ============================================
// HELPER: SPEICHERE ALS TRAINING-DATEN
// ============================================
async function saveAsTrainingData(text, recipe, source, confidence, userId, filename = null, fileSize = null, fileType = 'pdf') {
  try {
    const trainingDB = getTrainingDB();

    // Insert Training Data
    const insertStmt = trainingDB.prepare(`
      INSERT INTO pdf_training_data (
        pdf_text, parsed_result, source, confidence_score, user_id, pdf_filename, pdf_size_bytes, file_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      text,
      JSON.stringify(recipe),
      source,
      confidence,
      userId,
      filename,
      fileSize,
      fileType
    );

    // Update Learning Stats
    const isAI = source.startsWith('ai-');
    if (isAI) {
      const updateStmt = trainingDB.prepare(`
        UPDATE learning_stats
        SET
          total_pdfs_trained = total_pdfs_trained + 1,
          ai_assisted_count = ai_assisted_count + 1,
          average_confidence = (SELECT AVG(confidence_score) FROM pdf_training_data),
          updated_at = CURRENT_TIMESTAMP
      `);
      updateStmt.run();
    } else {
      const updateStmt = trainingDB.prepare(`
        UPDATE learning_stats
        SET
          autonomous_count = autonomous_count + 1,
          updated_at = CURRENT_TIMESTAMP
      `);
      updateStmt.run();
    }

    console.log(`📚 Training-Daten gespeichert (${source}, Confidence: ${confidence}%)`);
  } catch (error) {
    console.error('❌ Fehler beim Speichern von Training-Daten:', error.message);
  }
}

// ============================================
// ROUTE: PDF HOCHLADEN UND PARSEN
// ============================================
router.post('/parse', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine PDF-Datei hochgeladen' });
    }

    console.log('📄 PDF hochgeladen:', req.file.originalname, `(${(req.file.size / 1024).toFixed(2)} KB)`);

    // DUPLIKAT-CHECK: Prüfe ob PDF bereits verarbeitet wurde
    const trainingDB = getTrainingDB();
    const existingPDF = trainingDB.prepare(
      'SELECT pdf_filename, created_at FROM pdf_training_data WHERE pdf_filename = ? LIMIT 1'
    ).get(req.file.originalname);

    if (existingPDF) {
      console.log(`⚠️ PDF "${req.file.originalname}" wurde bereits verarbeitet`);
      return res.status(409).json({
        error: 'PDF bereits verarbeitet',
        details: `Die Datei "${req.file.originalname}" wurde bereits hochgeladen und verarbeitet. Bitte verwende eine andere Datei oder benenne sie um.`,
        existingSince: existingPDF.created_at
      });
    }

    // 1. PDF Text extrahieren
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;

    console.log('✅ PDF Text extrahiert:', text.substring(0, 200) + '...');

    // 2. Extrahiere Bild aus PDF (falls vorhanden)
    let imagePath = null;
    try {
      imagePath = await extractImageFromPDF(req.file.buffer);
    } catch (imgError) {
      console.log('⚠️ Bild-Extraktion übersprungen:', imgError.message);
    }

    // 3. Hole Learning Stats um Phase zu bestimmen (aus SQLite)
    const learningStats = trainingDB.prepare('SELECT * FROM learning_stats LIMIT 1').get();
    const learningPhase = learningStats?.learning_phase || 'training';
    const totalTrained = learningStats?.total_pdfs_trained || 0;

    console.log(`🧠 Learning Phase: ${learningPhase} (${totalTrained} PDFs trainiert)`);

    // 4. Prüfe ob AI aktiviert ist
    const aiSettingsResult = await pool.query('SELECT * FROM ai_settings WHERE enabled = true LIMIT 1');
    const aiAvailable = aiSettingsResult.rows.length > 0 && aiSettingsResult.rows[0].api_key;

    let recipe;
    let method = 'regex';
    let confidence = 0;

    // 5. SMART HYBRID PARSER V2.0
    console.log('🚀 === SMART HYBRID PARSER V2.0 ===');

    // Prüfe ob Force Autonomous Mode aus Settings
    const forceAutonomousSetting = await pool.query('SELECT force_autonomous FROM ai_settings LIMIT 1');
    const forceAutonomous = forceAutonomousSetting.rows.length > 0 && forceAutonomousSetting.rows[0].force_autonomous === true;

    if (forceAutonomous) {
      console.log('🧪 FORCE AUTONOMOUS MODE aktiviert - AI wird NICHT verwendet!');
    }

    // Parse mit Smart Hybrid
    const parseResult = parseRecipeWithSmartHybrid(text, forceAutonomous);

    if (parseResult.success) {
      // ✅ Simple Parser war erfolgreich!
      recipe = parseResult.recipe;
      confidence = parseResult.confidence;
      method = parseResult.method;

      console.log(`✅ Smart Hybrid erfolgreich OHNE AI (${confidence}%)`);

    } else if (parseResult.needsAI && aiAvailable && !forceAutonomous) {
      // 🤖 Simple Parser braucht AI Hilfe
      console.log(`🤖 Confidence zu niedrig (${parseResult.confidence}%) → AI Fallback`);

      try {
        const settings = aiSettingsResult.rows[0];
        const apiKey = crypto.decrypt(settings.api_key);

        recipe = await parseRecipeWithAI(text, settings.provider, apiKey);
        method = `ai-${settings.provider}`;
        confidence = 95;

        console.log(`✅ AI Fallback erfolgreich!`);

        // Speichere AI-Ergebnis für Training mit SimpleLearningSystem
        SimpleLearningSystem.saveAIParse(
          text,
          recipe,
          method,
          confidence,
          req.file.originalname,
          req.file.size,
          'pdf'
        );

        console.log(`💾 AI-Ergebnis gespeichert für Training`);

      } catch (aiError) {
        console.error('⚠️ AI-Parsing fehlgeschlagen:', aiError.message);

        // Bei Kredit-Fehler: AI deaktivieren
        if (aiError.message && (
          aiError.message.includes('credit balance') ||
          aiError.message.includes('insufficient') ||
          aiError.message.includes('authentication') ||
          aiError.message.includes('api_key')
        )) {
          console.log('💳 AI-Zugriff fehlgeschlagen, deaktiviere AI');
          await pool.query('UPDATE ai_settings SET enabled = false WHERE id = $1', [settings.id]);
        }

        // Nutze Simple Parser Ergebnis trotz niedriger Confidence
        recipe = parseResult.recipe;
        confidence = parseResult.confidence;
        method = 'regex-lowconf';

        console.log(`⚠️ Nutze Simple Parser Ergebnis trotz niedriger Confidence (${confidence}%)`);
      }

    } else {
      // ⚠️ Kein AI verfügbar oder Force Autonomous
      recipe = parseResult.recipe;
      confidence = parseResult.confidence;
      method = forceAutonomous ? 'regex-forced' : 'regex-noai';

      if (forceAutonomous) {
        console.log(`🧪 FORCE AUTONOMOUS MODE - Nutze Ergebnis ohne AI (${confidence}%)`);
      } else {
        console.log(`⚠️ Kein AI verfügbar - Nutze Simple Parser Ergebnis (${confidence}%)`);
      }
    }

    // 7. Füge extrahiertes Bild hinzu (falls vorhanden)
    if (imagePath) {
      recipe.image_path = imagePath;
      console.log('🖼️ Bild extrahiert und hinzugefügt:', imagePath);
    }

    console.log('✅ Parsing abgeschlossen:', {
      name: recipe.name,
      ingredients: recipe.ingredients.length,
      steps: recipe.steps.length,
      method: method,
      confidence: `${confidence}%`
    });

    res.json({
      success: true,
      method,
      recipe,
      stats: {
        ingredients: recipe.ingredients.length,
        steps: recipe.steps.length,
        pdfPages: pdfData.numpages,
        hasImage: !!imagePath,
        confidence: confidence,
        learningPhase: learningPhase
      }
    });

  } catch (error) {
    console.error('PDF Parse Error:', error);
    res.status(500).json({
      error: 'Fehler beim Verarbeiten der PDF',
      details: error.message
    });
  }
});

// ============================================
// ROUTE: GET LEARNING STATS
// ============================================
router.get('/learning-stats', authMiddleware, async (req, res) => {
  try {
    const trainingDB = getTrainingDB();
    const learningData = trainingDB.prepare('SELECT * FROM learning_stats LIMIT 1').get();

    // Hole Readiness-Daten vom Simple Learning System
    const readiness = SimpleLearningSystem.calculateAutonomyReadiness(
      learningData ? learningData.total_pdfs_trained : 0
    );

    if (!learningData) {
      return res.json({
        total_pdfs_trained: 0,
        ai_assisted_count: 0,
        autonomous_count: 0,
        average_confidence: 0,
        learning_phase: 'training',
        progress: 0,
        next_phase_at: 50,
        readiness: readiness
      });
    }

    // Berechne Progress (alte Logik für Kompatibilität)
    let progress = 0;
    if (learningData.learning_phase === 'training') {
      progress = Math.min((learningData.total_pdfs_trained / 50) * 100, 100);
    } else if (learningData.learning_phase === 'hybrid') {
      progress = Math.min(((learningData.total_pdfs_trained - 50) / 50) * 100, 100);
    } else {
      progress = 100;
    }

    // Statistik nach Dateityp
    const pdfCount = trainingDB.prepare("SELECT COUNT(*) as count FROM pdf_training_data WHERE file_type = 'pdf'").get();
    const epubCount = trainingDB.prepare("SELECT COUNT(*) as count FROM pdf_training_data WHERE file_type = 'epub'").get();

    res.json({
      ...learningData,
      progress: Math.round(progress),
      pdf_count: pdfCount.count,
      epub_count: epubCount.count,
      next_phase_at: learningData.learning_phase === 'training' ? 50 :
                     learningData.learning_phase === 'hybrid' ? 100 : null,
      readiness: readiness
    });

  } catch (error) {
    console.error('Error fetching learning stats:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Lernstatistiken' });
  }
});

// ============================================
// ROUTE: BULK TRAINING (Mehrere PDFs hochladen)
// ============================================
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB pro Datei
    files: 50 // Max 50 Dateien gleichzeitig
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Nur PDF-Dateien sind erlaubt!'));
    }
  }
});

router.post('/bulk-train', authMiddleware, bulkUpload.array('pdfs', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Keine PDF-Dateien hochgeladen' });
    }

    console.log(`📚 Bulk-Training gestartet: ${req.files.length} PDFs`);

    // Prüfe ob AI aktiviert ist
    const aiSettingsResult = await pool.query('SELECT * FROM ai_settings WHERE enabled = true LIMIT 1');
    const aiAvailable = aiSettingsResult.rows.length > 0 && aiSettingsResult.rows[0].api_key;

    if (!aiAvailable) {
      return res.status(400).json({
        error: 'Bulk-Training benötigt aktivierte AI (Claude oder OpenAI)',
        details: 'Bitte konfiguriere AI-Einstellungen zuerst'
      });
    }

    const settings = aiSettingsResult.rows[0];
    const apiKey = await crypto.decrypt(settings.api_key);

    // Erstelle Training Session
    const trainingDB = getTrainingDB();
    const sessionStmt = trainingDB.prepare(`
      INSERT INTO training_sessions (user_id, total_files, status)
      VALUES (?, ?, 'running')
    `);
    const sessionResult = sessionStmt.run(req.user.id, req.files.length);
    const sessionId = sessionResult.lastInsertRowid;

    // Sende initiale Response mit Session-ID
    res.json({
      success: true,
      sessionId: sessionId,
      totalFiles: req.files.length,
      message: 'Training gestartet'
    });

    // Verarbeite PDFs asynchron
    (async () => {
      let processed = 0;
      let failed = 0;
      const failedFiles = []; // Array für fehlgeschlagene Dateien mit Details

      // Hole alternative AI-Settings für Fallback
      const allAISettings = await pool.query('SELECT * FROM ai_settings');
      const alternativeProvider = allAISettings.rows.find(s =>
        s.provider !== settings.provider && s.enabled && s.api_key
      );

      for (const file of req.files) {
        try {
          console.log(`📄 Verarbeite: ${file.originalname}`);

          // DUPLIKAT-CHECK: Prüfe ob Datei bereits trainiert wurde
          const existingFile = getTrainingDB().prepare(
            'SELECT pdf_filename FROM pdf_training_data WHERE pdf_filename = ?'
          ).get(file.originalname);

          if (existingFile) {
            console.log(`⚠️ ${file.originalname} wurde bereits trainiert - überspringe`);
            failed++;
            failedFiles.push({
              filename: file.originalname,
              reason: 'duplicate',
              message: 'Diese Datei wurde bereits für das Training verwendet'
            });

            // Update Session Progress
            getTrainingDB().prepare(`
              UPDATE training_sessions
              SET processed_files = ?, failed_files = ?, error_details = ?
              WHERE id = ?
            `).run(processed, failed, JSON.stringify(failedFiles), sessionId);

            continue; // Überspringe diese Datei
          }

          // PDF Text extrahieren
          const pdfData = await pdfParse(file.buffer);
          const text = pdfData.text;

          let recipe;
          let source;
          let usedProvider = settings.provider;
          let usedApiKey = apiKey;

          // Versuche mit primärem Provider
          try {
            recipe = await parseRecipeWithAI(text, usedProvider, usedApiKey);
            source = `ai-${usedProvider}`;
          } catch (aiError) {
            // Fallback auf alternativen Provider wenn verfügbar
            if (alternativeProvider && (
              aiError.message.includes('credit balance') ||
              aiError.message.includes('not_found_error') ||
              aiError.message.includes('authentication')
            )) {
              console.log(`⚠️ ${usedProvider} fehlgeschlagen, versuche ${alternativeProvider.provider}...`);
              usedProvider = alternativeProvider.provider;
              usedApiKey = await crypto.decrypt(alternativeProvider.api_key);
              recipe = await parseRecipeWithAI(text, usedProvider, usedApiKey);
              source = `ai-${usedProvider}`;
            } else {
              throw aiError;
            }
          }

          const confidence = calculateConfidence(recipe);

          // Als Training-Daten speichern
          await saveAsTrainingData(
            text,
            recipe,
            source,
            confidence,
            req.user.id,
            file.originalname,
            file.size,
            'pdf' // Route /bulk-train ist nur für PDF
          );

          processed++;
          console.log(`✅ ${file.originalname} verarbeitet (${processed}/${req.files.length})`);

        } catch (error) {
          failed++;
          failedFiles.push({
            filename: file.originalname,
            reason: 'error',
            message: error.message || 'Unbekannter Fehler beim Verarbeiten'
          });
          console.error(`❌ Fehler bei ${file.originalname}:`, error.message);
        }

        // Update Session Progress
        trainingDB.prepare(`
          UPDATE training_sessions
          SET processed_files = ?, failed_files = ?, error_details = ?
          WHERE id = ?
        `).run(processed, failed, JSON.stringify(failedFiles), sessionId);
      }

      // Markiere Session als abgeschlossen
      trainingDB.prepare(`
        UPDATE training_sessions
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP, error_details = ?
        WHERE id = ?
      `).run(JSON.stringify(failedFiles), sessionId);

      console.log(`🎉 Bulk-Training abgeschlossen: ${processed} erfolgreich, ${failed} fehlgeschlagen`);
    })();

  } catch (error) {
    console.error('Bulk Training Error:', error);
    res.status(500).json({
      error: 'Fehler beim Bulk-Training',
      details: error.message
    });
  }
});

// ============================================
// ROUTE: GET TRAINING SESSION STATUS
// ============================================
router.get('/training-session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const trainingDB = getTrainingDB();
    const session = trainingDB.prepare('SELECT * FROM training_sessions WHERE id = ?')
      .get(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session nicht gefunden' });
    }

    // Parse error_details wenn vorhanden
    if (session.error_details) {
      try {
        session.error_details = JSON.parse(session.error_details);
      } catch (e) {
        session.error_details = [];
      }
    } else {
      session.error_details = [];
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching training session:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Session' });
  }
});

// ============================================
// HELPER: PARSE EPUB FILE
// ============================================
async function parseEPUB(buffer, filename) {
  return new Promise(async (resolve, reject) => {
    try {
      // Speichere temporär (epub2 braucht einen Dateipfad)
      const tempPath = path.join('/tmp', `${Date.now()}-${filename}`);
      await fs.writeFile(tempPath, buffer);

      const epub = await EPub.createAsync(tempPath);

      let fullText = '';
      const chapters = [];

      // Durchlaufe alle Kapitel
      for (const chapter of epub.flow) {
        try {
          const chapterData = await epub.getChapterAsync(chapter.id);

          // Entferne HTML-Tags und behandle HTML-Entities korrekt
          const textContent = chapterData
            .replace(/<style[^>]*>.*?<\/style>/gis, '')
            .replace(/<script[^>]*>.*?<\/script>/gis, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&auml;/g, 'ä')
            .replace(/&Auml;/g, 'Ä')
            .replace(/&ouml;/g, 'ö')
            .replace(/&Ouml;/g, 'Ö')
            .replace(/&uuml;/g, 'ü')
            .replace(/&Uuml;/g, 'Ü')
            .replace(/&szlig;/g, 'ß')
            .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(/\s+/g, ' ')
            .trim();

          if (textContent) {
            chapters.push(textContent);
            // 5 Zeilenumbrüche damit splitIntoRecipes() die Kapitelgrenzen erkennt
            fullText += textContent + '\n\n\n\n\n';
          }
        } catch (chapterError) {
          console.error(`Fehler beim Lesen von Kapitel ${chapter.id}:`, chapterError.message);
        }
      }

      // Lösche temporäre Datei
      try {
        await fs.unlink(tempPath);
      } catch (unlinkError) {
        console.error('Fehler beim Löschen der Temp-Datei:', unlinkError.message);
      }

      resolve({
        text: fullText,
        numchapters: chapters.length,
        chapters: chapters, // Array mit einzelnen Kapiteln
        metadata: {
          title: epub.metadata.title || 'Unbekannt',
          author: epub.metadata.creator || 'Unbekannt',
          publisher: epub.metadata.publisher || 'Unbekannt',
        }
      });

    } catch (error) {
      reject(error);
    }
  });
}

// ============================================
// ROUTE: KOCHBUCH PARSEN (PDF oder EPUB)
// ============================================
router.post('/parse-cookbook', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }

    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const isEPUB = fileExtension === '.epub';

    console.log(`📚 Kochbuch hochgeladen: ${req.file.originalname} (${isEPUB ? 'EPUB' : 'PDF'})`);

    // DUPLIKAT-CHECK: Prüfe ob Kochbuch bereits trainiert wurde
    const existingCookbook = getTrainingDB().prepare(
      'SELECT pdf_filename FROM pdf_training_data WHERE pdf_filename = ? LIMIT 1'
    ).get(req.file.originalname);

    if (existingCookbook) {
      console.log(`⚠️ Kochbuch "${req.file.originalname}" wurde bereits für Training verwendet`);
      return res.status(400).json({
        error: 'Duplikat gefunden',
        details: `Die Datei "${req.file.originalname}" wurde bereits für das Training verwendet und kann nicht erneut verarbeitet werden.`
      });
    }

    let fullText, totalPages, recipes;

    // Extrahiere Text je nach Dateityp
    if (isEPUB) {
      const epubData = await parseEPUB(req.file.buffer, req.file.originalname);
      fullText = epubData.text;
      totalPages = epubData.numchapters;

      // Bei EPUB: Filtere Kapitel nach Rezept-Kriterien
      recipes = epubData.chapters.filter(chapter => {
        // Mindestlänge: 300 Zeichen (kurze Kapitel sind oft keine Rezepte)
        if (chapter.length < 300) return false;

        // Prüfe auf typische Rezept-Indikatoren
        const lowerText = chapter.toLowerCase();
        const hasIngredients = lowerText.includes('zutat') ||
                              lowerText.includes('ingredien') ||
                              lowerText.match(/\d+\s*(g|ml|kg|l|tl|el|prise|messerspitze)/i);

        const hasSteps = lowerText.includes('zubereitung') ||
                        lowerText.includes('anleitung') ||
                        lowerText.match(/\d+\.\s+[A-ZÄÖÜ]/); // Nummerierte Schritte

        const hasServings = lowerText.match(/\d+\s*(portion|person|stück|stücke)/i);

        // Rezept muss mindestens 2 der 3 Kriterien erfüllen
        const score = (hasIngredients ? 1 : 0) + (hasSteps ? 1 : 0) + (hasServings ? 1 : 0);
        return score >= 2;
      });

      console.log(`📄 ${totalPages} Kapitel extrahiert`);
      console.log(`📖 Metadata: ${epubData.metadata.title} von ${epubData.metadata.author}`);
      console.log(`🔍 ${recipes.length} Rezepte erkannt (1 Kapitel = 1 Rezept)`);
    } else {
      // PDF: Verwende splitIntoRecipes() für Rezept-Erkennung
      const pdfData = await pdfParse(req.file.buffer);
      fullText = pdfData.text;
      totalPages = pdfData.numpages;

      recipes = splitIntoRecipes(fullText);

      console.log(`📄 ${totalPages} Seiten extrahiert`);
      console.log(`🔍 ${recipes.length} Rezepte erkannt`);
    }

    // Prüfe ob AI aktiviert ist
    const aiSettingsResult = await pool.query('SELECT * FROM ai_settings WHERE enabled = true LIMIT 1');
    const aiAvailable = aiSettingsResult.rows.length > 0 && aiSettingsResult.rows[0].api_key;

    if (!aiAvailable) {
      return res.status(400).json({
        error: 'Kochbuch-Parsing benötigt aktivierte AI',
        details: 'Bitte konfiguriere AI-Einstellungen zuerst'
      });
    }

    const settings = aiSettingsResult.rows[0];
    const apiKey = await crypto.decrypt(settings.api_key);

    // Erstelle Training Session
    const trainingDB = getTrainingDB();
    const sessionStmt = trainingDB.prepare(`
      INSERT INTO training_sessions (user_id, total_files, status)
      VALUES (?, ?, 'running')
    `);
    const sessionResult = sessionStmt.run(req.user.id, recipes.length);
    const sessionId = sessionResult.lastInsertRowid;

    // Sende Response
    res.json({
      success: true,
      sessionId: sessionId,
      recipesFound: recipes.length,
      totalPages: totalPages,
      message: 'Kochbuch-Parsing gestartet'
    });

    // Verarbeite Rezepte asynchron
    (async () => {
      let processed = 0;
      let failed = 0;

      // Hole alternative AI-Settings für Fallback
      const allAISettings = await pool.query('SELECT * FROM ai_settings');
      const alternativeProvider = allAISettings.rows.find(s =>
        s.provider !== settings.provider && s.enabled && s.api_key
      );

      for (let i = 0; i < recipes.length; i++) {
        try {
          const recipeText = recipes[i];
          console.log(`📄 Verarbeite Rezept ${i + 1}/${recipes.length}`);

          let recipe;
          let source;
          let usedProvider = settings.provider;
          let usedApiKey = apiKey;

          // Versuche mit primärem Provider
          try {
            recipe = await parseRecipeWithAI(recipeText, usedProvider, usedApiKey);
            source = `ai-${usedProvider}`;
          } catch (aiError) {
            if (alternativeProvider && (
              aiError.message.includes('credit balance') ||
              aiError.message.includes('not_found_error') ||
              aiError.message.includes('authentication')
            )) {
              console.log(`⚠️ ${usedProvider} fehlgeschlagen, versuche ${alternativeProvider.provider}...`);
              usedProvider = alternativeProvider.provider;
              usedApiKey = await crypto.decrypt(alternativeProvider.api_key);
              recipe = await parseRecipeWithAI(recipeText, usedProvider, usedApiKey);
              source = `ai-${usedProvider}`;
            } else {
              throw aiError;
            }
          }

          const confidence = calculateConfidence(recipe);

          // Als Training-Daten speichern
          await saveAsTrainingData(
            recipeText,
            recipe,
            source,
            confidence,
            req.user.id,
            `${req.file.originalname} - Rezept ${i + 1}`,
            Math.round(req.file.size / recipes.length),
            isEPUB ? 'epub' : 'pdf'
          );

          processed++;
          console.log(`✅ Rezept ${i + 1} verarbeitet (${processed}/${recipes.length})`);

        } catch (error) {
          failed++;
          console.error(`❌ Fehler bei Rezept ${i + 1}:`, error.message);
        }

        // Update Session Progress
        trainingDB.prepare(`
          UPDATE training_sessions
          SET processed_files = ?, failed_files = ?
          WHERE id = ?
        `).run(processed, failed, sessionId);
      }

      // Markiere Session als abgeschlossen
      trainingDB.prepare(`
        UPDATE training_sessions
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(sessionId);

      console.log(`🎉 Kochbuch-Parsing abgeschlossen: ${processed} erfolgreich, ${failed} fehlgeschlagen`);
    })();

  } catch (error) {
    console.error('Cookbook Parse Error:', error);
    res.status(500).json({
      error: 'Fehler beim Verarbeiten des Kochbuchs',
      details: error.message
    });
  }
});

// ============================================
// HELPER: TEILE TEXT IN EINZELNE REZEPTE
// ============================================
function splitIntoRecipes(text) {
  const recipes = [];

  // Muster für Rezept-Starts erkennen
  // Typische Muster:
  // - Seitentrenner (mehrere Leerzeilen)
  // - Überschriften (GROSSBUCHSTABEN oder fettgedruckt)
  // - Numerierung (1., 2., etc.)
  // - Keywords: "ZUTATEN", "ZUBEREITUNG", etc.

  // Split nach starken Trennern
  const potentialRecipes = text.split(/\n{3,}|\f/); // 3+ Leerzeilen oder Form Feed

  let currentRecipe = '';

  for (const segment of potentialRecipes) {
    const trimmed = segment.trim();

    if (!trimmed) continue;

    // Prüfe ob neues Rezept startet
    const lines = trimmed.split('\n');
    const firstLine = lines[0].trim();

    // Verbesserte Heuristiken mit Scoring-System
    const lowerText = trimmed.toLowerCase();

    // Prüfe auf Rezept-Indikatoren
    const hasIngredients = lowerText.includes('zutat') ||
                          lowerText.includes('ingredien') ||
                          lowerText.match(/\d+\s*(g|ml|kg|l|tl|el|prise|messerspitze)/i);

    const hasSteps = lowerText.includes('zubereitung') ||
                    lowerText.includes('anleitung') ||
                    lowerText.match(/\d+\.\s+[A-ZÄÖÜ]/); // Nummerierte Schritte

    const hasServings = lowerText.match(/\d+\s*(portion|person|stück|stücke)/i);

    const hasTitleFormat = (
      firstLine.length > 10 && firstLine.length < 100 && // Titel-Länge
      (
        /^[A-ZÄÖÜ]/.test(firstLine) || // Beginnt mit Großbuchstabe
        /^\d+\./.test(firstLine) || // Beginnt mit Nummer
        firstLine === firstLine.toUpperCase() // Komplett GROSSBUCHSTABEN
      )
    );

    // Scoring: Mindestens 2 Rezept-Kriterien + Titel-Format
    const score = (hasIngredients ? 1 : 0) + (hasSteps ? 1 : 0) + (hasServings ? 1 : 0);
    const isNewRecipe = hasTitleFormat && score >= 2;

    if (isNewRecipe && currentRecipe.length > 200) {
      // Speichere vorheriges Rezept
      recipes.push(currentRecipe);
      currentRecipe = trimmed;
    } else {
      currentRecipe += '\n\n' + trimmed;
    }
  }

  // Letztes Rezept hinzufügen
  if (currentRecipe.length > 200) {
    recipes.push(currentRecipe);
  }

  return recipes.filter(r => r.length > 200); // Mindestlänge
}

// ============================================
// ROUTE: GET TRAINING DATA (Liste aller verarbeiteten Rezepte)
// ============================================
router.get('/training-data', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0, sortBy = 'created_at', order = 'DESC' } = req.query;

    const trainingDB = getTrainingDB();

    // Hole Trainingsdaten
    const trainingData = trainingDB.prepare(`
      SELECT
        id,
        pdf_filename,
        source,
        confidence_score,
        created_at,
        pdf_size_bytes,
        file_type
      FROM pdf_training_data
      ORDER BY ${sortBy} ${order}
      LIMIT ? OFFSET ?
    `).all(parseInt(limit), parseInt(offset));

    // Hole Gesamtanzahl
    const totalCount = trainingDB.prepare('SELECT COUNT(*) as count FROM pdf_training_data').get();

    // Parse JSON results für Namen
    const enrichedData = trainingData.map(item => {
      return {
        id: item.id,
        filename: item.pdf_filename || 'Unbekannt',
        source: item.source,
        confidence: item.confidence_score,
        createdAt: item.created_at,
        fileSize: item.pdf_size_bytes,
        fileType: item.file_type || 'pdf',
      };
    });

    res.json({
      data: enrichedData,
      total: totalCount.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

  } catch (error) {
    console.error('Error fetching training data:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Trainingsdaten' });
  }
});

// ============================================
// ROUTE: GET TRAINING DATA DETAILS (Einzelnes Rezept)
// ============================================
router.get('/training-data/:id', authMiddleware, async (req, res) => {
  try {
    const trainingDB = getTrainingDB();

    const data = trainingDB.prepare(`
      SELECT
        id,
        pdf_text,
        parsed_result,
        source,
        confidence_score,
        created_at,
        pdf_filename,
        pdf_size_bytes
      FROM pdf_training_data
      WHERE id = ?
    `).get(req.params.id);

    if (!data) {
      return res.status(404).json({ error: 'Trainingsdaten nicht gefunden' });
    }

    // Parse JSON result
    const parsedResult = JSON.parse(data.parsed_result);

    res.json({
      id: data.id,
      filename: data.pdf_filename,
      source: data.source,
      confidence: data.confidence_score,
      createdAt: data.created_at,
      fileSize: data.pdf_size_bytes,
      pdfText: data.pdf_text,
      recipe: parsedResult,
    });

  } catch (error) {
    console.error('Error fetching training data details:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Details' });
  }
});

// ============================================
// ROUTE: WEB-SCRAPER (von Websites laden)
// ============================================
router.post('/scrape-recipes', authMiddleware, async (req, res) => {
  try {
    const { website, category, maxRecipes } = req.body;

    if (!website) {
      return res.status(400).json({ error: 'Website nicht angegeben' });
    }

    console.log(`🌐 Scraping gestartet: ${website}`);

    // Prüfe ob AI aktiviert ist
    const aiSettingsResult = await pool.query('SELECT * FROM ai_settings WHERE enabled = true LIMIT 1');
    const aiAvailable = aiSettingsResult.rows.length > 0 && aiSettingsResult.rows[0].api_key;

    if (!aiAvailable) {
      return res.status(400).json({
        error: 'Web-Scraping benötigt aktivierte AI',
        details: 'Bitte konfiguriere AI-Einstellungen zuerst'
      });
    }

    res.json({
      success: true,
      message: 'Scraping gestartet',
      info: 'Diese Funktion ist in Entwicklung. Aktuell bitte PDFs manuell hochladen.'
    });

    // TODO: Implementierung für verschiedene Websites
    // - Swissmilk
    // - Fooby
    // - Betty Bossi
    // - Weitere...

  } catch (error) {
    console.error('Scraping Error:', error);
    res.status(500).json({
      error: 'Fehler beim Scraping',
      details: error.message
    });
  }
});

// ============================================
// ROUTE: TRAIN PATTERNS (Lerne aus Trainingsdaten)
// ============================================
router.post('/train-patterns', authMiddleware, async (req, res) => {
  try {
    console.log('🧠 Starte INTELLIGENTES Pattern-Learning aus Trainingsdaten...');

    const learner = new IntelligentPatternLearner();
    const patterns = await learner.learnFromAllTrainingData();

    // Automatisch Learning Phase aktualisieren nach Pattern-Training
    const trainingDB = getTrainingDB();
    const stats = trainingDB.prepare('SELECT * FROM learning_stats LIMIT 1').get();
    const currentPhase = stats.learning_phase;
    const totalTrained = stats.total_pdfs_trained;

    let newPhase = currentPhase;
    let phaseChanged = false;

    // Bestimme korrekte Phase basierend auf Anzahl
    if (totalTrained >= 100 && currentPhase !== 'autonomous') {
      newPhase = 'autonomous';
      phaseChanged = true;
      console.log('🎓 Phase-Upgrade nach Pattern-Learning: → AUTONOMOUS');
      trainingDB.prepare(`UPDATE learning_stats SET learning_phase = ?, updated_at = CURRENT_TIMESTAMP`).run(newPhase);
    } else if (totalTrained >= 50 && currentPhase === 'training') {
      newPhase = 'hybrid';
      phaseChanged = true;
      console.log('🎓 Phase-Upgrade nach Pattern-Learning: → HYBRID');
      trainingDB.prepare(`UPDATE learning_stats SET learning_phase = ?, updated_at = CURRENT_TIMESTAMP`).run(newPhase);
    }

    // Update last_pattern_update timestamp
    trainingDB.prepare(`UPDATE learning_stats SET last_pattern_update = CURRENT_TIMESTAMP`).run();

    res.json({
      success: true,
      patternsLearned: patterns.learnedFrom,
      patterns: patterns,
      phaseChanged: phaseChanged,
      currentPhase: newPhase,
      totalTrained: totalTrained,
      message: phaseChanged
        ? `${patterns.learnedFrom} Patterns gelernt! Phase aktualisiert: ${currentPhase} → ${newPhase}`
        : `${patterns.learnedFrom} Patterns erfolgreich gelernt!`
    });

  } catch (error) {
    console.error('Pattern Learning Error:', error);
    res.status(500).json({
      error: 'Fehler beim Pattern-Learning',
      details: error.message
    });
  }
});

// ============================================
// ROUTE: GET LEARNED PATTERNS (Status anzeigen)
// ============================================
router.get('/learned-patterns', authMiddleware, async (req, res) => {
  try {
    const patterns = PatternLearner.getLearnedPatterns();

    res.json({
      patterns: patterns,
      count: Object.keys(patterns).length,
      message: Object.keys(patterns).length > 0
        ? 'Patterns verfügbar'
        : 'Noch keine Patterns gelernt. Nutze POST /train-patterns'
    });

  } catch (error) {
    console.error('Get Patterns Error:', error);
    res.status(500).json({
      error: 'Fehler beim Laden der Patterns',
      details: error.message
    });
  }
});

// ============================================
// ROUTE: UPDATE LEARNING PHASE (Manuell Phase aktualisieren)
// ============================================
router.post('/update-learning-phase', authMiddleware, async (req, res) => {
  try {
    console.log('🔄 Aktualisiere Learning Phase basierend auf Trainingsdaten...');

    const trainingDB = getTrainingDB();

    // Hole aktuelle Stats
    const stats = trainingDB.prepare('SELECT * FROM learning_stats LIMIT 1').get();
    const currentPhase = stats.learning_phase;
    const totalTrained = stats.total_pdfs_trained;

    console.log(`📊 Aktuell: ${totalTrained} Rezepte trainiert, Phase: ${currentPhase}`);

    let newPhase = currentPhase;
    let phaseChanged = false;

    // Bestimme korrekte Phase basierend auf Anzahl
    if (totalTrained >= 100 && currentPhase !== 'autonomous') {
      newPhase = 'autonomous';
      phaseChanged = true;
      console.log('🎓 Phase-Upgrade: → AUTONOMOUS');
    } else if (totalTrained >= 50 && currentPhase === 'training') {
      newPhase = 'hybrid';
      phaseChanged = true;
      console.log('🎓 Phase-Upgrade: → HYBRID');
    }

    // Update Phase wenn nötig
    if (phaseChanged) {
      trainingDB.prepare(`
        UPDATE learning_stats
        SET learning_phase = ?, updated_at = CURRENT_TIMESTAMP
      `).run(newPhase);

      res.json({
        success: true,
        oldPhase: currentPhase,
        newPhase: newPhase,
        totalTrained: totalTrained,
        message: `Phase erfolgreich aktualisiert: ${currentPhase} → ${newPhase}`
      });
    } else {
      res.json({
        success: true,
        phase: currentPhase,
        totalTrained: totalTrained,
        message: `Phase ist bereits korrekt (${currentPhase} bei ${totalTrained} Rezepten)`
      });
    }

  } catch (error) {
    console.error('Update Learning Phase Error:', error);
    res.status(500).json({
      error: 'Fehler beim Aktualisieren der Learning Phase',
      details: error.message
    });
  }
});

module.exports = router;
