#!/usr/bin/env node
/**
 * Sync Visitor model into a project's schema.prisma
 * Usage: node sync-schema.js <path-to-schema.prisma>
 *
 * Checks if the Visitor model already exists and appends it if missing.
 */
const fs = require('fs');
const path = require('path');

const VISITOR_MODEL = `
// Visitor Analytics Model (from @lozzalingo/analytics)
model Visitor {
  id               String    @id @default(uuid())
  ip               String
  path             String?
  referrer         String?
  referrerCategory String?
  city             String?
  country          String?
  region           String?
  latitude         Float?
  longitude        Float?
  timestamp        DateTime  @default(now())

  // Session tracking
  sessionId        String?
  sessionPageCount Int?
  isNewVisitor     Boolean   @default(true)

  // Device & Browser info
  userAgent        String?
  deviceType       String?
  deviceBrand      String?
  deviceConfidence Float?
  browser          String?
  browserVersion   String?
  os               String?
  osVersion        String?

  // Screen & Hardware
  screenWidth      Int?
  screenHeight     Int?
  viewportWidth    Int?
  viewportHeight   Int?
  pixelRatio       Float?
  colorDepth       Int?
  touchPoints      Int?
  orientation      String?
  hardwareCores    Int?
  deviceMemory     Float?
  connectionType   String?

  // Fingerprinting
  fingerprint      String?
  canvasHash       String?
  webglHash        String?

  // Bot detection
  isBot            Boolean   @default(false)
  botType          String?
  jsEnabled        Boolean   @default(true)

  // Page timing
  pageLoadTime     Int?
  timeOnPage       Int?

  // UTM & Campaign tracking
  utmSource        String?
  utmMedium        String?
  utmCampaign      String?
  utmContent       String?
  utmTerm          String?

  // Event tracking
  eventType        String?
  eventData        String?

  // E-commerce tracking
  productViewed    String?
  addedToCart      Boolean   @default(false)
  checkoutStarted  Boolean   @default(false)
  purchaseComplete Boolean   @default(false)
  orderValue       Float?

  @@index([timestamp])
  @@index([sessionId])
  @@index([fingerprint])
  @@index([country])
  @@index([eventType])
  @@index([isBot])
}`;

function syncSchema(schemaPath) {
  if (!schemaPath) {
    console.error('[Analytics] Usage: node sync-schema.js <path-to-schema.prisma>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(schemaPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`[Analytics] Schema file not found: ${resolvedPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');

  if (content.includes('model Visitor')) {
    console.log('[Analytics] Visitor model already exists in schema - skipping');
    return;
  }

  const updatedContent = content + '\n' + VISITOR_MODEL + '\n';
  fs.writeFileSync(resolvedPath, updatedContent);
  console.log('[Analytics] Visitor model added to schema:', resolvedPath);
  console.log('[Analytics] Run: npx prisma migrate dev --name add_visitor_model');
}

// Run if called directly
if (require.main === module) {
  syncSchema(process.argv[2]);
}

module.exports = { syncSchema };
