/**
 * -----------------------------------------------------------------
 * bck-guests.js
 * Chevra Kadisha Guests Form handler
 * -----------------------------------------------------------------
 * Version: 2.2.1 
 * Last updated: 2025-03-26
 * * CHANGELOG v2.2.0:
 * - Initial implementation of Selection Form based on members form code.
 * * CHANGELOG v2.2.1:
 * - Utilizes new email template solution 
 * -----------------------------------------------------------------
 */

/** * @constant {boolean} DEBUG - Toggle for detailed logging in the Apps Script console.
 */
const DEBUG = true;

/** * @constant {number} TOKEN_COLUMN_NUMBER - The specific column index where unique tokens are stored.
 */
const TOKEN_COLUMN_NUMBER = 24;

/**
 * Development utility to simulate a Form Submit event.
 * Used for testing the `processFormSubmit` logic without needing a live form entry.
 */
/**
 * Development utility to simulate a Guest Form Submit event.
 * Updated with specific Guest/Family test data for 2026-03-18.
 */
function debugSubmission() {
  const eObject = {
    "authMode": "FULL",
    "namedValues": {
      "Cell Phone \nPlease enter your 10-digit mobile number (e.g., 3035551212). - no spaces, dashes, or parentheses needed.": ["3036185661"],
      "Relationship to Deceased": ["Family"],
      "Are you over 18 years old?": ["Yes"],
      "Do you want to be on our mailing list for events and training?": ["No"],
      "Name of Deceased": ["No Shmira available"],
      " If you are sitting with another, please provide their full name(s) for our security records.": [""],
      "Timestamp": ["3/18/2026 21:04:45"],
      "Who referred you to the Boulder Chevra Kadisha?": ["Marla Shapiro"],
      "Address": ["6391 Swallow Ln"],
      "City": ["Boulder"],
      "Name, City and State of synagogue.": ["Bonai Shalom"],
      "Email Address": ["eshapiro@gmail.com"],
      "Last Name": ["Shapiro"],
      "By submitting this application, I certify the information is true and accurate and I agree with the terms and conditions of sitting shmira with the Boulder Chevra Kadisha. \n\nA full copy of the terms and conditions can be viewed here. or manually add them - once we have them.. Mostly security, privacy not share urls, etc...": ["Agree"],
      "Zip": ["80303"],
      "First Name": ["Kota"],
      "Will you be sitting shmira alone or with a partner?": ["I will be sitting alone."],
      "State": ["CO"],
      "What is your Jewish community affiliation? \nThe Boulder Chevra Kadisha is a community-wide, independent organization. We serve all Jews in Boulder County—regardless of synagogue membership.": ["Member of local synagogue"]
    },
    "range": { "columnEnd": 19, "columnStart": 1, "rowEnd": 2, "rowStart": 2 },
    "source": {},
    "triggerUid": "440375613325312000",
    "values": ["3/18/2026 21:04:45", "eshapiro@gmail.com", "Yes", "Kota", "Shapiro", "6391 Swallow Ln", "Boulder", "CO", "80303", "3036185661", "No Shmira available", "Family", "Marla Shapiro", "Member of local synagogue", "Bonai Shalom", "I will be sitting alone.", "", "No", "Agree"]
  };

  const response = processFormSubmit(eObject);
  Logger.log("Debug Submission Response: " + response);
}
/**
 * Main entry point for the 'On form submit' trigger.
 * Orchestrates dynamic data mapping, validation, database appending, and notifications.
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e - The Google Form submit event object.
 */
