/**
* -----------------------------------------------------------------
* _gFormHandler.js
* Chevra Kadisha Guests Form handler
* -----------------------------------------------------------------
* _selection_form.js
Version: 1.0.0 * Last updated: 2025-11-14
 * 
 * CHANGELOG v1.0.0:
 *   - Initial implementation of Selection Form.
 * -----------------------------------------------------------------
 */


/**
 * ADMIN FUNCTIONS (Triggered by form submit or manual run)
 * -------------------------------------------------------------------
 */

/**
 * Handles the 'On form submit' trigger from the administrator's event form.
 * This function processes the form response and updates the Shifts Master sheet.
 * @param {GoogleAppsScript.Events.SheetsOnFormSubmit} e The form submit event object.
 */
function processFormSubmit(e) {
  
  Logger.log("Processing form submit");

  const eventInputs = {
    DEBUG: true,
    VALUES: e.values,
    RANGE: e.range,
    SHEET_ID: e.range.getSheet(),
    ROW_ID: e.range.getRow(),
    UUID: Utilities.getUuid(),
    TOKEN_COLUMN_NUMBER: 22,
    APPROVAL_COLUMN_NUMBER: 23
  };

  addToken(eventInputs);

  let eventData = {}; 
  
  try {
    const context = "formSubmit e values"
    const rawValues = eventInputs.VALUES;
    logQCVars(eventData.DEBUG,context, rawValues)

    // --- Create a single data object ---
    eventData = {
      rawValues: rawValues,
      submissionDate: rawValues[0],
      email: rawValues[1],
      firstName: rawValues[2],
      lastName: rawValues[3],
      address: rawValues[4],
      city: rawValues[5],
      state: rawValues[6],
      zipcode: rawValues[7],
      phone: rawValues[8],
      q_textToPhone: rawValues[9],
      q_nameOfDeceased: rawValues[10],
      q_relationToDeceased: rawValues[11],
      q_age18plus: rawValues[12],
      q_tbd: rawValues[13],
      q_shmiraBizHoursOk: rawValues[14],
      q_tbd2: rawValues[15],
      q_affiliation: rawValues[16],      
      q_synagogueName: rawValues[17],
      q_onMailingList: rawValues[18],
      q_certifyTrue: rawValues[19]
    };

    Logger.log(JSON.stringify(eventData));

    // --- QC LOG 1: After initial extraction ---
    // Log the entire data object
    logQCVars(eventData.DEBUG,"After Variable Extraction", eventData);

    // -------------------------------------------------------------------
    // --- Handle Updated Form scenario ---
    // -------------------------------------------------------------------
    let formUpdated = isFormUpdated(eventData);

    // If the form is updated current not proceeding with any change
    if (formUpdated) {
        return
    }

    // -------------------------------------------------------------------
    // --- Preapproval Validation ---
    // -------------------------------------------------------------------
    let preApproved = preApproveGuests(eventData);
    addApprovalCheckbox(eventInputs, preApproved);  // Adds a checkbox whether preapproval has occurred
   
    // -------------------------------------------------------------------
    // --- Individual Email Notification to all volunteers ---
    // -------------------------------------------------------------------
    sendFormConfirmationNotification(eventData, preApproved);
    
    // --- QC LOG 5: Process Complete ---
    logQCVars(eventData.DEBUG, "Process Complete", { status: "Success" });
    return

  } catch (e) {
    
    // --- QC LOG 6: On Error ---
    // Log the error AND the state of the data object when it failed
    logQCVars(eventData.DEBUG,"Process FAILED", {
      errorMessage: e.toString(),
      errorStack: e.stack || "No stack available",
      eventDataAtFailure: eventData 
    });
  }

}


/**
 * Determines if a guest is preapproved following Chevra Kadiskah logic
 * @param {object} eventData The event data object
 */
