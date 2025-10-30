/*
// ===== WEB APP ENTRY POINT =====
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('tokenForm');
}

// ===== CHECK TOKEN FUNCTION =====
function checkToken(token) {
  const ss = SpreadsheetApp.openById('1Ht-OT-8LvobJ9obDJxrS5uq14z0K4CunlNCcip4hbsE'); // replace with your ID

  // Ensure Tokens sheet exists
  let tokenSheet = ss.getSheetByName('Tokens');
  if (!tokenSheet) {
    tokenSheet = ss.insertSheet('Tokens');
    tokenSheet.appendRow(['Token', 'Timestamp']);
  }

  // Get tokens
  const values = tokenSheet.getRange('A2:A').getValues().flat();
  Logger.log('All tokens: ' + JSON.stringify(values));

  // If token doesn't exist, reject
  if (!values.includes(token)) {
    Logger.log('Entered token: ' + token + ' (invalid)');
    return false;
  }

  Logger.log('Entered token: ' + token + ' (valid)');

  // Get schedule
  let sched = ss.getSheetByName('Schedule');
  if (!sched) return [['No schedule found']];
  return sched.getDataRange().getValues();
}

// ===== UTILITY: CREATE TOKEN (OPTIONAL MANUAL) =====
function createToken() {
  const ss = SpreadsheetApp.openById('1Ht-OT-8LvobJ9obDJxrS5uq14z0K4CunlNCcip4hbsE'); // same ID
  let tokenSheet = ss.getSheetByName('Tokens');
  if (!tokenSheet) {
    tokenSheet = ss.insertSheet('Tokens');
    tokenSheet.appendRow(['Token', 'Timestamp']);
  }
  const token = Utilities.getUuid().slice(0, 8);
  tokenSheet.appendRow([token, new Date()]);
  return token;
}

// ===== TEST FUNCTION =====
function testCheck() {
  const token = '82156209'; // copy from your Tokens sheet
  const result = checkToken(token);
  Logger.log(result);
}
*/