function processFormSubmit(e) {
  Logger.log("Processing form submit");

  // Check library upfront to ensure logging and inputs are available
  if (typeof bckLib === 'undefined') {
    throw new Error("Required library 'bckLib' is not available.");
  }

  let sheetInputs;
  try {
    // Initialize sheet inputs and ensure SPREADSHEET_ID matches the current context
    sheetInputs = bckLib.getSheetInputs();
    sheetInputs.SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

    if (DEBUG) {
      Logger.log("Capturing event data ->");
      Logger.log(JSON.stringify(e));
    }

    // Dynamic mapping converts raw form headers into standardized DB headers
    // Note: Function name updated to match new "Guest" naming convention
    const mappedData = getMappedGuestData(e);
    const eventData = mappedData.dataObject; 
    const dbRowArray = mappedData.rowArray;

    if (DEBUG) console.log("Mapped Event Data:", eventData);

    // Stop processing if this appears to be a profile update rather than a new entry
    let formUpdated = isFormUpdated(eventData);
    if (formUpdated) return "Update Detected: No Append";

    // Determine if guest meets requirements for automatic approval
    let preApproved = preApproveGuests(eventData);
    
    // Sort into appropriate sheet based on approval status (Guest vs Pending Guest)
    const targetSheetName = preApproved ? "Guest DB" : "Pending Guest DB";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.getSheetByName(targetSheetName).appendRow(dbRowArray);
   
    // Send email confirmation to the user - passing sheetInputs as per new logic
    sendFormConfirmationNotification(sheetInputs, eventData, preApproved);

    // Send notification to BCK admin of database updates
    sendFormUpdateNotification(sheetInputs, eventData, preApproved);

    const status = preApproved ? "Approved & Appended" : "Pending & Appended";
    return status;

  } catch (err) {
    Logger.log("Error in processFormSubmit: " + err.toString());
    
    // Since library is checked at the top, we can call it safely here
    bckLib.logQCVars("Process FAILED", { errorMessage: err.toString() });
    
    return "Error: " + err.toString(); 
  }
}
/**
 * Transforms raw form responses into a structured object and array based on a mapping table.
 * * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e - The form submit event object.
 * @returns {Object} result
 * @returns {Array<any>} result.rowArray - Values ordered specifically for spreadsheet appending.
 * @returns {Object} result.dataObject - Key-value pairs where keys are DB Headers.
 */
function getMappedGuestData(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mapSheet = ss.getSheetByName("Guest DB Form Questionnaire Map");
  const mapData = mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 5).getValues();
  
  const namedValues = e.namedValues;
  const generatedToken = Utilities.getUuid();
  const submissionDate = e.namedValues['Timestamp'] ? e.namedValues['Timestamp'][0] : new Date().toLocaleString();
  
  const dataObject = {};

  // Normalize form responses (lowercase, no spaces) to ensure matching regardless of slight header changes
  const normalizedResponses = {};
  for (let key in namedValues) {
    const cleanKey = key.replace(/\s+/g, '').toLowerCase(); 
    normalizedResponses[cleanKey] = namedValues[key][0];
  }

  // Iterate through mapping instructions
  mapData.forEach(mapping => {
    const rawQuestionTitle = mapping[0].toString();
    const cleanLookupKey = rawQuestionTitle.replace(/\s+/g, '').toLowerCase();
    const dbHeader = mapping[1].toString().trim().replace(/\s+/g, '_');
    const defaultValue = mapping[3].toString();
    
    let finalValue = "";
    
    // Check for Virtual/Named Key Lookup
    if (cleanLookupKey !== "" && normalizedResponses[cleanLookupKey] !== undefined) {
      finalValue = normalizedResponses[cleanLookupKey];
    } 
    // Handle Token and Date placeholders
    else if (defaultValue !== "") {
      finalValue = defaultValue
        .replace(/{Token}/g, generatedToken)
        .replace(/{date}/g, submissionDate);
    }
    
    // Fallback: If header is TOKEN and value is still empty, force Token
    if (dbHeader.toUpperCase() === "TOKEN" && finalValue === "") {
      finalValue = generatedToken;
    }

    dataObject[dbHeader] = finalValue;
  });

  // Construct the row array while respecting 'Hidden' flags in the mapping table
  let rowArray = [];
  mapData.forEach(mapping => {
    const dbHeader = mapping[1].toString().trim().replace(/\s+/g, '_');
    const isHidden = mapping[4].toString().toLowerCase() === "true" || mapping[4].toString().toLowerCase() === "yes";
    
    if (!isHidden) {
      rowArray.push(dataObject[dbHeader]);
    }
  });

  return { rowArray, dataObject };
}

