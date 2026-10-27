import { env } from '../config/env.js';

/**
 * Optional Financial News & Announcement Sentiment Parser
 * Strictly non-blocking and isolated from algorithmic execution safety rules.
 */
export class NewsAnalyzer {
  static async analyzeNewsItem({ headline, source = 'NSE / Corporate Feed', publishedAt = new Date().toISOString() }) {
    // If AI is set to mock or no key provided, return structured deterministic analysis
    if (env.OPTIONAL_AI_PROVIDER === 'mock' || !env.OPTIONAL_AI_API_KEY) {
      return this._mockAnalysis(headline, source, publishedAt);
    }

    try {
      // Treat headline as untrusted user input
      const sanitizedHeadline = String(headline).slice(0, 500).replace(/[<>{}]/g, '');

      if (env.OPTIONAL_AI_PROVIDER === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.OPTIONAL_AI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${env.OPTIONAL_AI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are an Indian stock market financial analyst. Analyze this news headline and return ONLY raw JSON (no backticks): {"sentiment": "BULLISH"|"BEARISH"|"NEUTRAL", "score": number between -1.0 and 1.0, "summary": "brief summary max 20 words", "impact": "HIGH"|"MEDIUM"|"LOW"}.\nHeadline: "${sanitizedHeadline}"`,
                  },
                ],
              },
            ],
          }),
        });

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return {
          headline: sanitizedHeadline,
          source,
          publishedAt,
          sentiment: parsed.sentiment || 'NEUTRAL',
          score: parsed.score || 0,
          summary: parsed.summary || 'Gemini financial synthesis completed.',
          impact: parsed.impact || 'MEDIUM',
          provider: 'google_gemini_free',
        };
      }

      if (env.OPTIONAL_AI_PROVIDER === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.OPTIONAL_AI_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.OPTIONAL_AI_MODEL || 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an Indian financial news analyst. Return JSON with keys: sentiment (BULLISH/BEARISH/NEUTRAL), score (-1.0 to 1.0), summary (max 20 words), impact (HIGH/MEDIUM/LOW).',
              },
              { role: 'user', content: sanitizedHeadline },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          }),
        });

        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        return {
          headline: sanitizedHeadline,
          source,
          publishedAt,
          sentiment: parsed.sentiment,
          score: parsed.score,
          summary: parsed.summary,
          impact: parsed.impact,
          provider: 'openai',
        };
      }
    } catch (err) {
      console.warn('AI Analysis failed, falling back gracefully:', err.message);
    }

    return this._mockAnalysis(headline, source, publishedAt);
  }

  static _mockAnalysis(headline, source, publishedAt) {
    const text = (headline || '').toLowerCase();
    let sentiment = 'NEUTRAL';
    let score = 0.0;
    let impact = 'LOW';

    if (text.includes('profit') || text.includes('growth') || text.includes('order win') || text.includes('dividend') || text.includes('expansion')) {
      sentiment = 'BULLISH';
      score = 0.65;
      impact = 'MEDIUM';
    } else if (text.includes('loss') || text.includes('penalty') || text.includes('investigation') || text.includes('drop') || text.includes('resigns')) {
      sentiment = 'BEARISH';
      score = -0.7;
      impact = 'HIGH';
    }

    return {
      headline,
      source,
      publishedAt,
      sentiment,
      score,
      summary: `Automated rule-based heuristic parsing for "${(headline || '').slice(0, 35)}..."`,
      impact,
      provider: 'rule_heuristic_mock',
    };
  }

  /**
   * Free Trade Copilot & Quantitative Signal Explainer
   * Explains technical setup, momentum, volume, and statutory charge breakeven.
   */
  static async generateTradeExplanation({ symbol, ltp, signal = {}, snapshot = {} }) {
    const isValid = signal.is_valid && signal.signal_type === 'BUY';
    const score = signal.signal_score || 0;
    const vwap = snapshot.vwap ? `₹${snapshot.vwap.toFixed(2)}` : 'N/A';
    const rsi = snapshot.rsi ? snapshot.rsi.toFixed(1) : 'N/A';
    const rvol = snapshot.rvol ? `${snapshot.rvol.toFixed(2)}x` : 'N/A';
    const supertrend = snapshot.supertrendTrend || 'NEUTRAL';

    // If Gemini free key is provided, use Gemini for synthesis
    if (env.OPTIONAL_AI_PROVIDER === 'gemini' && env.OPTIONAL_AI_API_KEY) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.OPTIONAL_AI_MODEL || 'gemini-1.5-flash'}:generateContent?key=${env.OPTIONAL_AI_API_KEY}`;
        const prompt = `You are a quant algorithmic trading expert on the National Stock Exchange (NSE). Explain this setup in concise bullet points:
Stock: ${symbol}, LTP: ₹${ltp}, VWAP: ${vwap}, RSI (14): ${rsi}, RVOL: ${rvol}, Supertrend: ${supertrend}, Score: ${score}%, Setup: ${isValid ? 'BUY SIGNAL' : 'NO TRADE'}.
Format JSON without backticks: {"bias": "BULLISH"|"BEARISH"|"NEUTRAL", "narrative": "2-3 sentences explaining technical interaction", "keyInsight": "1 key technical observation", "chargesAdvice": "1 sentence on breakeven considering Indian STT and brokerage"}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          provider: 'google_gemini_free',
          ...parsed,
        };
      } catch (err) {
        // Fall back to rule-based quant explainer
      }
    }

    // Built-in Deterministic Quant AI Explainer (100% Free, Zero latency, Always available)
    const bias = score >= 70 ? 'BULLISH' : score >= 40 ? 'NEUTRAL' : 'BEARISH';
    let narrative = '';
    let keyInsight = '';

    if (isValid) {
      narrative = `Price ₹${ltp} is trading above institutional VWAP (${vwap}) with EMA 20 stacked above EMA 50. Supertrend is ${supertrend} and RSI at ${rsi} confirms strong directional momentum with ${rvol} volume liquidity.`;
      keyInsight = `High-probability breakout setup with an algorithmic confluence score of ${score}%. Risk is limited to 0.5% with dynamic ATR stops.`;
    } else {
      narrative = `Technical conditions are partially met (${score}% score). Stock is currently in consolidation. Waiting for confirmed volume expansion above VWAP (${vwap}) and RSI crossing above 55.`;
      keyInsight = `Algorithmic safety gate active: Entry deferred to preserve capital until all momentum filters align.`;
    }

    const chargesAdvice = `Statutory STT (0.025%) and exchange charges require an intraday move of approximately +0.10% to achieve net profitability.`;

    return {
      provider: 'quant_copilot_free',
      bias,
      narrative,
      keyInsight,
      chargesAdvice,
    };
  }
}
