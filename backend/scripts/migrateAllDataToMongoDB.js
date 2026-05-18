require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const Vocabulary = require("../models/Vocabulary");
const User = require("../models/User");

const DATA_FOLDER = path.join(__dirname, "..", "public", "data");
const DATA_DIR = path.join(__dirname, "..", "data");

// Chỉ migrate 1 file cụ thể
const FILE_TO_MIGRATE = "600WORDS.json"; // Đổi tên file ở đây khi cần migrate file khác

const USER_FILE = path.join(DATA_DIR, "users.json");

let stats = {
  vocabularies: { inserted: 0, updated: 0, failed: 0 },
  users: { success: 0, failed: 0 },
  errors: [],
};

async function migrateSingleVocabularyFile(filename) {
  console.log("\n" + "=".repeat(60));
  console.log(`MIGRATING VOCABULARY FILE: ${filename}`);
  console.log("=".repeat(60));

  const filePath = path.join(DATA_FOLDER, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`ERROR: ${filename} not found at ${filePath}`);
    return false;
  }

  const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const words = Array.isArray(fileData) ? fileData : [];

  // Source từ file: ưu tiên word.source, fallback từ tên file
  const fileSource = filename
    .replace(".json", "")
    .toLowerCase()
    .replace("ets2024", "ets2024")
    .replace("ets2026", "ets2026")
    .replace("ets2023", "ets2023")
    .replace("600words", "600words");

  console.log(`File: ${filename}`);
  console.log(`Source fallback: ${fileSource}`);
  console.log(`Total words: ${words.length}`);
  console.log("-".repeat(60));

  let inserted = 0,
    updated = 0,
    errors = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word.en) {
      errors++;
      stats.errors.push(`${filename}/word[${i}]: missing 'en' field`);
      continue;
    }

    try {
      const sourceVal = (word.source || fileSource).toLowerCase();
      const doc = {
        en: word.en,
        vn: word.vn || "",
        phonetic: word.phonetic || null,
        part: word.part || "UNKNOWN",
        synonyms: word.synonyms || null,
        type: word.type || "noun",
        image: word.image || null,
        example: word.example || null,
        level: word.level || "B1",
        source: sourceVal,
      };

      // Đoạn update ĐÃ ĐƯỢC ĐẶT ĐÚNG VỊ TRÍ
      const result = await Vocabulary.updateOne(
        { en: doc.en, part: doc.part, source: sourceVal },
        { $set: doc },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        inserted++;
      } else if (result.modifiedCount > 0) {
        updated++;
        console.log(`  🔄 Updated: ${doc.en} (${doc.part})`); // Log từ bị update
      } else {
        updated++; // existed but not modified
        console.log(`  ⏭️  Skipped (no change): ${doc.en}`);
      }

      // Log progress mỗi 100 words (GIỮ NGUYÊN VỊ TRÍ NÀY)
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${words.length} words processed`);
      }
    } catch (error) {
      errors++;
      stats.errors.push(`${filename}/${word.en}: ${error.message}`);
    }
  }

  console.log("-".repeat(60));
  console.log(`RESULTS for ${filename}:`);
  console.log(`  ✅ Inserted: ${inserted}`);
  console.log(`  🔄 Updated: ${updated}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log("=".repeat(60));

  stats.vocabularies.inserted += inserted;
  stats.vocabularies.updated += updated;
  stats.vocabularies.failed += errors;

  return true;
}

async function migrateUsers() {
  console.log("\n" + "=".repeat(60));
  console.log("MIGRATING USERS");
  console.log("=".repeat(60));

  if (!fs.existsSync(USER_FILE)) {
    console.log("⚠️  SKIP: users.json not found");
    return;
  }

  const usersData = JSON.parse(fs.readFileSync(USER_FILE, "utf8"));
  console.log(`Found ${usersData.length} users`);

  let success = 0,
    failed = 0;

  for (const userData of usersData) {
    try {
      const exists = await User.findOne({ email: userData.email });
      if (exists) {
        success++;
        continue;
      }

      const newUser = new User({
        username: userData.username,
        email: userData.email,
        password: userData.password || "",
        avatar: userData.avatar || userData.username.charAt(0).toUpperCase(),
        level: userData.level || 1,
        xp: userData.xp || 0,
        totalXp: userData.totalXp || 0,
        role: userData.role || "user",
        isActive: userData.isActive ?? true,
        createdAt: userData.createdAt || new Date(),
        updatedAt: userData.updatedAt || new Date(),
      });

      await newUser.save({ validateBeforeSave: false });
      success++;
      console.log(`  ✅ Migrated: ${newUser.email}`);
    } catch (error) {
      failed++;
      stats.errors.push(`User ${userData.email}: ${error.message}`);
    }
  }

  stats.users.success = success;
  stats.users.failed = failed;

  console.log(`\nUser Migration Results:`);
  console.log(`  ✅ Success: ${success}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log("=".repeat(60));
}

async function runMigration() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in .env");
  }

  console.log("🚀 Starting Migration Tool");
  console.log("=".repeat(60));

  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");
  console.log(`📁 Data folder: ${DATA_FOLDER}`);
  console.log(`📄 File to migrate: ${FILE_TO_MIGRATE}`);

  // Chỉ migrate 1 file vocabulary
  await migrateSingleVocabularyFile(FILE_TO_MIGRATE);

  // Hỏi có muốn migrate users không?
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const migrateUsersAnswer = await new Promise((resolve) => {
    readline.question("\n🤔 Do you want to migrate users as well? (y/N): ", (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === "y");
    });
  });

  if (migrateUsersAnswer) {
    await migrateUsers();
  } else {
    console.log("\n⏭️  Skipping users migration");
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 MIGRATION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Vocabulary File: ${FILE_TO_MIGRATE}`);
  console.log(
    `  Inserted: ${stats.vocabularies.inserted}, Updated: ${stats.vocabularies.updated}, Failed: ${stats.vocabularies.failed}`,
  );
  
  if (migrateUsersAnswer) {
    console.log(
      `Users: Success: ${stats.users.success}, Failed: ${stats.users.failed}`,
    );
  }

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    const showErrors = stats.errors.slice(0, 10);
    showErrors.forEach((err) => console.log(`  - ${err}`));
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more errors`);
    }
  } else {
    console.log("\n✨ No errors! Migration completed successfully!");
  }

  await mongoose.connection.close();
  console.log("\n🔌 Disconnected from MongoDB");
  process.exit(0);
}

// Handle errors
runMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});