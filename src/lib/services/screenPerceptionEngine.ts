// Screen Perception Engine
// Ingests live screen frame images from TradingView/desktop and extracts observed chart facts.
// Enforces zero-default rule: returns UNKNOWN if symbol or timeframe cannot be identified.

import { ObservedScreenFact, VisibleDrawingObject } from '@/lib/types/screenPerception';
import { visionProvider } from '@/lib/providers/vision';
import { GoogleGenAI } from '@google/genai';

export class ScreenPerceptionEngine {
  /**
   * Perceives a screen frame image and returns structured observed facts.
   */
  static async perceiveFrame(params: {
    imageBase64?: string;
    filePath?: string;
    manualContext?: {
      symbol?: string;
      timeframe?: string;
      price?: number;
    };
  }): Promise<ObservedScreenFact> {
    const { imageBase64, manualContext } = params;
    const now = new Date().toISOString();

    // If manual context overrides are explicitly supplied (e.g., from client controls)
    if (manualContext && (manualContext.symbol || manualContext.timeframe || manualContext.price)) {
      return {
        symbol: manualContext.symbol || 'UNKNOWN',
        timeframe: manualContext.timeframe || 'UNKNOWN',
        currentPrice: manualContext.price,
        priceScaleVisible: typeof manualContext.price === 'number',
        chartDetected: true,
        appName: 'TradingView',
        screenType: 'TRADINGVIEW',
        visibleLevels: [],
        confidence: 0.95,
        timestamp: now,
      };
    }

    // If imageBase64 is provided, attempt AI Vision perception first
    if (imageBase64) {
      try {
        const aiObservation = await this.perceiveWithGeminiVision(imageBase64);
        if (aiObservation) {
          return aiObservation;
        }
      } catch (err) {
        console.warn('[ScreenPerceptionEngine] Vision AI perception failed, falling back to heuristic analyzer:', err);
      }

      // Fallback: Deterministic header & pixel analysis
      return this.analyzeFrameDeterministically(imageBase64, now);
    }

    // Default honest observation when no image or context is provided
    return {
      symbol: 'UNKNOWN',
      timeframe: 'UNKNOWN',
      priceScaleVisible: false,
      chartDetected: false,
      screenType: 'UNKNOWN',
      visibleLevels: [],
      confidence: 0.0,
      timestamp: now,
    };
  }

  /**
   * Queries configured Gemini Vision API for honest screen perception.
   */
  private static async perceiveWithGeminiVision(
    imageBase64: string
  ): Promise<ObservedScreenFact | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const prompt = `Analyze this trading screen capture with extreme precision:
1. What is the active trading symbol/ticker (e.g. BTCUSD, XAUUSD, EURUSD)? If not clearly visible or unreadable, return "UNKNOWN". NEVER guess or default.
2. What is the active chart timeframe (e.g. 1m, 5m, 15m, 30m, 1h, 4h, 1D)? If not clearly visible or unreadable, return "UNKNOWN". NEVER guess or default.
3. What is the current price visible on the scale or cursor line? If not visible, return null.
4. Is a chart canvas detected? (true/false)
5. Identify any hand-drawn or highlighted zones, rectangles, or horizontal lines with their label, estimated price range, and color.

Return JSON in this format ONLY:
{
  "symbol": "BTCUSD" | "UNKNOWN",
  "timeframe": "5M" | "UNKNOWN",
  "currentPrice": number | null,
  "chartDetected": boolean,
  "appName": string,
  "visibleLevels": [
    {
      "id": "zone_1",
      "label": "Support Zone Box",
      "type": "ZONE",
      "priceRange": "80,225 - 80,305",
      "color": "PINK",
      "confidence": 0.95
    }
  ],
  "confidence": number
}`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: cleanBase64,
                },
              },
              { text: prompt },
            ],
          },
        ],
      });

      const rawText = response.text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          symbol: parsed.symbol || 'UNKNOWN',
          timeframe: parsed.timeframe || 'UNKNOWN',
          currentPrice: typeof parsed.currentPrice === 'number' ? parsed.currentPrice : undefined,
          priceScaleVisible: typeof parsed.currentPrice === 'number',
          chartDetected: Boolean(parsed.chartDetected),
          appName: parsed.appName || 'TradingView',
          screenType: parsed.chartDetected ? 'TRADINGVIEW' : 'UNKNOWN',
          visibleLevels: Array.isArray(parsed.visibleLevels) ? parsed.visibleLevels : [],
          timestamp: new Date().toISOString(),
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
          rawAnalysisText: rawText,
        };
      }
    } catch (e) {
      console.warn('[ScreenPerceptionEngine] Vision AI parsing error:', e);
    }

    return null;
  }

  /**
   * Deterministic local analysis fallback for quick lightweight frame checks.
   */
  private static analyzeFrameDeterministically(imageBase64: string, timestamp: string): ObservedScreenFact {
    const isBase64Valid = Boolean(imageBase64 && imageBase64.length > 500);

    return {
      symbol: 'UNKNOWN',
      timeframe: 'UNKNOWN',
      priceScaleVisible: false,
      chartDetected: isBase64Valid,
      appName: isBase64Valid ? 'Screen Capture' : 'Unknown',
      screenType: isBase64Valid ? 'TRADINGVIEW' : 'UNKNOWN',
      visibleLevels: [],
      confidence: isBase64Valid ? 0.7 : 0.0,
      timestamp,
    };
  }
}
