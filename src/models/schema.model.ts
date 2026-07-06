// src/models/schema.ts
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  decimal,
  index,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ================================================
// Core Product Catalog Schema
// ================================================

export const targetAudience = pgTable("target_audience", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productCategory = pgTable("product_category", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const feature = pgTable(
  "feature",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    description: text("description"),
    searchVector: text("search_vector"), // For full-text search
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    searchVectorIdx: index("idx_feature_search_vector").on(table.searchVector),
  })
);

export const product = pgTable(
  "product",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    targetAudienceId: integer("target_audience_id").notNull(),
    productCategoryId: integer("product_category_id").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }),
    contractTerm: varchar("contract_term", { length: 255 }),
    searchVector: text("search_vector"), // For full-text search
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    targetAudienceIdx: index("idx_product_target_audience").on(
      table.targetAudienceId
    ),
    productCategoryIdx: index("idx_product_category").on(
      table.productCategoryId
    ),
    searchVectorIdx: index("idx_product_search_vector").on(table.searchVector),
    priceIdx: index("idx_product_price").on(table.price),
  })
);

export const productFeature = pgTable(
  "product_feature",
  {
    productId: integer("product_id").notNull(),
    featureId: integer("feature_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: {
      primaryKey: { columns: [table.productId, table.featureId] },
    },
  })
);

// ================================================
// Unified Item Model (New)
// ================================================

// Note: parentItemId references item.id (self-reference)
// Foreign key constraint is enforced at database level via SQL migration
export const item = pgTable(
  "item",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    itemType: varchar("item_type", { length: 50 }).notNull(), // 'solution' | 'category' | 'product'
    parentItemId: integer("parent_item_id"), // Self-reference to item.id
    price: decimal("price", { precision: 10, scale: 2 }),
    contractTerm: varchar("contract_term", { length: 255 }),
    targetAudienceId: integer("target_audience_id"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    // Indexed tsvector column in DB; represented as text for Drizzle compatibility
    searchVector: text("search_vector"),
  },
  (table) => ({
    itemTypeIdx: index("idx_item_type").on(table.itemType),
    parentItemIdx: index("idx_item_parent").on(table.parentItemId),
    targetAudienceIdx: index("idx_item_target_audience").on(
      table.targetAudienceId
    ),
    activeIdx: index("idx_item_active").on(table.isActive),
    nameIdx: index("idx_item_name").on(table.name),
  })
);

export const itemFeature = pgTable(
  "item_feature",
  {
    itemId: integer("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    featureId: integer("feature_id")
      .notNull()
      .references(() => feature.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: {
      primaryKey: { columns: [table.itemId, table.featureId] },
    },
  })
);

// ================================================
// User Journey & Lead Generation Schema
// ================================================

export const userSelection = pgTable(
  "user_selection",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    productId: integer("product_id"), // Made optional to support itemId-only usage
    itemId: integer("item_id").references(() => item.id), // New: supports items
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    sessionIdx: index("idx_user_selection_session").on(table.sessionId),
    productIdx: index("idx_user_selection_product").on(table.productId),
    itemIdx: index("idx_user_selection_item").on(table.itemId),
    createdAtIdx: index("idx_user_selection_created_at").on(table.createdAt),
    uniqueSessionProduct: index("uq_user_selection_session_product").on(
      table.sessionId,
      table.productId
    ),
    uniqueSessionItem: index("uq_user_selection_session_item").on(
      table.sessionId,
      table.itemId
    ),
  })
);

export const salesLead = pgTable(
  "sales_lead",
  {
    id: serial("id").primaryKey(),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 255 }).notNull(),
    salesforceLeadId: varchar("salesforce_lead_id", { length: 255 }),
    status: varchar("status", { length: 50 }).notNull().default("New"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_sales_lead_status").on(table.status),
    emailIdx: index("idx_sales_lead_email").on(table.customerEmail),
    salesforceIdIdx: index("idx_sales_lead_salesforce_id").on(
      table.salesforceLeadId
    ),
    createdAtIdx: index("idx_sales_lead_created_at").on(table.createdAt),
  })
);

export const salesLeadUserSelection = pgTable(
  "sales_lead_user_selection",
  {
    salesLeadId: integer("sales_lead_id").notNull(),
    userSelectionId: integer("user_selection_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    pk: {
      primaryKey: { columns: [table.salesLeadId, table.userSelectionId] },
    },
  })
);

