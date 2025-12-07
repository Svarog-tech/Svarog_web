/**
 * Rychlý test HestiaCP API připojení
 * Spusť: node test-hestiacp-quick.js
 */

require('dotenv').config();
const hestiacp = require('./services/hestiacpService');

async function testConnection() {
  console.log('================================================');
  console.log('  HestiaCP API Quick Test');
  console.log('================================================');
  console.log('');

  // Zkontroluj konfiguraci
  console.log('Konfigurace:');
  console.log(`  URL: ${process.env.HESTIACP_URL || 'NENASTAVENO'}`);
  console.log(`  Username: ${process.env.HESTIACP_USERNAME || 'NENASTAVENO'}`);
  console.log(`  Access Key: ${process.env.HESTIACP_ACCESS_KEY ? '✅ Nastaveno' : '❌ NENASTAVENO'}`);
  console.log(`  Secret Key: ${process.env.HESTIACP_SECRET_KEY ? '✅ Nastaveno' : '❌ NENASTAVENO'}`);
  console.log('');

  if (!process.env.HESTIACP_URL || !process.env.HESTIACP_ACCESS_KEY) {
    console.log('❌ Chybí konfigurace! Vytvoř .env soubor nebo spusť setup-hestiacp.bat');
    process.exit(1);
  }

  // Test 1: List users (základní test)
  console.log('[Test 1] Testování připojení - v-list-users...');
  try {
    const result = await hestiacp.callAPI('v-list-users', ['json'], 'headers');
    
    if (result.success) {
      console.log('✅ Připojení úspěšné!');
      console.log('');
      
      // Zkus parsovat JSON pokud je to JSON
      if (typeof result.data === 'string') {
        try {
          const users = JSON.parse(result.data);
          console.log(`Nalezeno uživatelů: ${Object.keys(users).length}`);
          if (process.env.HESTIACP_USERNAME) {
            if (users[process.env.HESTIACP_USERNAME]) {
              console.log(`✅ Uživatel "${process.env.HESTIACP_USERNAME}" existuje`);
            }
          }
        } catch {
          console.log('Odpověď:', result.data.substring(0, 100));
        }
      } else {
        console.log('Odpověď:', result.data);
      }
    } else {
      console.log('❌ Připojení selhalo:', result.error);
      console.log('');
      console.log('Zkusím alternativní metody autentizace...');
      
      // Zkus metodu 2 (params)
      console.log('[Test 2] Zkouším metodu s POST parametry...');
      const result2 = await hestiacp.callAPI('v-list-users', ['json'], 'params');
      if (result2.success) {
        console.log('✅ Metoda s POST parametry funguje!');
      } else {
        console.log('❌ Metoda s POST parametry selhala:', result2.error);
        
        // Zkus metodu 1 (hash)
        console.log('[Test 3] Zkouším metodu s hash parametrem...');
        const result3 = await hestiacp.callAPI('v-list-users', ['json'], 'hash');
        if (result3.success) {
          console.log('✅ Metoda s hash parametrem funguje!');
        } else {
          console.log('❌ Všechny metody selhaly:', result3.error);
          process.exit(1);
        }
      }
    }
  } catch (error) {
    console.error('❌ Chyba při testování:', error.message);
    process.exit(1);
  }

  console.log('');
  console.log('================================================');
  console.log('  Test dokončen - HestiaCP je připojeno! ✅');
  console.log('================================================');
}

testConnection();