/**
 * Evaluates whether a guest meets the criteria for the "Guest DB" or requires manual review.
 * * @param {Object} dataObject - The mapped data containing volunteer responses.
 * @returns {boolean} - Returns true if the guest meets all automatic approval requirements.
 */
function preApproveGuests(dataObject) {
  let preApproved = false;

  // 1. Validate required fields exist in the object before checking logic
  // These keys MUST match the "DB Header" column in your mapping spreadsheet (all caps/underscores)
  if (!dataObject.CERTIFY || 
      !dataObject.AGE_18_PLUS || 
      !dataObject.RELATIONSHIP_TO_DECEASED || 
      !dataObject.AFFILIATION) {
    Logger.log('Error: Missing required fields for guest pre-approval validation');
    return false;
  }

  if (DEBUG) {
    Logger.log("--- Guest Pre-approval Check ---");
    Logger.log("Age 18+: " + dataObject.AGE_18_PLUS);
    Logger.log("Relation to Deceased: " + dataObject.RELATIONSHIP_TO_DECEASED);
    Logger.log("Affiliation: " + dataObject.AFFILIATION);
    Logger.log("Synagogue: " + dataObject.SYNAGOGUE);
  }

  /**
   * GUEST PRE-APPROVAL LOGIC
   * 1. Must be 18+ and have agreed to terms (CERTIFY).
   * 2. Must either be "Family" OR a guest of a local synagogue with a name provided.
   */
  const meetsBasicReqs = (dataObject.AGE_18_PLUS === "Yes" && dataObject.CERTIFY === "Agree");
  
  // Criteria A: Relationship is Family
  const isFamily = (dataObject.RELATIONSHIP_TO_DECEASED === "Family");
  
  // Criteria B: Local Synagogue member with a non-empty Synagogue name
  const isLocalSynagogueMember = (
    dataObject.AFFILIATION === "Member of local synagogue" && 
    dataObject.SYNAGOGUE.trim() !== ""
  );

  if (meetsBasicReqs && (isFamily || isLocalSynagogueMember)) {
    if (DEBUG) Logger.log("Status: Preapproved - Guest meets Family or Synagogue requirements.");
    preApproved = true;
  } else {
    if (DEBUG) Logger.log("Status: Not Preapproved - Manual review required.");
  }

  return preApproved;
}

/**
 * Checks if the submission is an update to an existing profile.
 * * @param {Object} dataObject - The mapped data from the form.
 * @returns {boolean} - Returns true if "Same as above" is detected in identifying fields.
 */
function isFormUpdated(dataObject) {
  if (!dataObject) return false;

  const emailVal = dataObject.EMAIL_1 ? dataObject.EMAIL_1.toLowerCase() : "";
  
  if (emailVal.includes("same as above")) {
    if (DEBUG) Logger.log("Form Update Detected: 'Same as above' found in Email field.");
    return true;
  }

  return false;
}

/**
 * Sends a confirmation email to the user with specific instructions based on their approval status.
 * Updated to use new DB Field Names: PRIMARY_EMAIL, FIRST_NAME, LAST_NAME, ADDRESS.
 * * @param {Object} dataObject - The mapped data object.
 * @param {boolean} [preApproved=false] - Whether the user was automatically approved.
 */
/**
 * Sends confirmation email using local Email sheet templates.
 * @param {Object} dataObject - Mapped form data.
 * @param {boolean} preApproved - Approval status.
 */