function preApproveGuests(eventData) {

  let preApproved = false;

  // Validate required fields for prevalidation
  if (!eventData || 
      !eventData.q_certifyTrue ||
      !eventData.q_age18plus || 
      !eventData.q_shmiraBizHoursOk || 
      !eventData.q_relationToDeceased || 
      !eventData.q_affiliation ||
      !eventData.q_synagogueName ) {
    Logger.log('Error: Missing required event data fields for prevalidation');
    return false;
  }

  if(eventData.DEBUG){
    Logger.log("Preapproval Criteria used:");
    Logger.log("18Plus?"+ eventData.q_age18plus );
    Logger.log("ShmiraBizHours?:"+ eventData.q_shmiraBizHoursOk );
    Logger.log("Relation to Deceased:"+ eventData.q_relationToDeceased );
    Logger.log("Affiliation:"+ eventData.q_affiliation );
    Logger.log("SynagogueName:"+ eventData.q_synagogueName );
  };

  // Preapprove family if matching the following answers
  if (
        (eventData.q_age18plus === "Yes" &&
        eventData.q_shmiraBizHoursOk === "Yes") &&
          (
            eventData.q_relationToDeceased === "Family"
          ))
      {
            if(eventData.DEBUG){Logger.log("Preapproved - meets family minimums");};
            preApproved = true;
      };

  // Preapprove family or community members if matching the following answers
  if (
        (eventData.q_age18plus === "Yes" &&
        eventData.q_shmiraBizHoursOk === "Yes") &&
          (
            eventData.q_affiliation === "Member of local synagogue" &&
            eventData.q_synagogueName !== ""
          ))
      {
          if(eventData.DEBUG){Logger.log("Preapproved - meets local synagogue minimums");};
          preApproved = true;
      };

  if(eventData.DEBUG){Logger.log("Returning") + preApproved;};
  return preApproved;

}


/**
 * Adds approval checkbox to the last column of the last row entered
 * @param {object} eventData The event data object
 * @param boolean preApproval 
 */
function addApprovalCheckbox(eventInputs, preApproved=false) {
  try {

    var sheet = eventInputs.SHEET_ID;
    var range = eventInputs.RANGE;
    var row = eventInputs.ROW_ID;
    var columnNumber= eventInputs.APPROVAL_COLUMN_NUMBER;

    Logger.log
    var checkboxCell = sheet.getRange(row, columnNumber);
    checkboxCell.setValue(preApproved);
    Logger.log('Approval Checkbox added successfully for row: ' + row);
  } catch (error) {
    Logger.log('add Approval Checkbox failed for row: ' + ( eventInputs.RANGE ? eventInputs.RANGE.getRow() : 'unknown') + ', error: ' + error.toString());
  }
}



/**
 * Sends individual, personalized notification emails to all volunteers about the new shifts.
 * @param {object} eventData The event data object
 */
function sendFormConfirmationNotification(eventData, preApproved = false) {

  /**
   * Preapproved guest email response
   * @param {object} eventData The event data object 
   */
    function _preApprovedResponse(eventData) {

      const emailData = {
        subject : `${eventData.firstName} ${eventData.lastName} - Thank you for volunteering with Boulder's Chevra Chadisha`,
        body: `

        Dear ${eventData.firstName},

        Your Volunteer Membership to the Boulder Chevra Kadisha has been approved. 

        Shmira Schedule 
        When there is a death in the community, you will receive an email request to sit shmira. The email will include a link to a web portal where you may sign up for shmira. Please remember that this link is unique to you so please do not share it. 

        If you have any questions, do not hesitate to contact us by email or phone.

        With gratitude,

        Boulder Chevra Kadisha
        Phone - 303-842-5365
        Email - boulder.chevra@gmail.com
        
      `
      }

      return emailData;

    }

    /**
     * Not yet approved guest email response
     * @param {object} eventData The event data object
     */
    function _followupResponse(eventData) {

      const emailData = {
        subject : `${eventData.firstName} ${eventData.lastName} - Thank you for volunteering with Boulder's Chevra Chadisha - Let's talk`,
        body: `

        Dear ${eventData.firstName},

        Your Volunteer Membership to the Boulder Chevra Kadisha has not yet been approved. 

        Thank you for submitting your Guest Shomerim application with the Boulder Chevra Kadisha. 

        We need to discuss the available options with you. 
       
        Please call us at (303) 842-5365 or reply to this email with your availability to have a 15-minute conversation. 
          Boulder Chevra Kadisha
          Phone - 303-842-5365
          Email - boulder.chevra@gmail.com

        We appreciate your willingness to perform this sacred duty and look forward to speaking with you. 

        With gratitude,

        Boulder Chevra Kadisha

      `
      }

      return emailData;

    }


  // Validate required fields
  if (!eventData || 
      !eventData.email || 
      !eventData.firstName || 
      !eventData.lastName || 
      !eventData.address ) {
    Logger.log('Error: Missing required event data fields for email notification');
    return;
  }

  // Based on preapproved validation send different messages.
  let emailData = {};
  switch (preApproved) {
    case true:
      emailData = _preApprovedResponse(eventData);
      break;

    case false:
      emailData = _followupResponse(eventData);
      break;
  }

  try {
    MailApp.sendEmail({
      to: eventData.email,
      subject: emailData.subject,
      body: emailData.body
    });

    Logger.log(`Guest notification sent successfully to ${eventData.email}.`);

  } catch (error) {
    Logger.log(`ERROR sending notification email to ${eventData.email}: ${error.toString()}`);
  }
  
  Logger.log(`Finished sending new guest notifications.`);

};

