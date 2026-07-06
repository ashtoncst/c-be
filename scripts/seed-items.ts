// Script to seed solutions and categories as items
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

interface SolutionData {
  name: string;
  description: string;
}

interface CategoryData {
  name: string;
  description: string;
  parentSolution: string;
}

// Define solutions (top level)
const solutions: SolutionData[] = [
  {
    name: "Connectivity Solutions",
    description: "Complete connectivity and network infrastructure solutions",
  },
  {
    name: "Managed Services",
    description: "Fully managed IT, network, and security services",
  },
  {
    name: "Cloud & Cybersecurity",
    description: "Cloud infrastructure and advanced security solutions",
  },
  {
    name: "Colocation Services",
    description: "Enterprise-grade data center colocation",
  },
  {
    name: "Content & Entertainment",
    description: "Digital content and entertainment solutions",
  },
];

// Define categories (map to your existing product categories)
const categories: CategoryData[] = [
  // Connectivity Solutions
  {
    name: "Internet",
    description: "High-speed internet access solutions",
    parentSolution: "Connectivity Solutions",
  },
  {
    name: "Transport",
    description: "Dedicated network transport and connectivity services",
    parentSolution: "Connectivity Solutions",
  },
  {
    name: "Satellite",
    description: "Satellite-based internet connectivity",
    parentSolution: "Connectivity Solutions",
  },
  {
    name: "Managed Services",
    description: "Comprehensive managed IT and network services",
    parentSolution: "Managed Services",
  },
  {
    name: "Security",
    description: "Advanced security and DDoS protection services",
    parentSolution: "Cloud & Cybersecurity",
  },
  {
    name: "Colocation",
    description: "Data center colocation and hosting",
    parentSolution: "Colocation Services",
  },
  {
    name: "Content",
    description: "Digital content delivery and entertainment",
    parentSolution: "Content & Entertainment",
  },
];

async function main() {
  console.log("🌱 Seeding solutions and categories...\n");

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST?.includes("rds.amazonaws.com")
      ? { rejectUnauthorized: false }
      : false,
  });

  try {
    const client = await pool.connect();
    console.log("✅ Connected to database\n");

    // ========================================
    // 1. Insert Solutions
    // ========================================
    console.log("📊 Inserting solutions...");
    const solutionIds = new Map<string, number>();

    for (const solution of solutions) {
      const result = await client.query(
        `INSERT INTO item (name, description, item_type, parent_item_id, is_active, created_at, updated_at)
         VALUES ($1, $2, 'solution', NULL, true, NOW(), NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [solution.name, solution.description]
      );

      if (result.rows.length > 0) {
        solutionIds.set(solution.name, result.rows[0].id);
        console.log(`  ✅ ${solution.name} (ID: ${result.rows[0].id})`);
      } else {
        // Already exists, get ID
        const existing = await client.query(
          "SELECT id FROM item WHERE name = $1 AND item_type = 'solution'",
          [solution.name]
        );
        if (existing.rows.length > 0) {
          solutionIds.set(solution.name, existing.rows[0].id);
          console.log(
            `  ⏭️  ${solution.name} (already exists, ID: ${existing.rows[0].id})`
          );
        }
      }
    }
    console.log();

    // ========================================
    // 2. Insert Categories
    // ========================================
    console.log("📁 Inserting categories...");
    let categoriesInserted = 0;
    let categoriesSkipped = 0;

    for (const category of categories) {
      const parentId = solutionIds.get(category.parentSolution);
      if (!parentId) {
        console.log(
          `  ⚠️  Skipping "${category.name}" - parent solution not found`
        );
        categoriesSkipped++;
        continue;
      }

      const result = await client.query(
        `INSERT INTO item (name, description, item_type, parent_item_id, is_active, created_at, updated_at)
         VALUES ($1, $2, 'category', $3, true, NOW(), NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [category.name, category.description, parentId]
      );

      if (result.rows.length > 0) {
        console.log(
          `  ✅ ${category.name} (ID: ${result.rows[0].id}, Parent: ${category.parentSolution})`
        );
        categoriesInserted++;
      } else {
        console.log(`  ⏭️  ${category.name} (already exists)`);
        categoriesSkipped++;
      }
    }
    console.log();

    // ========================================
    // 3. Link existing products to categories
    // ========================================
    console.log("🔗 Linking existing products to categories...");

    // Get all products (itemType='product')
    const products = await client.query(
      "SELECT id, name FROM item WHERE item_type = 'product' AND parent_item_id IS NULL"
    );

    console.log(
      `  Found ${products.rows.length} products without parent categories`
    );

    // Map products to categories based on your CSV data
    const productCategoryMap: Record<string, string> = {
      "Fiber Broadband": "Internet",
      "Fiber Dedicated": "Internet",
      "IX Express": "Internet",
      "IPT Express": "Internet",
      "Metro Ethernet": "Transport",
      "IP VPN": "Transport",
      FASTER: "Transport",
      "Optical Transport Network": "Transport",
      "Cloud Direct Connect": "Transport",
      "DC Express": "Transport",
      "Ethernet International Private Line": "Transport",
      "CLS Express": "Transport",
      "Starlink Satellite": "Satellite",
      "Anti-DDoS": "Security",
      DraaS: "Managed Services",
      "SD-WAN": "Managed Services",
      "Managed Wi-Fi": "Managed Services",
      "Managed Surveillance": "Managed Services",
      "Colocation Data Centers": "Colocation",
    };

    let linkedCount = 0;
    for (const product of products.rows) {
      const categoryName = productCategoryMap[product.name];
      if (categoryName) {
        const categoryResult = await client.query(
          "SELECT id FROM item WHERE name = $1 AND item_type = 'category'",
          [categoryName]
        );

        if (categoryResult.rows.length > 0) {
          await client.query(
            "UPDATE item SET parent_item_id = $1 WHERE id = $2",
            [categoryResult.rows[0].id, product.id]
          );
          linkedCount++;
        }
      }
    }

    console.log(`  ✅ Linked ${linkedCount} products to categories\n`);

    // ========================================
    // 4. Display Summary
    // ========================================
    console.log("=".repeat(60));
    console.log("📊 Summary:");
    console.log(`   Solutions: ${solutionIds.size}`);
    console.log(
      `   Categories: ${categoriesInserted} inserted, ${categoriesSkipped} skipped`
    );
    console.log(`   Products linked: ${linkedCount}`);
    console.log("=".repeat(60) + "\n");

    // ========================================
    // 5. Display Item Hierarchy
    // ========================================
    console.log("🌳 Item Hierarchy:");
    const hierarchy = await client.query(`
      SELECT
        s.id as solution_id,
        s.name as solution_name,
        c.id as category_id,
        c.name as category_name,
        COUNT(p.id) as product_count
      FROM item s
      LEFT JOIN item c ON c.parent_item_id = s.id AND c.item_type = 'category'
      LEFT JOIN item p ON p.parent_item_id = c.id AND p.item_type = 'product'
      WHERE s.item_type = 'solution'
      GROUP BY s.id, s.name, c.id, c.name
      ORDER BY s.name, c.name
    `);

    let currentSolution = "";
    for (const row of hierarchy.rows) {
      if (row.solution_name !== currentSolution) {
        console.log(`\n  📦 ${row.solution_name}`);
        currentSolution = row.solution_name;
      }
      if (row.category_name) {
        console.log(
          `     ├─ ${row.category_name} (${row.product_count} products)`
        );
      }
    }
    console.log();

    client.release();
    console.log("✅ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
