import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📝 Manual data update received:', body);

    // Préparer les mises à jour avec paramètres sécurisés
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (body.inflation !== undefined) {
      updates.push(`inflation_value = $${paramIndex}, inflation_updated_at = NOW()`);
      values.push(parseFloat(body.inflation));
      paramIndex++;
    }

    if (body.snbRate !== undefined) {
      updates.push(`snb_policy_rate_value = $${paramIndex}, snb_updated_at = NOW()`);
      values.push(parseFloat(body.snbRate));
      paramIndex++;
    }

    // NOUVEAU: Support pour SARON futures
    if (body.saronFutures !== undefined) {
      const saronPrice = parseFloat(body.saronFutures);
      
      // Validation des données SARON
      if (saronPrice < 95 || saronPrice > 105) {
        return NextResponse.json({
          success: false,
          error: 'Prix SARON futures invalide. Doit être entre 95-105 (ex: 99.750)'
        }, { status: 400 });
      }
      
      // Calculer le taux implicite
      const impliedRate = 100 - saronPrice;
      
      updates.push(`saron_futures_price = $${paramIndex}`);
      values.push(saronPrice);
      paramIndex++;
      
      updates.push(`market_implied_rate = $${paramIndex}`);
      values.push(impliedRate);
      paramIndex++;
      
      console.log(`📊 SARON update: Price ${saronPrice} → Implied rate ${impliedRate.toFixed(3)}%`);
    }

    if (body.gdp !== undefined) {
      updates.push(`gdp_value = $${paramIndex}, gdp_updated_at = NOW()`);
      values.push(parseFloat(body.gdp));
      paramIndex++;
    }

    if (body.unemployment !== undefined) {
      updates.push(`unemployment_value = $${paramIndex}, unemployment_updated_at = NOW()`);
      values.push(parseFloat(body.unemployment));
      paramIndex++;
    }

    if (body.realEstate !== undefined) {
      updates.push(`real_estate_value = $${paramIndex}, real_estate_updated_at = NOW()`);
      values.push(parseFloat(body.realEstate));
      paramIndex++;
    }

    if (body.exchangeRate !== undefined) {
      updates.push(`exchange_rate_value = $${paramIndex}, exchange_rate_updated_at = NOW()`);
      values.push(parseFloat(body.exchangeRate));
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid data provided for update'
      }, { status: 400 });
    }

    // Exécuter la requête de manière sécurisée avec des paramètres
    const query = `UPDATE latest_indicators SET ${updates.join(', ')} WHERE id = 1`;
    
    console.log('Executing query:', query);
    console.log('With values:', values);
    
    await sql.query(query, values);

    console.log('✅ Manual data update completed');

    // Récupérer les données mises à jour pour confirmation
    const { rows } = await sql`SELECT * FROM latest_indicators WHERE id = 1;`;
    const updatedData = rows[0];

    // Préparer la réponse avec détails SARON si mis à jour
    const responseData = {
      success: true,
      message: 'Manual data update completed successfully',
      updatedFields: Object.keys(body),
      timestamp: new Date().toISOString()
    };

    // Ajouter les détails SARON si mis à jour
    if (body.saronFutures !== undefined) {
      responseData.saronDetails = {
        futuresPrice: updatedData.saron_futures_price,
        impliedRate: updatedData.market_implied_rate,
        interpretation: `Prix ${updatedData.saron_futures_price} → Taux implicite ${updatedData.market_implied_rate.toFixed(3)}%`
      };
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Manual data update failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}