// ================================================
// User Management Schema (MUST come before chat tables)
// ================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  userType: varchar("user_type", { length: 50 }).default("anonymous"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ================================================
// Chat System Schema
// ================================================

export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    userMessage: text("user_message").notNull(),
    botResponse: text("bot_response").notNull(),
    extractedEntities: jsonb("extracted_entities"),
    recommendedProducts: jsonb("recommended_products"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    sessionIdx: index("idx_chat_conversations_session").on(table.sessionId),
    createdAtIdx: index("idx_chat_conversations_created_at").on(
      table.createdAt
    ),
  })
);

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    userPreferences: jsonb("user_preferences"),
    conversationContext: text("conversation_context"),
    lastActivityAt: timestamp("last_activity_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index("idx_chat_sessions_session_id").on(table.sessionId),
    userIdIdx: index("idx_chat_sessions_user_id").on(table.userId), // Add this index
    lastActivityIdx: index("idx_chat_sessions_last_activity").on(
      table.lastActivityAt
    ),
  })
);

// ================================================
// Relations
// ================================================

export const productRelations = relations(product, ({ one, many }) => ({
  targetAudience: one(targetAudience, {
    fields: [product.targetAudienceId],
    references: [targetAudience.id],
  }),
  productCategory: one(productCategory, {
    fields: [product.productCategoryId],
    references: [productCategory.id],
  }),
  productFeatures: many(productFeature),
  userSelections: many(userSelection),
}));

export const productFeatureRelations = relations(productFeature, ({ one }) => ({
  product: one(product, {
    fields: [productFeature.productId],
    references: [product.id],
  }),
  feature: one(feature, {
    fields: [productFeature.featureId],
    references: [feature.id],
  }),
}));

export const featureRelations = relations(feature, ({ many }) => ({
  productFeatures: many(productFeature),
  itemFeatures: many(itemFeature),
}));

export const itemRelations = relations(item, ({ one, many }) => ({
  parentItem: one(item, {
    fields: [item.parentItemId],
    references: [item.id],
    relationName: "itemHierarchy",
  }),
  childItems: many(item, {
    relationName: "itemHierarchy",
  }),
  targetAudience: one(targetAudience, {
    fields: [item.targetAudienceId],
    references: [targetAudience.id],
  }),
  itemFeatures: many(itemFeature),
  userSelections: many(userSelection),
}));

export const itemFeatureRelations = relations(itemFeature, ({ one }) => ({
  item: one(item, {
    fields: [itemFeature.itemId],
    references: [item.id],
  }),
  feature: one(feature, {
    fields: [itemFeature.featureId],
    references: [feature.id],
  }),
}));

export const userSelectionRelations = relations(
  userSelection,
  ({ one, many }) => ({
    product: one(product, {
      fields: [userSelection.productId],
      references: [product.id],
    }),
    item: one(item, {
      fields: [userSelection.itemId],
      references: [item.id],
    }),
    salesLeadUserSelections: many(salesLeadUserSelection),
  })
);

export const salesLeadRelations = relations(salesLead, ({ many }) => ({
  salesLeadUserSelections: many(salesLeadUserSelection),
}));

export const salesLeadUserSelectionRelations = relations(
  salesLeadUserSelection,
  ({ one }) => ({
    salesLead: one(salesLead, {
      fields: [salesLeadUserSelection.salesLeadId],
      references: [salesLead.id],
    }),
    userSelection: one(userSelection, {
      fields: [salesLeadUserSelection.userSelectionId],
      references: [userSelection.id],
    }),
  })
);

export const chatConversationsRelations = relations(
  chatConversations,
  ({ one }) => ({
    session: one(chatSessions, {
      fields: [chatConversations.sessionId],
      references: [chatSessions.sessionId],
    }),
  })
);

export const chatSessionsRelations = relations(
  chatSessions,
  ({ one, many }) => ({
    conversations: many(chatConversations),
    user: one(users, {
      fields: [chatSessions.userId],
      references: [users.id],
    }),
  })
);

// Add user relations
export const usersRelations = relations(users, ({ many }) => ({
  chatSessions: many(chatSessions),
}));

// Export types for use in your application
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type Feature = typeof feature.$inferSelect;
export type NewFeature = typeof feature.$inferInsert;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type NewChatConversation = typeof chatConversations.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Item = typeof item.$inferSelect;
export type NewItem = typeof item.$inferInsert;