function debugProcessForm(){

  const eventData = {"rawValues":["11/14/2025 16:19:17","eshapiro@gmail.com","Dalia","Shapiro","6391 Swallow Ln","Boulder","CO","80303","303 618 5661","Yes","Alice 1","Family","Yes","","Yes","","Member of local synagogue","CBS","Yes","Agree",""],"submissionDate":"11/14/2025 16:19:17","email":"eshapiro@gmail.com","firstName":"Dalia","lastName":"Shapiro","address":"6391 Swallow Ln","city":"Boulder","state":"CO","zipcode":"80303","phone":"303 618 5661","q_textToPhone":"Yes","q_nameOfDeceased":"Alice 1","q_relationToDeceased":"Family","q_age18plus":"Yes","q_tbd":"","q_shmiraBizHoursOk":"Yes","q_tbd2":"","q_affiliation":"Member of local synagogue","q_synagogueName":"CBS","q_onMailingList":"Yes","q_certifyTrue":"Agree"}

  let preApproved = preApproveGuests(eventData);
   
  // -------------------------------------------------------------------
  // --- Individual Email Notification to all volunteers ---
  // -------------------------------------------------------------------
  const result = sendFormConfirmationNotification(eventData, preApproved);

  Logger.log(result);

}

/**
 * Adds unique token value to the last column of the last row entered
 * @param {object} eventData The event data object
 */
function addToken(eventInputs) {

  var columnNumber= eventInputs.TOKEN_COLUMN_NUMBER;

  if (!columnNumber) {
    Logger.log('addToken failed - no Column provided')
  }

  try {
    var sheet = eventInputs.SHEET_ID;
    var row = eventInputs.ROW_ID;
    var uuid = eventInputs.UUID;

    sheet.getRange(row, columnNumber).setValue(uuid);
    Logger.log('Uuid: ' + uuid);
    Logger.log('Token added successfully for row: ' + row + ' column:' + columnNumber);
    return true;

  } catch (error) {
    // Stores detailed information for easier eventData.DEBUGging
    Logger.log('addToken failed for row: ' + (e && e.range ? e.range.getRow() : 'unknown') + ', error: ' + error.toString());
    return false;
  }
  
}





/**
 * Sends individual, personalized notification emails to all volunteers about the new shifts.
 * @param {object} eventData The event data object
 */
function isFormUpdated(eventData) {

  let formUpdated = false;

  // Validate required fields for prevalidation
  if (!eventData || 
      !eventData.submissionDate ||
      !eventData.email) {
    Logger.log('Error: Missing required event data fields for checking updates');
    return false;
  }

  // Check for update race condition
  if (
        eventData.submissionDate !== "" &&
        eventData.email === ""
      ) 
      {
        formUpdated = true;
      };

  return formUpdated;

}


/**
 * Quality Control Logger: Logs a set of variables with a context message.
 * ONLY logs if the global constant eventData.DEBUG is set to true.
 *
 * @param {string} context - A message describing where in the code this is being called.
 * @param {Object} varsObject - An object where keys are variable names and values are the variables.
 */
function logQCVars(DEBUG, context, varsObject) {
  // --- QA CHECK ---
  if (typeof DEBUG === 'undefined' || DEBUG === false) {
    return;
  }
  // --- END QA CHECK ---

  Logger.log(`--- QC LOG: ${context} ---`);
  
  if (typeof varsObject !== 'object' || varsObject === null) {
    Logger.log(`Invalid varsObject: ${varsObject}`);
    Logger.log(`--- END QC LOG: ${context} ---`);
    return;
  }

  for (const key in varsObject) {
    if (Object.prototype.hasOwnProperty.call(varsObject, key)) {
      const value = varsObject[key];
      
      if (typeof value === 'object' && value !== null) {
        try {
          Logger.log(`[${key}]: ${JSON.stringify(value)}`);
        } catch (e) {
          Logger.log(`[${key}] (Object): ${value.toString()}`);
        }
      } else {
        Logger.log(`[${key}]: ${value}`);
      }
    }
  }
  Logger.log(`--- END QC LOG: ${context} ---`);
}
