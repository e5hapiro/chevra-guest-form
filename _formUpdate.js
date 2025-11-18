/**
* -----------------------------------------------------------------
* _gFormUpdate.js
* Chevra Kadisha Guest Form Dropdown updates
* -----------------------------------------------------------------
* _gFormUpdate.js
Version: 1.0.0 * Last updated: 2025-11-14
 * 
 * CHANGELOG v1.0.0:
 *   - Initial implementation of updateDropdown();
 * -----------------------------------------------------------------
 */


function updateDropdown() {

  const CURRENT_FORM_ID = "1uYQjH1cYyMy6Q3g4mqUQe3lPVNwkJSVAWYr4memSLok";
  const CURRENT_EVENT_SPREADSHEET_NAME = "_view_active_events";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CURRENT_EVENT_SPREADSHEET_NAME);

  if (!sheet) throw new Error(`Sheet not found: ${CURRENT_EVENT_SPREADSHEET_NAME}`);

  const form = FormApp.openById(CURRENT_FORM_ID);

  if (!form) throw new Error(`Form not found: ${CURRENT_FORM_ID}`);
  const data = sheet.getRange('F4:F').getValues().flat().filter(v => v);
  const checkbox = form.getItems(FormApp.ItemType.CHECKBOX)[0].asCheckboxItem();
  checkbox.setChoiceValues(data);

}