function sendFormConfirmationNotification(sheetInputs, dataObject, preApproved = false) {
  let recipientEmail = dataObject.PRIMARY_EMAIL || dataObject.EMAIL_ADDRESS;
  
  const firstName = dataObject.FIRST_NAME || "";
  const lastName = dataObject.LAST_NAME || "";
  const address = dataObject.ADDRESS || "";

  if (!recipientEmail || !firstName || !lastName || !address) {
    Logger.log('Missing notification fields: Email=%s, Name=%s %s, Addr=%s', 
      recipientEmail, firstName, lastName, address);
    return;
  }

  // Load local templates
  const emailTemplates = bckLib.getEmails(sheetInputs);
  const templateKey = preApproved ? 'guest_preapproved' : 'guest_followup';
  const template = emailTemplates.find(t => t.key === templateKey);
  
  if (!template) {
    Logger.log('Template "%s" missing.', templateKey);
    return;
  }

  // Replacements
  const replacements = {
    '[firstName]': firstName,
    '[lastName]': lastName
  };
  const replaceText = (text) => Object.entries(replacements).reduce((str, [k, v]) => 
    str ? str.replace(new RegExp(k.replace(/[[\]]/g, '\\$&'), 'g'), v) : '', text || '');

  const subject = replaceText(template.subject);
  const bodyLines = [];
  for (let i = 1; i <= 30; i++) {
    const lineKey = `line${i}`;
    const lineText = replaceText(template[lineKey]);
    if (lineText.trim()) bodyLines.push(lineText);
  }
  const body = bodyLines.join('\n\n');

  try {
    MailApp.sendEmail(recipientEmail, subject, body);
    Logger.log(`Guest notification sent to ${recipientEmail} (${preApproved ? 'Approved' : 'Follow-up'})`);
  } catch (error) {
    Logger.log(`Guest email ERROR: ${error}`);
  }
}


/**
 * Sends a notification email to the BCK admin that a new user has been added.
 * * @param {Object} dataObject - The mapped data object.
 * @param {boolean} [preApproved=false] - Whether the user was automatically approved.
 */

// For now hard codes the notification email address
const notificationEmailAddress = "marlalshapiro@gmail.com"
// const notificationEmailAddress = "boulder.chevra@gmail.com"

/**
 * Sends admin notification using local templates.
 * @param {Object} dataObject - Form data.
 * @param {boolean} preApproved - Status.
 */
function sendFormUpdateNotification(sheetInputs, dataObject, preApproved = false) {
  const recipientEmail = dataObject.PRIMARY_EMAIL || dataObject.EMAIL_ADDRESS;
  const category = dataObject.CATEGORY || "";
  const firstName = dataObject.FIRST_NAME || "";
  const lastName = dataObject.LAST_NAME || "";
  const phone = dataObject.PRIMARY_MOBILE_PHONE || "";

  if (!category || !recipientEmail || !firstName || !lastName) {
    Logger.log('Admin notification missing fields.');
    return;
  }

  const emailTemplates = bckLib.getEmails(sheetInputs);
  const templateKey = preApproved ? 'admin_preapproved' : 'admin_followup';
  const template = emailTemplates.find(t => t.key === templateKey);
  
  if (!template) {
    Logger.log('Admin template "%s" missing.', templateKey);
    return;
  }

  const replacements = {
    '[category]': category,
    '[firstName]': firstName,
    '[lastName]': lastName,
    '[recipientEmail]': recipientEmail,
    '[phone]': phone
  };
  const replaceText = (text) => Object.entries(replacements).reduce((str, [k, v]) => 
    str ? str.replace(new RegExp(k.replace(/[[\]]/g, '\\$&'), 'g'), v) : '', text || '');

  const subject = replaceText(template.subject);
  const bodyLines = [];
  for (let i = 1; i <= 30; i++) {
    const lineKey = `line${i}`;
    const lineText = replaceText(template[lineKey]);
    if (lineText.trim()) bodyLines.push(lineText);
  }
  const body = bodyLines.join('\n\n');

  try {
    MailApp.sendEmail("marlalshapiro@gmail.com", subject, body); // Your hardcoded admin email
    Logger.log(`Admin notification sent (${preApproved ? 'Approved' : 'Pending'})`);
  } catch (error) {
    Logger.log(`Admin email ERROR: ${error}`);
  }
}
