/**
 * Script to add Rectangle, Square, Heart, and Circle shapes
 * to the photo-mosaic category.
 *
 * Run with: npx tsx scripts/add-photo-mosaic-shapes.ts
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { Category } from "../src/models/Category.Schema";
import { Shape } from "../src/models/Shape.Schema";

dotenv.config();

const CATEGORY_SLUG = "photo-mosaic";

const shapesToAdd = [
  {
    name: "Rectangle",
    slug: "rectangle",
    description: "Photo mosaic in a classic rectangle shape (landscape/portrait).",
  },
  {
    name: "Square",
    slug: "square",
    description: "Photo mosaic arranged in a perfect square format.",
  },
  {
    name: "Heart",
    slug: "heart",
    description: "Photo mosaic crafted in a romantic heart shape.",
  },
  {
    name: "Circle",
    slug: "circle",
    description: "Photo mosaic beautifully arranged in a circle shape.",
  },
];

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌  MONGO_URI is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("✅  Connected to MongoDB");

  const category = await Category.findOne({ slug: CATEGORY_SLUG });
  if (!category) {
    console.error(`❌  Category with slug "${CATEGORY_SLUG}" not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`✅  Found category: ${category.name} (${category._id})`);

  // Fetch already existing shapes for this category
  const existingSlugs = (
    await Shape.find({ categoryId: category._id }).select("slug")
  ).map((s) => s.slug);

  console.log(
    `ℹ️   Existing shapes: ${existingSlugs.length > 0 ? existingSlugs.join(", ") : "none"}`
  );

  let created = 0;
  let skipped = 0;

  for (const shapeData of shapesToAdd) {
    if (existingSlugs.includes(shapeData.slug)) {
      console.log(`⏭️   Skipping "${shapeData.name}" — already exists.`);
      skipped++;
      continue;
    }

    await Shape.create({
      name: shapeData.name,
      slug: shapeData.slug,
      description: shapeData.description,
      categoryId: category._id,
      status: "active",
    });

    console.log(`✅  Created shape: ${shapeData.name} (slug: ${shapeData.slug})`);
    created++;
  }

  console.log(`\n🎉  Done! Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌  Script failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
