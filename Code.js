/*
function onFormSubmit(e) {
  const sheet = e.source.getActiveSheet();
  const row = e.range.getRow();
  const email = sheet.getRange(row, 2).getValue(); // adjust if email column isn't B
  const token = generateToken();

  // Store token in column E (or any empty column)
  sheet.getRange(row, 5).setValue(token);

  // Send the token via email
  MailApp.sendEmail({
    to: email,
    subject: "Your Access Token",
    body: `Thank you for submitting the form!\n\nYour access token is: ${token}\n\nUse it here: https://script.google.com/macros/s/AKfycbxW3RVoJuIgJ7ywy2kR3BLI2eoNtOf9hG5h3vKEecu262ABQTsjVfXhpoNfmMLmf4T1/exec`
  });
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 10; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
*/