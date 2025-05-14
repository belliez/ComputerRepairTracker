// Helper function to consistently convert PostgreSQL boolean values
// PostgreSQL can return 't'/'f' strings or JavaScript true/false
function isPostgresTrue(value: any): boolean {
  return value === true || value === 't' || value === 'true';
}

// First location - line 2481 (public settings)
// Find the default currency from the database
let defaultCurrencyCode = null;
for (const row of orgSettings.rows) {
  console.log(`DEBUG: Checking row: ${JSON.stringify(row)}, is_default: ${row.is_default}, type: ${typeof row.is_default}`);
  if (isPostgresTrue(row.is_default)) {
    defaultCurrencyCode = row.currency_code;
    console.log(`DEBUG: Found default currency code in DB: ${defaultCurrencyCode}`);
    break;
  }
}

// Second location - line 4056 (settings)
// Find the default currency from the database
let defaultCurrencyCode = null;
for (const row of orgSettings.rows) {
  console.log(`DEBUG: Checking row: ${JSON.stringify(row)}, is_default: ${row.is_default}, type: ${typeof row.is_default}`);
  if (isPostgresTrue(row.is_default)) {
    defaultCurrencyCode = row.currency_code;
    console.log(`DEBUG: Found default currency code in DB: ${defaultCurrencyCode}`);
    break;
  }
}