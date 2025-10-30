function updateDropdown() {
  const sheet = SpreadsheetApp.openById(CURRENT_EVENT_SPREADSHEET_ID).getSheetByName(CURRENT_EVENT_SPREADSHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${CURRENT_EVENT_SPREADSHEET_NAME}`);
  const form = FormApp.openById(CURRENT_FORM_ID);
  if (!form) throw new Error(`Form not found: ${CURRENT_FORM_ID}`);
  const data = sheet.getRange('F4:F').getValues().flat().filter(v => v);
  const checkbox = form.getItems(FormApp.ItemType.CHECKBOX)[0].asCheckboxItem();
  checkbox.setChoiceValues(data);
}
