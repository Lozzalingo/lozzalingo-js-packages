const { google } = require("googleapis");
const path = require("path");

const SPREADSHEET_ID = "1iGWSUhaGxGtsxwOUZpcJBD-kXwubcenN0Q0H6lKAyFQ";
const SHEET_NAME = "BucketRace: Personalisation Form";
const CREDS_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(
    __dirname,
    "../../../../../creds/plucky-catfish-452808-f1-69c67e3ecdd1.json"
  );

// ── Group type mappings ─────────────────────────────────────────────────────

const EVENT_TYPE_MAP = {
  corporate: "Team Building / Corporate Entertainment",
  hen: "Hen / Stag / Birthday / Social Meet Up",
  stag: "Hen / Stag / Birthday / Social Meet Up",
  birthday: "Hen / Stag / Birthday / Social Meet Up",
  sten: "Hen / Stag / Birthday / Social Meet Up",
  other: "Hen / Stag / Birthday / Social Meet Up",
};

const EVENT_SUBTYPE_MAP = {
  corporate: "Team Building",
  hen: "Hen Party",
  stag: "Stag Do",
  birthday: "Birthday Party",
  sten: "Sten Party",
  other: "Social Meet Up",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDateDDMMYYYY(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTimestampDDMMYYYY(dateVal) {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  const secs = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
}

function formatTimeHHMMSS(timeStr) {
  if (!timeStr) return "";
  // Already in HH:mm or HH:mm:ss format
  const parts = timeStr.split(":");
  if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
  if (parts.length === 3) return timeStr;
  return timeStr;
}

function splitName(fullName) {
  if (!fullName) return { firstName: "", lastName: "" };
  const trimmed = fullName.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.substring(0, spaceIdx),
    lastName: trimmed.substring(spaceIdx + 1),
  };
}

// ── Auth ────────────────────────────────────────────────────────────────────

let sheetsClient = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  console.log("[GoogleSheets] Authenticating with service account");
  const creds = require(CREDS_PATH);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  sheetsClient = google.sheets({ version: "v4", auth: client });
  console.log("[GoogleSheets] Authenticated successfully");
  return sheetsClient;
}

// ── Push booking to sheet ───────────────────────────────────────────────────

async function pushBookingToSheet(booking, productName) {
  console.log(`[GoogleSheets] Pushing booking ${booking.bookingNumber} to sheet`);

  const sheets = await getSheetsClient();
  const { firstName, lastName } = splitName(booking.customerName);
  const groupType = (booking.groupType || "other").toLowerCase();

  // Build the row (columns A through AZ = 52 columns)
  const row = [
    /* A  Timestamp */                    formatTimestampDDMMYYYY(booking.createdAt),
    /* B  Booking Ref */                  booking.bookingNumber || "",
    /* C  First Name */                   firstName,
    /* D  Last Name */                    lastName,
    /* E  Email Address */                booking.customerEmail || "",
    /* F  Contact Telephone Number */     booking.customerPhone || "",
    /* G  How many people */              booking.groupSize ? String(booking.groupSize) : "",
    /* H  How many hours */               booking.duration || "",
    /* I  Date */                         formatDateDDMMYYYY(booking.eventDate),
    /* J  Time */                         formatTimeHHMMSS(booking.eventTime),
    /* K  How did you hear about us */    booking.source || "",
    /* L  What is your event type */      EVENT_TYPE_MAP[groupType] || EVENT_TYPE_MAP.other,
    /* M  Which Game */                   productName || "",
    /* N  Platform */                     "Real-World",
    /* O  Which type of event */          EVENT_SUBTYPE_MAP[groupType] || EVENT_SUBTYPE_MAP.other,
    /* P  What is your event platform */  "Real-World",
    /* Q  Virtual game */                 "",
    /* R  Real world game */              productName || "",
    /* S  Area to explore */              booking.locationName || "",
    /* T  Event name */                   "",
    /* U  Organisation name */            booking.companyName || "",
    /* V  Org culture 1 */                "",
    /* W  Org culture 2 */                "",
    /* X  Org culture 3 */                "",
    /* Y  Memorable moment */             "",
    /* Z  In jokes */                     "",
    /* AA Primary industry */             "",
    /* AB Secondary industry */           "",
    /* AC Big characters 1 */             "",
    /* AD Big characters 2 */             "",
    /* AE Big characters 3 */             "",
    /* AF Fun facts 1 */                  "",
    /* AG Fun facts 2 */                  "",
    /* AH Fun facts 3 */                  "",
    /* AI Stand out 1 */                  "",
    /* AJ Stand out 2 */                  "",
    /* AK Stand out 3 */                  "",
    /* AL USP 1 */                        "",
    /* AM USP 2 */                        "",
    /* AN USP 3 */                        "",
    /* AO Mottos 1 */                     "",
    /* AP Mottos 2 */                     "",
    /* AQ Mottos 3 */                     "",
    /* AR Product/service 1 */            "",
    /* AS Product/service 2 */            "",
    /* AT Product/service 3 */            "",
    /* AU Product/service 4 */            "",
    /* AV Product/service 5 */            "",
    /* AW Event 1 */                      "",
    /* AX Event 2 */                      "",
    /* AY Event 3 */                      "",
    /* AZ Creative input */               booking.specialRequests || booking.message || "",
  ];

  const result = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:AZ`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });

  const updatedRange = result.data.updates?.updatedRange || "unknown";
  console.log(`[GoogleSheets] Booking ${booking.bookingNumber} appended to ${updatedRange}`);

  return {
    success: true,
    updatedRange,
    bookingNumber: booking.bookingNumber,
  };
}

module.exports = { pushBookingToSheet };
