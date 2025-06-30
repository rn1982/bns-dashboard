// app/api/debug/database/route.js
import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Debugging database data...');
    
    // Récupérer toutes les données
    const { rows } = await sql`
      SELECT * FROM latest_indicators WHERE id = 1;
    `;
    
    if (rows.length === 0) {
      return NextResponse.json({
        error: "❌ Aucune donnée trouvée dans latest_indicators",
        suggestion: "La table existe-t-elle ? Y a-t-il un enregistrement avec id=1 ?"
      });
    }
    
    const data = rows[0];
    console.log('📊 Data found:', data);
    
    // Analyser spécifiquement les données SARON
    const saronAnalysis = {
      hasSaronData: data.saron_futures_price !== null,
      saronFuturesPrice: data.saron_futures_price,
      marketImpliedRate: data.market_implied_rate,
      marketProbability: data.market_probability,
      dataQuality: "unknown"
    };
    
    // Évaluer la qualité des données SARON
    if (data.saron_futures_price === null) {
      saronAnalysis.dataQuality = "❌ NULL - Pas de données";
      saronAnalysis.problem = "Les données SARON ne sont jamais mises à jour";
    } else if (data.saron_futures_price < 95 || data.saron_futures_price > 105) {
      saronAnalysis.dataQuality = "⚠️ SUSPECT - Valeur hors plage normale";
      saronAnalysis.problem = "La valeur ne ressemble pas à un prix de futures";
    } else {
      saronAnalysis.dataQuality = "✅ OK - Valeur plausible";
      saronAnalysis.problem = "Aucun problème apparent";
    }
    
    // Calculer ce que ça implique si on a les données
    if (data.saron_futures_price && data.snb_policy_rate_value !== null) {
      const impliedRate = 100 - data.saron_futures_price;
      const expectedChange = data.snb_policy_rate_value - impliedRate;
      const expectedChangeBp = Math.round(expectedChange * 100);
      
      saronAnalysis.calculation = {
        currentSNBRate: data.snb_policy_rate_value,
        impliedRate: parseFloat(impliedRate.toFixed(3)),
        expectedChangeBp: expectedChangeBp,
        interpretation: expectedChangeBp > 0 ? `Marché attend ${expectedChangeBp}bp de BAISSE` :
                       expectedChangeBp < 0 ? `Marché attend ${Math.abs(expectedChangeBp)}bp de HAUSSE` :
                       "Marché attend PAS DE CHANGEMENT"
      };
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        saronDataExists: data.saron_futures_price !== null,
        saronValue: data.saron_futures_price,
        dataQuality: saronAnalysis.dataQuality,
        problem: saronAnalysis.problem
      },
      fullData: data,
      saronAnalysis: saronAnalysis,
      nextSteps: [
        data.saron_futures_price === null ? "🔧 Implémenter la récupération des données SARON" : null,
        (data.saron_futures_price && (data.saron_futures_price < 95 || data.saron_futures_price > 105)) ? "🔧 Corriger la source des données SARON" : null,
        "📊 Comparer avec les vraies données de marché",
        "🔄 Implémenter la mise à jour automatique"
      ].filter(Boolean)
    });
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      suggestion: "Vérifier la connexion à la base de données Neon"
    }, { status: 500 });
  }
}