/**
 * -----------------------------------------------------------------
 * bck-guests.js
 * Chevra Kadisha Guests Form handler
 * -----------------------------------------------------------------
 * Version: 2.2.0 
 * Last updated: 2025-03-19
 * * CHANGELOG v2.2.0:
 * - Initial implementation of Selection Form based on members form code.
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
 * * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e - The Google Form submit event object.
 */
function processFormSubmit(e) {
  Logger.log("Processing form submit");
  
  try {
    if (DEBUG) {
      Logger.log("Capturing event data - >");
      Logger.log(JSON.stringify(e));
    }

    // Dynamic mapping converts raw form headers into standardized DB headers
    const mappedData = getMappedGuestData(e);
    const eventData = mappedData.dataObject; 
    const dbRowArray = mappedData.rowArray;

    if (DEBUG) console.log("Mapped Event Data:", eventData);

    // Stop processing if this appears to be a profile update rather than a new guest
    let formUpdated = isFormUpdated(eventData);
    if (formUpdated) return;

    // Determine if guest meets requirements for automatic approval
    let preApproved = preApproveGuests(eventData);
    
    // Sort into appropriate sheet based on approval status
    const targetSheetName = preApproved ? "Guest DB" : "Pending Guest DB";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.getSheetByName(targetSheetName).appendRow(dbRowArray);
   
    // Send email confirmation to the user
    sendFormConfirmationNotification(eventData, preApproved);

    const status = preApproved ? "Approved & Appended" : "Pending & Appended";

    // Send notification to BCK admin of database updates
    sendFormUpdateNotification(eventData, preApproved);
    
    return status;
    
  } catch (err) {
    Logger.log("Error in processFormSubmit: " + err.toString());
    // Assumes existence of a library 'bckLib' for external logging
    if (typeof bckLib !== 'undefined') {
      bckLib.logQCVars("Process FAILED", { errorMessage: err.toString() });
    }
    return "Error: " + err.toString(); // Return the error so the debugger sees it
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
function sendFormConfirmationNotification(dataObject, preApproved = false) {
  
  // 1. EMAIL VALIDATION & EXTRACTION
  // The new field list specifies "PRIMARY EMAIL" (mapped as PRIMARY_EMAIL)
  let recipientEmail = dataObject.PRIMARY_EMAIL;
  
  // Safety fallback if the mapping varies or uses the system timestamped email
  if (!recipientEmail || recipientEmail.toLowerCase().includes("same as above")) {
    recipientEmail = dataObject.EMAIL_ADDRESS; 
  }

  // 2. DATA EXTRACTION
  const firstName = dataObject.FIRST_NAME || "";
  const lastName = dataObject.LAST_NAME || "";
  const address = dataObject.ADDRESS || "";

  // 3. VALIDATION CHECK
  if (!recipientEmail || !firstName || !lastName || !address) {
    Logger.log('Error: Missing required notification fields. ' + 
               'Email: ' + recipientEmail + ', Name: ' + firstName + ' ' + lastName + ', Addr: ' + address);
    return;
  }

  /**
   * Generates the email subject and body for pre-approved guests.
   * @param {Object} data - The data object passed from the parent scope.
   */
  function _preApprovedResponse(data) {
    return {
      subject: `${data.FIRST_NAME} ${data.LAST_NAME} - Approved - BCK Guest Shmira`,
      body: `
Dear ${data.FIRST_NAME},

Thank you for signing up with BCK as a guest shmira volunteer.

You will receive a separate email request to schedule your shmira. The email will include a link to a web portal where you may sign up for shmira. Please remember that this link is unique to you so please do not share it. 

If you have any questions, do not hesitate to contact us by email or phone.

With gratitude,

Boulder Chevra Kadisha
Phone - 303-842-5365
Email - boulder.chevra@gmail.com`
    };
  }

  /**
   * Generates the email subject and body for guests requiring follow-up.
   * @param {Object} data - The data object passed from the parent scope.
   */
  function _followupResponse(data) {
    return {
      subject: `${data.FIRST_NAME} ${data.LAST_NAME} - Thank you for volunteering with Boulder's Chevra Chadisha - Let's talk`,
      body: `
Dear ${data.FIRST_NAME},

Thank you for submitting your Guest Shomerim application with the Boulder Chevra Kadisha. We need to discuss the available options with you. 

Please call us at (303) 842-5365 or reply to this email with your availability to have a 15-minute conversation. 

Boulder Chevra Kadisha
Phone - 303-842-5365
Email - boulder.chevra@gmail.com

We appreciate your willingness to perform this sacred duty and look forward to speaking with you. 

With gratitude,

Boulder Chevra Kadisha`
    };
  }

  // Select the correct content, passing dataObject into the helper functions
  const emailData = preApproved ? _preApprovedResponse(dataObject) : _followupResponse(dataObject);

  // 4. EXECUTION
  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: emailData.subject,
      body: emailData.body
    });
    Logger.log(`Guest notification sent successfully to ${recipientEmail}. Status: ${preApproved ? 'Approved' : 'Follow-up'}`);
  } catch (error) {
    Logger.log(`ERROR sending notification email to ${recipientEmail}: ${error.toString()}`);
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

function sendFormUpdateNotification(dataObject, preApproved = false) {
  // Fallback: If user used "Same as above" in contact email, use the system-captured email
  let recipientEmail = dataObject.EMAIL_1;
  if (!recipientEmail || recipientEmail.toLowerCase().includes("same as above")) {
    recipientEmail = dataObject.PRIMARY_EMAIL; 
  }

  const category = dataObject.CATEGORY || "";
  const firstName = dataObject.FIRST_NAME || "";
  const lastName = dataObject.LAST_NAME || "";
  const phone = dataObject.PRIMARY_MOBILE_PHONE || "";
  const email = dataObject.ADDRESS || "";

  if (!category || !recipientEmail || !firstName || !lastName) {
    Logger.log('Error: Missing required fields (Category, Email, Name, or Address) for notification');
    return;
  }

  /**
   * Generates the email subject and body for pre-approved members.
   * @returns {Object} {subject, body}
   */
  function _preApprovedResponse() {
    return {
      subject : `${firstName} ${lastName} - Notice of new Boulder Chevra Kadisha ${category} PREAPPROVED`,
      body: `

This message is to notify you that a new ${category} has been PRE-APPROVED and has been added to the ${category} database automatically.

Category - ${category}
Lastname - ${lastName}
Firstname - ${firstName}
Email - ${recipientEmail}
Phone - ${phone}

Next Steps - No further action is required.

      `
    };
  }


  /**
   * Generates the email subject and body for members requiring follow-up.
   * @returns {Object} {subject, body}
   */
  function _followupResponse() {
    return {
      subject : `${firstName} ${lastName} - ** ACTION REQUIRED ** Notice of new Boulder Chevra Kadisha ${category} PENDING`,
      body: `

This message is to notify you that a new ${category} is PENDING approval and has yet to be added to the ${category} database.

Category - ${category}
Lastname - ${lastName}
Firstname - ${firstName}
Email - ${recipientEmail}
Phone - ${phone}

Next Steps - Contact the pending ${category} and then move their request from pending to approved.

      `
    };
  }

  const emailData = preApproved ? _preApprovedResponse() : _followupResponse();

  try {
    MailApp.sendEmail({
      to: recipientEmail,
      subject: emailData.subject,
      body: emailData.body
    });
    Logger.log(`${category} admin notification sent successfully to ${recipientEmail}.`);
  } catch (error) {
    Logger.log(`ERROR sending ${category} admin notification email to ${recipientEmail}: ${error.toString()}`);
  }
}